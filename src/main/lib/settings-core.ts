export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
  /** Tuned G1GC flags. On by default — the pack stutters badly without them. */
  optimizedJvm: boolean
  /**
   * Last non-premium nick. Microsoft sessions restore through their own
   * encrypted token; without this an offline player was asked to retype their
   * name on every single launch.
   */
  offlineUsername: string | null
}

// Defined once in src/preload/tuning.ts and re-exported here, because the
// Ajustes screen draws its slider marks from the same numbers and used to keep
// a hand-copied duplicate of them.
export {
  RAM_ABSOLUTE_MIN_MB,
  RAM_MIN_RECOMMENDED_MB,
  RAM_RECOMMENDED_MB,
  RAM_DIMINISHING_MB
} from '../../preload/tuning'

import { RAM_RECOMMENDED_MB } from '../../preload/tuning'

export const DEFAULT_SETTINGS: Settings = {
  maxMemoryMb: RAM_RECOMMENDED_MB,
  minMemoryMb: 2048,
  javaPath: null,
  musicEnabled: false,
  closeOnLaunch: false,
  optimizedJvm: true,
  offlineUsername: null
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
    optimizedJvm: stored.optimizedJvm ?? DEFAULT_SETTINGS.optimizedJvm,
    offlineUsername: stored.offlineUsername ?? DEFAULT_SETTINGS.offlineUsername
  }
}

/**
 * Ajuste del recolector de basura G1, pensado para el cliente.
 *
 * La instancia arrancaba sin ningún argumento de JVM, y G1 por defecto deja
 * crecer la generación joven y después lo paga con pausas largas, que se
 * sienten como tirones. Estos argumentos suben el piso de la generación joven,
 * limitan cuánto puede durar una pausa y reparten el trabajo del recolector.
 *
 * No son los flags de Aikar tal cual: esos están hechos para un servidor
 * dedicado, donde una pausa de 200 ms no se ve y la RAM de la máquina es toda
 * del juego. En el cliente las dos cosas molestan:
 *
 * - `MaxGCPauseMillis=200` permite pausas de 200 ms, que a 60 FPS son doce
 *   cuadros perdidos de un saque: el bajón clásico al girar la cámara. Con 50
 *   la pausa entra en tres cuadros y G1 recolecta más seguido a cambio.
 * - `AlwaysPreTouch` toca todo el heap al arrancar. En un servidor eso es
 *   bueno; en una PC de 16 GB con Windows, el launcher, Discord y el navegador
 *   abiertos significa dejar 7 u 8 GB ocupados de verdad desde el primer
 *   segundo, y el sistema empieza a mandar cosas al archivo de paginación. Un
 *   tirón por leer del disco dura muchísimo más que uno del recolector.
 */
export function jvmPerformanceArgs(maxMemoryMb: number): string[] {
  // Pasados los 12 GB conviene una región más grande y una generación joven más
  // holgada para que la cantidad de regiones no se dispare.
  const large = maxMemoryMb >= 12288

  return [
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=50',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    `-XX:G1NewSizePercent=${large ? 30 : 20}`,
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
    '-XX:MaxTenuringThreshold=1',
    // Forge escribe dos registros a la vez: logs/latest.log (info) y
    // logs/debug.log (todo). El segundo llegó a 24 MB en una sesión corta, y
    // 72.000 de sus líneas las escribió un solo mod en dos segundos. Escribir
    // eso frena al hilo que lo pide, que muchas veces es el del juego. Se apaga
    // el archivo de debug; latest.log queda igual, así que para diagnosticar un
    // problema no se pierde nada.
    '-Dforge.logging.debugFile.level=off'
  ]
}
