import { ipcMain, BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import AdmZip from 'adm-zip'
import { MANIFEST_URL } from '../config'
import { launcherRoot, instanceDir } from '../lib/paths'
import { downloadVerified } from '../lib/download'
import { writeJsonAtomic } from '../lib/write-atomic'
import { isFresh, parseCache, pruneCache, type FileStamp, type HashCache } from '../lib/hash-cache'
import { pruneDeletedShaders } from './shaders'
import { hashCachePath, syncStatePath } from '../lib/paths'
import {
  planSync,
  nextManagedList,
  type Manifest,
  type LocalMod,
  type ManifestMod,
  overridesFingerprint,
  type ManifestOverrides,
  type ManifestSeed
} from '../lib/sync-plan'

interface SyncState {
  managed: string[]
  enabledOptional: string[]
  packVersion: string | null
  /** sha1 of the overrides archive already extracted into the instance. */
  overridesSha1: string | null
  /** Per-archive hashes, so an unchanged part is never downloaded twice. */
  overrideParts: Record<string, string>
}

const EMPTY_STATE: SyncState = {
  managed: [],
  enabledOptional: [],
  packVersion: null,
  overridesSha1: null,
  overrideParts: {}
}

/**
 * Optional mods that start switched on. A player can still turn them off; this
 * only decides what a fresh install gets.
 */
// `xaeros-world-map` salió de aquí el 25-08-2026: dejó de ser opcional y ahora
// viaja como mod requerido junto con `xaerominimap`, porque el servidor manda
// waypoints y el que los crea es el minimapa.
const DEFAULT_OPTIONAL = ['distant-horizons']

function modsDir(): string {
  return join(instanceDir(), 'mods')
}

function loadState(): SyncState {
  // A first run has no state file, so seed the defaults-on optional mods here
  // rather than leaving a fresh install without them.
  if (!existsSync(syncStatePath())) {
    return { ...EMPTY_STATE, enabledOptional: [...DEFAULT_OPTIONAL] }
  }
  try {
    return { ...EMPTY_STATE, ...JSON.parse(readFileSync(syncStatePath(), 'utf8')) }
  } catch {
    // A corrupt state file must not brick the launcher. Starting from empty is
    // safe: an unknown file is treated as the player's and never deleted.
    return EMPTY_STATE
  }
}

function saveState(state: SyncState): void {
  writeJsonAtomic(syncStatePath(), state)
}

function loadHashCache(): HashCache {
  try {
    return parseCache(JSON.parse(readFileSync(hashCachePath(), 'utf8')))
  } catch {
    // No cache yet, or an unreadable one. Either way the next scan rebuilds it.
    return {}
  }
}

function saveHashCache(cache: HashCache): void {
  try {
    writeJsonAtomic(hashCachePath(), cache)
  } catch {
    // A cache that cannot be written is a slow launcher, not a broken one.
  }
}

/** Hashes without pulling the whole jar into memory; some are over 100 MB. */
async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha1')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/**
 * The mods folder as the sync planner needs to see it: filename plus sha1.
 *
 * Asynchronous and cached, because this is the hot path. It runs on every
 * modpack check — which is every visit to Jugar and to Ajustes — and hashing
 * 117 jars from scratch means reading 425 MB. Doing that synchronously blocked
 * the main process, so the whole window stopped responding on every tab change.
 * Now an unchanged jar costs one statSync.
 */
async function scanLocal(): Promise<LocalMod[]> {
  const dir = modsDir()
  if (!existsSync(dir)) return []

  const files = readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.jar'))
  const cache = loadHashCache()
  const next: HashCache = {}
  const mods: LocalMod[] = []
  let recomputed = 0

  for (const filename of files) {
    const path = join(dir, filename)

    let stamp: FileStamp
    try {
      const stat = statSync(path)
      const cached = cache[filename]
      if (isFresh(cached, stat)) {
        next[filename] = cached
        mods.push({ filename, sha1: cached.sha1 })
        continue
      }
      stamp = { size: stat.size, mtimeMs: stat.mtimeMs }
    } catch {
      // Vanished between the listing and the stat. Nothing to plan around.
      continue
    }

    try {
      const digest = await hashFile(path)
      recomputed += 1
      next[filename] = { ...stamp, sha1: digest }
      mods.push({ filename, sha1: digest })
    } catch {
      // Unreadable — locked by the running game, or quarantined. Leaving it out
      // of the scan makes the planner treat it as missing and download it
      // again, which is the recoverable answer.
    }
  }

  if (recomputed > 0 || Object.keys(cache).length !== Object.keys(next).length) {
    saveHashCache(pruneCache(next, files))
  }
  return mods
}

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

/**
 * A snapshot of the sync in progress.
 *
 * Events alone were not enough: the Play screen unmounts whenever the player
 * clicks another tab in the sidebar, taking its listeners and its progress
 * state with it. The download kept running in this process, but coming back to
 * the tab showed an idle button, which looked exactly like a stalled download.
 * Keeping the state here lets the screen rebuild itself on mount.
 */
export interface SyncLive {
  running: boolean
  percent: number
  done: number
  total: number
  message: string | null
}

let live: SyncLive = { running: false, percent: 0, done: 0, total: 0, message: null }

/** Lets the updater avoid restarting the app in the middle of a download. */
export function isSyncRunning(): boolean {
  return inFlight !== null
}

function sendStatus(message: string): void {
  live = { ...live, message }
  send('sync:status', { message })
}

function sendProgress(done: number, total: number): void {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  live = { ...live, percent, done, total }
  send('sync:progress', { percent, done, total })
}

export async function fetchManifest(): Promise<Manifest> {
  if (!MANIFEST_URL) throw new Error('No hay ninguna URL de modpack configurada.')
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' } as RequestInit)
  if (!response.ok) {
    throw new Error(`No se pudo descargar el manifiesto (HTTP ${response.status}).`)
  }
  return (await response.json()) as Manifest
}

async function downloadMod(mod: ManifestMod): Promise<void> {
  await downloadVerified(mod.url, join(modsDir(), mod.filename), {
    expected: mod.sha1,
    algo: 'sha1',
    label: mod.filename
  })
}

interface OverridesResult {
  /** True when at least one archive was actually extracted this run. */
  changed: boolean
  /** Hashes to record, covering only the parts the manifest still lists. */
  parts: Record<string, string>
}

/**
 * Unpacks an archive without holding the main process for the whole extraction.
 *
 * These are 260 MB of config, videos and resource packs, and extractAllTo did
 * every file in one synchronous run: the window froze for the entire unpack,
 * so the launcher looked hung at exactly the moment it was telling the player
 * it was working. The async variant yields between entries.
 *
 * Not a complete fix — the AdmZip constructor still reads the archive into a
 * buffer in one go, so there is a pause at the start of each part. Removing
 * that would mean a different zip library, which is not worth it for three
 * archives per pack update.
 */
function extractArchive(archive: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // overwrite: the pack's settings are the source of truth for these folders.
    new AdmZip(archive).extractAllToAsync(target, true, false, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

/**
 * Downloads and unpacks config/, resourcepacks/ and shaderpacks/ over the
 * instance. Skipped when the archive already on disk matches, so it costs
 * nothing on a launch where nothing changed.
 *
 * The archive deliberately does NOT contain options.txt: that holds the
 * player's keybinds, video settings and volume, and replacing it on every
 * update would wipe their setup. The resource pack is enabled separately.
 */
async function applyOverrides(
  overrides: ManifestOverrides,
  state: SyncState,
  /**
   * Records the parts done so far. Called after each one, because a failure on
   * part 3 used to throw away parts 1 and 2 as well: nothing was written until
   * the whole set succeeded, so a dropped connection near the end cost the
   * player another 520 MB on the next attempt.
   */
  persist: (parts: Record<string, string>) => void
): Promise<OverridesResult> {
  const fingerprint = overridesFingerprint(overrides)
  if (state.overridesSha1 === fingerprint) {
    return { changed: false, parts: state.overrideParts }
  }

  const dir = join(launcherRoot(), 'overrides')
  const previous = state.overrideParts
  const parts: Record<string, string> = {}
  let changed = false

  let index = 0
  for (const part of overrides) {
    index += 1

    // Usually one archive moves between pack versions and the others are
    // byte-identical. Comparing the whole set as a single fingerprint meant a
    // one-line config edit cost every player all 684 MB instead of the 164 MB
    // that actually changed.
    if (previous[part.name] === part.sha1) {
      parts[part.name] = part.sha1
      continue
    }

    const archive = join(dir, part.name)
    await downloadVerified(part.url, archive, {
      expected: part.sha1,
      algo: 'sha1',
      label: part.name,
      onProgress: (received, total) => {
        // A 260 MB archive with only "Descargando configuración 1/3" on screen
        // is indistinguishable from a stalled one, so show the megabytes.
        const mb = (received / 1048576).toFixed(0)
        sendStatus(
          total > 0
            ? `Descargando configuración ${index}/${overrides.length} · ${mb} de ${(total / 1048576).toFixed(0)} MB`
            : `Descargando configuración ${index}/${overrides.length} · ${mb} MB`
        )
      }
    })

    sendStatus(`Aplicando configuración ${index}/${overrides.length}...`)
    try {
      await extractArchive(archive, instanceDir())
    } catch (error) {
      throw new Error(
        `No se pudo aplicar ${part.name}: ${(error as Error).message}\n\n` +
          'Si el antivirus está bloqueando la carpeta del launcher, añádela a las excepciones.'
      )
    }

    rmSync(archive, { force: true })
    parts[part.name] = part.sha1
    changed = true
    persist({ ...parts })
  }

  return { changed, parts }
}

/**
 * Instala lo que va una sola vez: hoy, el mapa de la ciudad ya explorado.
 *
 * ## Se salta si el destino existe, y esa es toda la regla
 *
 * No compara hashes ni versiones. Si la carpeta esta, el jugador ya jugo: lo que
 * tenga adentro es su exploracion y vale mas que la nuestra. Bajar y pisar seria
 * borrarle el mapa que se hizo caminando, que es exactamente lo que este
 * mecanismo existe para no hacer.
 *
 * ## Falla blando
 *
 * Si la descarga falla, se sigue. Un mapa que arranca negro es una molestia; un
 * launcher que no deja jugar porque no pudo bajar una comodidad, no.
 */
async function sembrar(siembra: ManifestSeed[]): Promise<void> {
  for (const semilla of siembra) {
    const destino = join(instanceDir(), semilla.destino)
    if (existsSync(destino)) {
      continue
    }
    const archivo = join(launcherRoot(), 'overrides', `siembra-${semilla.sha1}.zip`)
    try {
      sendStatus(`Descargando ${semilla.nombre}...`)
      await downloadVerified(semilla.url, archivo, {
        expected: semilla.sha1,
        algo: 'sha1',
        label: semilla.nombre
      })
      sendStatus(`Instalando ${semilla.nombre}...`)
      await extractArchive(archivo, instanceDir())
    } catch {
      // A proposito en silencio: no es un error del jugador y no puede hacer
      // nada al respecto. Se reintenta solo en el proximo arranque, porque la
      // condicion sigue siendo que el destino no exista.
    } finally {
      rmSync(archivo, { force: true })
    }
  }
}

/** Resource pack that carries the Victoria menu and textures. */
const VICTORIA_RESOURCE_PACK = 'file/Victoria - RP.zip'

/**
 * Turns the Victoria resource pack on without touching anything else in
 * options.txt.
 *
 * options.txt is the player's own file — keybinds, video settings, volumes —
 * so it is edited surgically rather than shipped in the overrides archive. If
 * they deliberately removed the pack this puts it back, which is the point:
 * the server's menu and textures are meant to be on.
 *
 * Exportada sólo para poder probarla. Es la única pieza del sync que ya se
 * rompió dos veces sin que nadie lo notara —una porque corría dentro de un `if`
 * que casi nunca era cierto, otra porque no reponía `vanilla`— y las dos veces
 * el síntoma fue la interfaz del juego en cajitas, que no apunta a esto ni de
 * lejos. Ver `tests/resource-pack.test.ts`.
 */
export function ensureResourcePack(): void {
  const path = join(instanceDir(), 'options.txt')

  try {
    // A fresh instance has no options.txt until Minecraft has run once, so
    // returning early here meant every new player got the pack downloaded but
    // never switched on. Writing just this line is enough: the game fills in
    // every other setting on first launch and leaves this one alone.
    if (!existsSync(path)) {
      mkdirSync(instanceDir(), { recursive: true })
      writeFileSync(path, `resourcePacks:["vanilla","${VICTORIA_RESOURCE_PACK}"]\n`, 'utf8')
      return
    }

    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    const index = lines.findIndex((line) => line.startsWith('resourcePacks:'))
    if (index === -1) {
      lines.push(`resourcePacks:["vanilla","${VICTORIA_RESOURCE_PACK}"]`)
      writeFileSync(path, lines.join('\n'), 'utf8')
      return
    }

    const raw = lines[index].slice('resourcePacks:'.length)
    const packs = JSON.parse(raw) as string[]
    if (packs.includes(VICTORIA_RESOURCE_PACK)) return

    // 🔴 Tambien hay que reponer "vanilla", y el motivo no es cosmetico.
    //
    // Cuando la config de un mod no parsea durante una recarga de recursos,
    // Minecraft responde `Caught error loading resourcepacks, removing all
    // selected resourcepacks` y deja la linea en `resourcePacks:[]` — VACIA, sin
    // vanilla. Paso de verdad con un `.toml` que tenia una coma de mas, y dejo
    // la interfaz de todos los jugadores dibujada en cajitas.
    //
    // Agregar solo el pack de Victoria sobre una lista vacia deja un orden que
    // el juego nunca escribe. Reponer vanilla primero devuelve exactamente el
    // estado normal, que es lo que se quiere despues de un accidente.
    if (!packs.includes('vanilla')) packs.unshift('vanilla')

    packs.push(VICTORIA_RESOURCE_PACK)
    lines[index] = `resourcePacks:${JSON.stringify(packs)}`
    writeFileSync(path, lines.join('\n'), 'utf8')
  } catch {
    // A malformed options.txt is the game's problem, not something to crash the
    // install over. The pack simply stays off until the player enables it.
  }
}

export interface SyncCheck {
  /** True only when we know an update is pending. */
  needsUpdate: boolean
  /** No modpack is published, so there is nothing to enforce. */
  unavailable: boolean
  toDownload: number
  toRemove: number
  installedVersion: string | null
  latestVersion: string | null
}

/**
 * Works out whether the pack is behind WITHOUT downloading anything, so the
 * launcher can gate the play button on it.
 *
 * Every failure path returns `unavailable` rather than `needsUpdate`. If the
 * manifest is unreachable — no modpack published yet, GitHub down, no internet —
 * the player must still be able to play. Blocking on a network error would take
 * the whole server offline for everyone the moment the host has a hiccup.
 */
export async function checkForUpdates(): Promise<SyncCheck> {
  const state = loadState()
  const base: SyncCheck = {
    needsUpdate: false,
    unavailable: true,
    toDownload: 0,
    toRemove: 0,
    installedVersion: state.packVersion,
    latestVersion: null
  }

  if (!MANIFEST_URL) return base

  try {
    const manifest = await fetchManifest()
    const plan = planSync({
      manifest,
      local: await scanLocal(),
      managed: state.managed,
      enabledOptional: state.enabledOptional
    })

    const overridesStale =
      manifest.overrides !== undefined &&
      overridesFingerprint(manifest.overrides) !== state.overridesSha1

    // A version we have not recorded yet still needs a sync even when every
    // file already matches. Running it writes modpack-state.json, which is what
    // marks these jars as the pack's rather than the player's — and until that
    // exists the launcher can never remove a mod dropped from a later manifest,
    // because the deletion rule only ever touches files it installed itself.
    const versionUnrecorded = state.packVersion !== manifest.packVersion

    return {
      needsUpdate: !plan.upToDate || overridesStale || versionUnrecorded,
      unavailable: false,
      toDownload: plan.download.length,
      toRemove: plan.remove.length,
      installedVersion: state.packVersion,
      latestVersion: manifest.packVersion
    }
  } catch {
    return base
  }
}

export interface SyncReport {
  upToDate: boolean
  downloaded: number
  removed: number
  keptOwn: string[]
  packVersion: string
}

/**
 * Creates the instance folder up front and turns a permission failure into
 * something a player can act on. Raw "EPERM: operation not permitted, mkdir"
 * with a path in it tells them nothing about what to do.
 */
function ensureInstanceDir(): void {
  const dir = instanceDir()
  try {
    mkdirSync(dir, { recursive: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EPERM' || code === 'EACCES') {
      throw new Error(
        `El launcher no tiene permiso para crear su carpeta en:\n${dir}\n\n` +
          'Suele ser el antivirus bloqueándolo. Añade esa carpeta a las excepciones ' +
          'y vuelve a intentarlo.'
      )
    }
    throw error
  }
}

async function performSync(): Promise<SyncReport> {
  sendStatus('Comprobando actualizaciones...')
  ensureInstanceDir()

  const manifest = await fetchManifest()
  const state = loadState()
  const plan = planSync({
    manifest,
    local: await scanLocal(),
    managed: state.managed,
    enabledOptional: state.enabledOptional
  })

  const total = plan.download.length
  let done = 0

  // The manifest already told us each jar's sha1, so recording it as we go
  // spares the check that runs the moment this finishes from re-reading every
  // file we just wrote — 425 MB on a first install.
  const cache = loadHashCache()

  for (const mod of plan.download) {
    sendStatus(`Descargando ${mod.filename}`)
    await downloadMod(mod)
    try {
      const stat = statSync(join(modsDir(), mod.filename))
      cache[mod.filename] = { size: stat.size, mtimeMs: stat.mtimeMs, sha1: mod.sha1 }
    } catch {
      // Only the cache; the file itself was already verified by the download.
    }
    done += 1
    sendProgress(done, total)
  }

  for (const filename of plan.remove) {
    rmSync(join(modsDir(), filename), { force: true })
    delete cache[filename]
  }

  if (plan.download.length > 0 || plan.remove.length > 0) saveHashCache(cache)

  let overridesApplied = false
  let overrideParts = state.overrideParts
  if (manifest.overrides) {
    const result = await applyOverrides(manifest.overrides, state, (parts) => {
      // Only the parts move. packVersion and the managed list must not advance
      // until the whole sync finishes, or an interrupted run would leave the
      // launcher believing it is up to date when it is not.
      saveState({ ...loadState(), overrideParts: parts })
    })
    overridesApplied = result.changed
    overrideParts = result.parts
    if (overridesApplied) {
      // The archives just put every shipped shaderpack back on disk; take out
      // again the ones the player deleted.
      pruneDeletedShaders()
    }
  }

  // 🔴 EL PACK SE VUELVE A ACTIVAR EN CADA SYNC, no sólo cuando cambian los
  // overrides.
  //
  // Estaba adentro del `if (overridesApplied)`, y ahí el pack podía quedar
  // apagado PARA SIEMPRE: los overrides sólo cambian cuando se publica una
  // versión que los toca — y una actualización de jars no los toca — así que si
  // `options.txt` perdía la línea por cualquier motivo, el launcher no la volvía
  // a escribir nunca. Se encontró así, con `resourcePacks:[]` en una instancia
  // que llevaba varias actualizaciones sin overrides nuevos.
  //
  // Ponerlo afuera no cuesta nada: la función edita `options.txt` de forma
  // quirúrgica y es idempotente, así que correrla siempre es una lectura y, casi
  // siempre, ninguna escritura.
  ensureResourcePack()

  // La siembra va DESPUES de los overrides y antes de guardar el estado: los
  // overrides crean la instancia, asi que sembrar antes escribiria en carpetas
  // que un instante despues se pisan.
  if (manifest.siembra) {
    await sembrar(manifest.siembra)
  }

  saveState({
    managed: nextManagedList(plan, manifest, state.managed),
    enabledOptional: state.enabledOptional,
    packVersion: manifest.packVersion,
    overrideParts,
    overridesSha1: manifest.overrides
      ? overridesFingerprint(manifest.overrides)
      : state.overridesSha1
  })

  const report: SyncReport = {
    upToDate: plan.upToDate,
    downloaded: plan.download.length,
    removed: plan.remove.length,
    keptOwn: plan.keep,
    packVersion: manifest.packVersion
  }
  send('sync:done', report)
  return report
}

let inFlight: Promise<SyncReport> | null = null

/**
 * Runs a sync, or joins the one already running.
 *
 * Two concurrent syncs would fight over the same files and each other's .part
 * downloads. That was reachable: leaving the Play tab mid-download lost the
 * screen's progress state, so coming back showed an idle button and a second
 * press started a second sync on top of the first.
 */
export function runSync(): Promise<SyncReport> {
  if (inFlight) return inFlight

  live = {
    running: true,
    percent: 0,
    done: 0,
    total: 0,
    message: 'Comprobando actualizaciones...'
  }

  inFlight = performSync()
    .catch((error: Error) => {
      // Broadcast as well as reject: whoever pressed PLAY may have navigated
      // away, and the screen that comes back has no promise to catch.
      send('sync:error', { message: error.message })
      throw error
    })
    .finally(() => {
      inFlight = null
      live = { ...live, running: false }
    })

  return inFlight
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:run', () => runSync())
  ipcMain.handle('sync:live', () => live)
  ipcMain.handle('sync:check', () => checkForUpdates())
  ipcMain.handle('sync:manifest', () => fetchManifest())
  ipcMain.handle('sync:state', () => loadState())
  ipcMain.handle('sync:set-optional', (_event, id: string, enabled: boolean) => {
    const state = loadState()
    const set = new Set(state.enabledOptional)
    if (enabled) set.add(id)
    else set.delete(id)
    const next = { ...state, enabledOptional: [...set] }
    saveState(next)
    return next
  })
}
