import type { IUser } from 'minecraft-launcher-core'

export interface PremiumSession {
  name: string
  uuid: string
  mcToken: string
  mclc: IUser
}

export interface OptionalMod {
  id: string
  name: string
  summary: string
  category: 'rendimiento' | 'calidad-de-vida' | 'visual'
  filename: string
  sizeBytes: number
  image?: string
}

export interface Manifest {
  packVersion: string
  minecraft: string
  forge: string
  mods: Array<{ filename: string; sizeBytes: number }>
  optional: OptionalMod[]
}

/**
 * What `modpack.state()` actually returns. `overridesSha1` and `overrideParts`
 * were missing here after the overrides were split into several archives, so
 * the renderer's view of the state silently stopped matching the main process's.
 * Nothing broke because no screen reads them, but the next one to try would
 * have got a type error for a field that is really there.
 */
export interface SyncState {
  managed: string[]
  enabledOptional: string[]
  packVersion: string | null
  overridesSha1: string | null
  overrideParts: Record<string, string>
}

export interface SyncCheck {
  needsUpdate: boolean
  unavailable: boolean
  toDownload: number
  toRemove: number
  installedVersion: string | null
  latestVersion: string | null
}

export type UpdaterPhase =
  | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error' | 'dev'

export interface UpdaterState {
  phase: UpdaterPhase
  version: string | null
  percent: number
  message: string | null
}

export interface SyncLive {
  running: boolean
  percent: number
  done: number
  total: number
  message: string | null
}

export interface SyncReport {
  upToDate: boolean
  downloaded: number
  removed: number
  keptOwn: string[]
  packVersion: string
}

export interface ShaderPack {
  filename: string
  name: string
  sizeBytes: number
}

export interface RemovedShaderPack extends ShaderPack {
  /** True when the archive was kept, so restoring it is instant. */
  restorable: boolean
}

export interface ShaderSettings {
  enabled: boolean
  selected: string | null
  packs: ShaderPack[]
  /** Removed by the player. Empty in the normal case. */
  removed: RemovedShaderPack[]
  installed: boolean
}

export interface ModEntry {
  filename: string
  name: string
  enabled: boolean
  sizeBytes: number
}

export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
  optimizedJvm: boolean
  offlineUsername: string | null
}

export interface LaunchProgress {
  type: string
  percent: number
}

export interface LaunchStatus {
  stage: 'java' | 'forge' | 'download' | 'starting' | 'running'
  message: string
}

export interface VictoriaApi {
  window: {
    minimize(): void
    maximize(): void
    close(): void
    openExternal(url: string): Promise<void>
  }
  auth: {
    microsoftLogin(): Promise<PremiumSession>
    microsoftRestore(): Promise<PremiumSession | null>
    microsoftLogout(): Promise<boolean>
  }
  mods: {
    list(): Promise<ModEntry[]>
    toggle(filename: string, enable: boolean): Promise<ModEntry[]>
  }
  modpack: {
    sync(): Promise<SyncReport>
    check(): Promise<SyncCheck>
    manifest(): Promise<Manifest>
    state(): Promise<SyncState>
    setOptional(id: string, enabled: boolean): Promise<SyncState>
    live(): Promise<SyncLive>
    onStatus(cb: (status: { message: string }) => void): () => void
    onProgress(cb: (p: { percent: number; done: number; total: number }) => void): () => void
    onDone(cb: (report: SyncReport) => void): () => void
    onError(cb: (error: { message: string }) => void): () => void
  }
  shaders: {
    get(): Promise<ShaderSettings>
    setEnabled(enabled: boolean): Promise<ShaderSettings>
    select(filename: string): Promise<ShaderSettings>
    delete(filename: string): Promise<ShaderSettings>
    restore(filename: string): Promise<ShaderSettings>
  }
  updater: {
    check(): Promise<UpdaterState>
    state(): Promise<UpdaterState>
    install(): Promise<boolean>
    onState(cb: (state: UpdaterState) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    save(patch: Partial<Settings>): Promise<Settings>
  }
  launch: {
    start(request: { mclcUser?: IUser; offlineUsername?: string }): Promise<void>
    isRunning(): Promise<boolean>
    onProgress(cb: (progress: LaunchProgress) => void): () => void
    onStatus(cb: (status: LaunchStatus) => void): () => void
    onError(cb: (error: { message: string }) => void): () => void
    onClosed(cb: (info: { code: number }) => void): () => void
  }
}

declare global {
  interface Window {
    api: VictoriaApi
  }
}
