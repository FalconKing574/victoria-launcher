import { app, ipcMain, BrowserWindow } from 'electron'
import updaterPkg, { type UpdateInfo } from 'electron-updater'
import { LAUNCHER_REPO } from '../config'
import { actualizacionPath } from '../lib/paths'
import {
  borrarIntento,
  compararVersiones,
  diagnosticarErrorActualizacion,
  evaluarIntento,
  guardarIntento,
  leerIntento,
  registrarIntento,
  urlDescargaManual
} from '../lib/actualizacion'
import { isLaunchRunning } from './launch'
import { isSyncRunning } from './sync'

// electron-updater ships CommonJS, so the named export is not reachable through
// an ESM import specifier.
const { autoUpdater } = updaterPkg

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'none'
  | 'error'
  | 'blocked'
  | 'dev'

export interface UpdaterState {
  phase: UpdaterPhase
  /** La versión nueva cuando hay una; la instalada cuando no. */
  version: string | null
  /** La versión instalada ahora mismo. */
  current: string
  percent: number
  message: string | null
  /** El instalador completo de la versión nueva, para bajarlo con el navegador. */
  manualUrl: string | null
  /** El fallo parece del antivirus: la interfaz explica qué hacer. */
  antivirus: boolean
}

let state: UpdaterState = {
  phase: 'idle',
  version: null,
  current: app.getVersion(),
  percent: 0,
  message: null,
  manualUrl: null,
  antivirus: false
}

/**
 * Qué hacer cuando la actualización termina de bajar.
 *
 * - `arranque`: el jugador sigue en la pantalla de carga y todavía no empezó
 *   nada. Se instala en el acto, sin asistente, y el launcher se vuelve a abrir
 *   solo. La pantalla de carga lo va contando.
 * - `fondo`: ya está usando el launcher. Se instala al cerrarlo
 *   (`autoInstallOnAppQuit`) o cuando pulsa «Reiniciar ahora».
 *
 * Antes no había diferencia: en cuanto terminaba de bajar se reiniciaba solo, en
 * medio de lo que el jugador estuviera haciendo —crear la cuenta, vincular
 * Discord—, y encima volvía a salir el asistente del instalador. Era el «vuelve
 * a la etapa de instalación» que reportaban.
 *
 * La pantalla de carga pasa a `fondo` (`updater:posponer`) al salir.
 */
let modo: 'arranque' | 'fondo' = 'arranque'
let instalando = false

/** Una versión que ya falló MAX_INTENTOS_AUTOMATICOS veces: no se instala sola. */
let versionBloqueada: string | null = null
/** Una versión cuyo último intento no se completó, pero que todavía se reintenta sola. */
let versionReintento: string | null = null
/** Si lo que hay que instalar ya está entero en disco. */
let descargada = false

function esBloqueada(version: string): boolean {
  return versionBloqueada !== null && compararVersiones(versionBloqueada, version) === 0
}

function push(next: Partial<UpdaterState>): void {
  state = { ...state, ...next }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:state', state)
  }
}

function manualUrlDe(info: UpdateInfo): string | null {
  const archivo = info.files?.[0]?.url ?? info.path
  if (!archivo) return null
  return /^https?:\/\//i.test(archivo)
    ? archivo
    : urlDescargaManual(LAUNCHER_REPO, info.version, archivo)
}

function mensajeBloqueada(version: string): string {
  return (
    `La versión ${version} del launcher no se pudo instalar después de varios intentos. ` +
    'Casi siempre es el antivirus bloqueando el instalador. Puedes seguir jugando con esta versión.'
  )
}

/**
 * Lo que pasó con el último instalador que se abrió. Si la versión no cambió,
 * no llegó a instalarse. Ver `lib/actualizacion.ts`.
 */
function revisarIntentoAnterior(): void {
  const ruta = actualizacionPath()
  const resultado = evaluarIntento(leerIntento(ruta), app.getVersion())
  if (resultado.estado === 'instalada') {
    try {
      borrarIntento(ruta)
    } catch {
      // Queda un registro viejo que la próxima apertura vuelve a dar por instalado.
    }
    return
  }
  if (resultado.estado === 'fallida') {
    if (resultado.bloqueada) versionBloqueada = resultado.version
    else versionReintento = resultado.version
  }
}

/**
 * Cierra el launcher y abre el instalador de la versión nueva, sin asistente.
 * El instalador vuelve a abrir el launcher al terminar.
 *
 * No corta una descarga del modpack ni un arranque de Minecraft: dejaría medio
 * pack en disco o mataría el juego. En ese caso se instala al cerrar.
 */
function instalar(): boolean {
  if (instalando) return true
  if (!state.version || !descargada) return false
  if (isLaunchRunning() || isSyncRunning()) return false

  instalando = true
  const faseAnterior = state.phase
  const reintento =
    versionReintento !== null && compararVersiones(versionReintento, state.version) === 0
  const ruta = actualizacionPath()
  try {
    guardarIntento(
      ruta,
      registrarIntento(leerIntento(ruta), state.version, app.getVersion(), new Date())
    )
  } catch {
    // Sin el registro sólo se pierde el freno contra el ciclo; se instala igual.
  }
  push({
    phase: 'installing',
    percent: 100,
    message: reintento
      ? 'El intento anterior no se completó. Si tu antivirus pregunta, permite «Victoria Kingdom».'
      : null,
    antivirus: false
  })

  // La pausa deja que la interfaz pinte «Instalando»: la ventana cerrándose sola
  // tiene que leerse como una actualización y no como un cierre inesperado. Más
  // larga si el launcher acaba de abrir: con la actualización ya bajada de antes,
  // esto llega antes de que la ventana termine de mostrarse.
  const pausa = Math.max(1500, 3500 - process.uptime() * 1000)
  setTimeout(() => {
    // Otra vez: el jugador pudo pulsar JUGAR en la pausa.
    if (isLaunchRunning() || isSyncRunning()) {
      instalando = false
      push({ phase: faseAnterior })
      return
    }
    // isSilent: sin asistente. isForceRunAfter: el launcher se vuelve a abrir.
    // El instalador nuevo además se pone en silencio solo con --updated
    // (build/installer.nsh), que es lo que cubre a los launchers viejos que
    // todavía lo abren sin /S.
    autoUpdater.quitAndInstall(true, true)
  }, pausa)
  return true
}

export function registerUpdaterHandlers(): void {
  // There is no app-update.yml outside a packaged build, so checking throws.
  // Reporting 'dev' keeps the UI honest instead of showing a fake error.
  if (!app.isPackaged) {
    state = { ...state, phase: 'dev', version: app.getVersion() }
    ipcMain.handle('updater:check', () => state)
    ipcMain.handle('updater:install', () => false)
    ipcMain.handle('updater:state', () => state)
    ipcMain.handle('updater:posponer', () => state)
    return
  }

  revisarIntentoAnterior()

  autoUpdater.autoDownload = true
  // Quien cierra el launcher con una actualización ya bajada la recibe al
  // cerrarlo, en silencio: electron-updater instala con /S y sin reabrir.
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () =>
    push({ phase: 'checking', message: null, antivirus: false })
  )

  autoUpdater.on('update-available', (info) => {
    descargada = false
    const manualUrl = manualUrlDe(info)
    if (esBloqueada(info.version)) {
      // Una versión que ya se sabe que no se puede instalar no retiene a nadie en
      // la pantalla de carga: se baja por detrás, para que Reintentar funcione.
      push({
        phase: 'blocked',
        version: info.version,
        percent: 0,
        message: mensajeBloqueada(info.version),
        manualUrl,
        antivirus: true
      })
      return
    }
    push({ phase: 'available', version: info.version, percent: 0, message: null, manualUrl })
  })

  autoUpdater.on('update-not-available', () =>
    push({ phase: 'none', version: app.getVersion(), percent: 0, message: null, manualUrl: null })
  )

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent)
    push(state.phase === 'blocked' ? { percent } : { phase: 'downloading', percent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    descargada = true
    const manualUrl = manualUrlDe(info)
    if (esBloqueada(info.version)) {
      push({
        phase: 'blocked',
        version: info.version,
        percent: 100,
        message: mensajeBloqueada(info.version),
        manualUrl,
        antivirus: true
      })
      return
    }
    push({ phase: 'ready', version: info.version, percent: 100, message: null, manualUrl })
    if (modo === 'arranque') instalar()
  })

  autoUpdater.on('error', (error) => {
    // Never fatal: a launcher that cannot reach GitHub must still start the game.
    instalando = false
    const { mensaje, antivirus } = diagnosticarErrorActualizacion(error)
    push({ phase: 'error', message: mensaje, antivirus })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      const { mensaje, antivirus } = diagnosticarErrorActualizacion(error)
      push({ phase: 'error', message: mensaje, antivirus })
    }
    return state
  })

  ipcMain.handle('updater:state', () => state)

  // «Reiniciar ahora», o «Reintentar» después de un bloqueo.
  ipcMain.handle('updater:install', () => {
    if (state.phase !== 'ready' && state.phase !== 'blocked') return false
    return instalar()
  })

  ipcMain.handle('updater:posponer', () => {
    modo = 'fondo'
    return state
  })

  // Enseguida, no a los 4 segundos como antes: la pantalla de carga espera esta
  // respuesta para saber si actualizar antes de entrar.
  void autoUpdater.checkForUpdates().catch(() => undefined)
}
