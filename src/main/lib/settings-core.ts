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
  const maxMemoryMb = clamp(stored.maxMemoryMb ?? DEFAULT_SETTINGS.maxMemoryMb, MIN_MB, MAX_MB)

  // The two bounds were clamped independently, so dragging the slider to its
  // 1024 MB floor while min stayed at the 2048 MB default produced
  // `-Xmx1024M -Xms2048M`. The JVM rejects that outright and exits, which the UI
  // reported as an instant, unexplained return to "JUGAR".
  const minMemoryMb = Math.min(
    clamp(stored.minMemoryMb ?? DEFAULT_SETTINGS.minMemoryMb, 512, MAX_MB),
    maxMemoryMb
  )

  return {
    maxMemoryMb,
    minMemoryMb,
    javaPath: stored.javaPath ?? DEFAULT_SETTINGS.javaPath,
    musicEnabled: stored.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
    closeOnLaunch: stored.closeOnLaunch ?? DEFAULT_SETTINGS.closeOnLaunch
  }
}
