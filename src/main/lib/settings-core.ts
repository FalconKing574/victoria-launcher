export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  maxMemoryMb: 8192,
  minMemoryMb: 2048,
  javaPath: null,
  musicEnabled: false,
  closeOnLaunch: false
}

const MIN_MB = 1024
const MAX_MB = 32768

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function mergeSettings(stored: Partial<Settings>): Settings {
  return {
    maxMemoryMb: clamp(stored.maxMemoryMb ?? DEFAULT_SETTINGS.maxMemoryMb, MIN_MB, MAX_MB),
    minMemoryMb: clamp(stored.minMemoryMb ?? DEFAULT_SETTINGS.minMemoryMb, 512, MAX_MB),
    javaPath: stored.javaPath ?? DEFAULT_SETTINGS.javaPath,
    musicEnabled: stored.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
    closeOnLaunch: stored.closeOnLaunch ?? DEFAULT_SETTINGS.closeOnLaunch
  }
}
