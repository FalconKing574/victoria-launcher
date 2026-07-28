import { ipcMain, BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { MANIFEST_URL } from '../config'
import { launcherRoot, instanceDir } from '../lib/paths'
import { syncStatePath } from '../lib/paths'
import {
  planSync,
  nextManagedList,
  type Manifest,
  type LocalMod,
  type ManifestMod,
  overridesFingerprint,
  type ManifestOverrides
} from '../lib/sync-plan'

interface SyncState {
  managed: string[]
  enabledOptional: string[]
  packVersion: string | null
  /** sha1 of the overrides archive already extracted into the instance. */
  overridesSha1: string | null
}

const EMPTY_STATE: SyncState = {
  managed: [],
  enabledOptional: [],
  packVersion: null,
  overridesSha1: null
}

/**
 * Optional mods that start switched on. A player can still turn them off; this
 * only decides what a fresh install gets.
 */
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
  writeFileSync(syncStatePath(), JSON.stringify(state, null, 2), 'utf8')
}

function sha1(path: string): string {
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

function scanLocal(): LocalMod[] {
  const dir = modsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.jar'))
    .map((filename) => ({ filename, sha1: sha1(join(dir, filename)) }))
}

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
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
  const dir = modsDir()
  mkdirSync(dir, { recursive: true })

  const target = join(dir, mod.filename)
  const partial = `${target}.part`

  const response = await fetch(mod.url)
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar ${mod.filename} (HTTP ${response.status}).`)
  }

  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial))

  // Verify before publishing. A truncated or tampered jar that lands in mods/
  // would crash the game on launch with an error pointing nowhere useful.
  const actual = sha1(partial)
  if (actual !== mod.sha1) {
    rmSync(partial, { force: true })
    throw new Error(`${mod.filename} se descargó corrupto. Inténtalo de nuevo.`)
  }

  rmSync(target, { force: true })
  renameSync(partial, target)
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
async function applyOverrides(overrides: ManifestOverrides, state: SyncState): Promise<boolean> {
  const fingerprint = overridesFingerprint(overrides)
  if (state.overridesSha1 === fingerprint) return false

  const dir = join(launcherRoot(), 'overrides')
  mkdirSync(dir, { recursive: true })

  let index = 0
  for (const part of overrides) {
    index += 1
    send('sync:status', {
      message: `Descargando configuración ${index}/${overrides.length}...`
    })

    const archive = join(dir, part.name)
    const partial = `${archive}.part`

    const response = await fetch(part.url)
    if (!response.ok || !response.body) {
      throw new Error(`No se pudo descargar ${part.name} (HTTP ${response.status}).`)
    }

    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial))

    const actual = sha1(partial)
    if (actual !== part.sha1) {
      rmSync(partial, { force: true })
      throw new Error(`${part.name} se descargó corrupto. Inténtalo de nuevo.`)
    }
    rmSync(archive, { force: true })
    renameSync(partial, archive)

    send('sync:status', { message: `Aplicando configuración ${index}/${overrides.length}...` })
    // overwrite: the pack's settings are the source of truth for these folders.
    new AdmZip(archive).extractAllTo(instanceDir(), true)

    rmSync(archive, { force: true })
  }

  return true
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
 */
function ensureResourcePack(): void {
  const path = join(instanceDir(), 'options.txt')
  if (!existsSync(path)) return

  try {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    const index = lines.findIndex((line) => line.startsWith('resourcePacks:'))
    if (index === -1) return

    const raw = lines[index].slice('resourcePacks:'.length)
    const packs = JSON.parse(raw) as string[]
    if (packs.includes(VICTORIA_RESOURCE_PACK)) return

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
      local: scanLocal(),
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

export async function runSync(): Promise<SyncReport> {
  send('sync:status', { message: 'Comprobando actualizaciones...' })
  ensureInstanceDir()

  const manifest = await fetchManifest()
  const state = loadState()
  const plan = planSync({
    manifest,
    local: scanLocal(),
    managed: state.managed,
    enabledOptional: state.enabledOptional
  })

  const total = plan.download.length
  let done = 0

  for (const mod of plan.download) {
    send('sync:status', { message: `Descargando ${mod.filename}` })
    await downloadMod(mod)
    done += 1
    send('sync:progress', { percent: Math.round((done / total) * 100), done, total })
  }

  for (const filename of plan.remove) {
    rmSync(join(modsDir(), filename), { force: true })
  }

  let overridesApplied = false
  if (manifest.overrides) {
    overridesApplied = await applyOverrides(manifest.overrides, state)
    if (overridesApplied) ensureResourcePack()
  }

  saveState({
    managed: nextManagedList(plan, manifest, state.managed),
    enabledOptional: state.enabledOptional,
    packVersion: manifest.packVersion,
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

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:run', () => runSync())
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
