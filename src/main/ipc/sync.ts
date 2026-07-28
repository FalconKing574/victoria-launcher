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
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { INSTANCE_DIR, MANIFEST_URL } from '../config'
import { syncStatePath } from '../lib/paths'
import {
  planSync,
  nextManagedList,
  type Manifest,
  type LocalMod,
  type ManifestMod
} from '../lib/sync-plan'

interface SyncState {
  managed: string[]
  enabledOptional: string[]
  packVersion: string | null
}

const EMPTY_STATE: SyncState = { managed: [], enabledOptional: [], packVersion: null }

function modsDir(): string {
  return join(INSTANCE_DIR, 'mods')
}

function loadState(): SyncState {
  if (!existsSync(syncStatePath())) return EMPTY_STATE
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

    return {
      needsUpdate: !plan.upToDate,
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

export async function runSync(): Promise<SyncReport> {
  send('sync:status', { message: 'Comprobando actualizaciones...' })

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

  saveState({
    managed: nextManagedList(plan, manifest, state.managed),
    enabledOptional: state.enabledOptional,
    packVersion: manifest.packVersion
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
