export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
  /** Tuned G1GC flags. On by default — the pack stutters badly without them. */
  optimizedJvm: boolean
}

/**
 * Sized from the real pack: 114 mods / 738 MB, including Distant Horizons,
 * Complementary shaders, Immersive Engineering, Create, Tropicraft and TACZ.
 *
 * Below MIN_RECOMMENDED the game runs but thrashes the collector. Above ~10 GB
 * it gets WORSE, not better: a larger heap means the garbage collector has more
 * to walk on each pass, so pauses get longer and show up as stutter. 8 GB is the
 * sweet spot for this pack, which is what the CurseForge instance already used.
 */
export const RAM_ABSOLUTE_MIN_MB = 4096
export const RAM_MIN_RECOMMENDED_MB = 6144
export const RAM_RECOMMENDED_MB = 8192
export const RAM_DIMINISHING_MB = 10240

export const DEFAULT_SETTINGS: Settings = {
  maxMemoryMb: RAM_RECOMMENDED_MB,
  minMemoryMb: 2048,
  javaPath: null,
  musicEnabled: false,
  closeOnLaunch: false,
  optimizedJvm: true
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
    closeOnLaunch: stored.closeOnLaunch ?? DEFAULT_SETTINGS.closeOnLaunch,
    optimizedJvm: stored.optimizedJvm ?? DEFAULT_SETTINGS.optimizedJvm
  }
}

/**
 * G1 garbage collector tuning derived from Aikar's widely used Minecraft flags.
 *
 * The instance was launching with no JVM arguments at all, which leaves G1 on
 * its defaults: it lets the young generation grow large, then pays for it with
 * long collection pauses that land as visible stutter. These raise the young-gen
 * floor, cap the pause target, and pre-touch the heap so the pauses are short
 * and even rather than rare and long.
 */
export function jvmPerformanceArgs(maxMemoryMb: number): string[] {
  // Aikar's guidance splits at 12 GB; past that a bigger region size and a more
  // aggressive young gen keep pauses in check.
  const large = maxMemoryMb >= 12288

  return [
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    `-XX:G1NewSizePercent=${large ? 40 : 30}`,
    `-XX:G1MaxNewSizePercent=${large ? 50 : 40}`,
    `-XX:G1HeapRegionSize=${large ? 16 : 8}M`,
    `-XX:G1ReservePercent=${large ? 15 : 20}`,
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    `-XX:InitiatingHeapOccupancyPercent=${large ? 20 : 15}`,
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1'
  ]
}
