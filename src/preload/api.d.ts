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

export interface SyncState {
  managed: string[]
  enabledOptional: string[]
  packVersion: string | null
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

export interface SyncReport {
  upToDate: boolean
  downloaded: number
  removed: number
  keptOwn: string[]
  packVersion: string
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
}

export interface LaunchProgress {
  type: string
  percent: number
}

export interface LaunchStatus {
  stage: 'forge' | 'download' | 'starting' | 'running'
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
    onStatus(cb: (status: { message: string }) => void): () => void
    onProgress(cb: (p: { percent: number; done: number; total: number }) => void): () => void
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
