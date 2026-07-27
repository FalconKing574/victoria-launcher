import type { IUser } from 'minecraft-launcher-core'

export interface PremiumSession {
  name: string
  uuid: string
  mcToken: string
  mclc: IUser
}

export interface AccessResult {
  allowed: boolean
  reason: string
  minecraft_uuid: string | null
  minecraft_username: string | null
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
  access: {
    checkPremium(mcToken: string): Promise<AccessResult>
    checkOffline(username: string): Promise<AccessResult>
  }
  mods: {
    list(): Promise<ModEntry[]>
    toggle(filename: string, enable: boolean): Promise<ModEntry[]>
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
