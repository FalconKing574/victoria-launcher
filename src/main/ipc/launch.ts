import { ipcMain, BrowserWindow } from 'electron'
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { Client, Authenticator } from 'minecraft-launcher-core'
import type { ILauncherOptions, IUser } from 'minecraft-launcher-core'
import { MC_VERSION, FORGE_VERSION, FORGE_INSTALLER_URL } from '../config'
import { launcherRoot, instanceDir } from '../lib/paths'
import { ensureJava } from '../lib/java-runtime'
import { loadSettings } from '../lib/settings'
import { jvmPerformanceArgs } from '../lib/settings-core'
import { offlineUuid } from '../lib/offline-uuid'
import { summarizeCrashReport, describeCrash, lastErrorInLog } from '../lib/crash-report'
import { restoreMicrosoft } from './auth'

export interface LaunchRequest {
  /** Premium sessions pass the MCLC user object produced by msmc. */
  mclcUser?: IUser
  /** Custom accounts pass their nick; MCLC builds an offline user from it. */
  offlineUsername?: string
}

let running = false

/** El archivo más reciente de una carpeta, o null si no hay ninguno. */
function newestFile(dir: string, filter: (name: string) => boolean): string | null {
  if (!existsSync(dir)) return null
  try {
    const candidatos = readdirSync(dir)
      .filter(filter)
      .map((name) => {
        const path = join(dir, name)
        return { path, mtime: statSync(path).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
    return candidatos[0]?.path ?? null
  } catch {
    return null
  }
}

export interface CrashDiagnosis {
  /** Lo que se le enseña al jugador. */
  message: string
  /** Dónde está el archivo, para poder mandarlo. */
  file: string | null
}

/**
 * Averigua por qué se cerró el juego, en vez de culpar a la memoria.
 *
 * El mensaje era siempre «Minecraft se cerró con el código N. Revisa la memoria
 * y la ruta de Java en Ajustes.» Casi nunca es eso, y manda al jugador a
 * cambiar cosas que no tienen la culpa — mientras Minecraft ha dejado, en la
 * carpeta de al lado, un archivo que dice exactamente qué pasó y qué mod estaba
 * en la pila. Leerlo cuesta unos milisegundos y convierte «se cerró con el
 * código 1» en algo que alguien puede arreglar.
 */
function diagnoseCrash(): CrashDiagnosis | null {
  const desde = Date.now() - 5 * 60 * 1000

  const reporte = newestFile(join(instanceDir(), 'crash-reports'), (name) =>
    name.toLowerCase().endsWith('.txt')
  )
  if (reporte) {
    try {
      // Solo si es de este arranque: uno de hace semanas explicaría otra cosa.
      if (statSync(reporte).mtimeMs >= desde) {
        const texto = describeCrash(summarizeCrashReport(readFileSync(reporte, 'utf8')))
        if (texto) return { message: texto, file: reporte }
      }
    } catch {
      // Ilegible: se sigue con el log.
    }
  }

  // Sin crash report — una caída del driver de vídeo o un proceso matado no
  // dejan ninguno — el final del log todavía suele decir algo.
  const log = join(instanceDir(), 'logs', 'latest.log')
  try {
    if (existsSync(log) && statSync(log).mtimeMs >= desde) {
      const texto = lastErrorInLog(readFileSync(log, 'utf8'))
      if (texto) return { message: texto, file: log }
    }
  } catch {
    // Nada que añadir.
  }

  return null
}

/** Lets the updater avoid restarting the app while Minecraft is starting. */
export function isLaunchRunning(): boolean {
  return running
}

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

/** Downloads the Forge installer once; MCLC handles installation from there. */
async function ensureForgeInstaller(): Promise<string> {
  const dir = join(launcherRoot(), 'forge')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`)
  if (existsSync(target)) return target

  send('launch:status', { stage: 'forge', message: 'Descargando Forge...' })
  const response = await fetch(FORGE_INSTALLER_URL)
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar Forge (HTTP ${response.status}).`)
  }

  // Download to a temp name and only publish it once complete. Writing straight
  // to `target` meant a dropped connection left a truncated jar that existsSync
  // then treated as valid on every later launch, breaking the launcher for good.
  const partial = `${target}.part`
  try {
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial))
    renameSync(partial, target)
  } catch (error) {
    rmSync(partial, { force: true })
    throw error
  }
  return target
}

export async function launchGame(request: LaunchRequest): Promise<void> {
  if (running) throw new Error('El juego ya se está iniciando.')
  running = true

  try {
    const settings = loadSettings()

    // Exactly one identity must be supplied. Without this guard an empty request
    // would pass `undefined` into Authenticator.getAuth and fail opaquely.
    if (!request.mclcUser && !request.offlineUsername) {
      throw new Error('No hay ninguna sesión con la que iniciar el juego.')
    }

    let authorization: IUser
    if (request.mclcUser) {
      // El token de Minecraft dura pocas horas, y la sesión que trae el
      // renderer se pidió una sola vez: al abrir el launcher. Con el launcher
      // abierto toda la tarde, ese token ya venció cuando el jugador aprieta
      // Jugar.
      //
      // El juego arranca igual —no valida el token al iniciar— y falla recién
      // al entrar a un servidor que pide autenticación premium, con
      // "Failed to log in: Invalid session". El propio Minecraft lo deja
      // escrito antes, en su log: "Failed to verify authentication".
      //
      // Por eso se refresca acá, a segundos de lanzar, en vez de confiar en lo
      // que se pidió al abrir. Es también lo que hace que el consejo de
      // "reiniciá el launcher" deje de ser necesario.
      const refresco = await restoreMicrosoft().catch(() => ({ status: 'expired' as const }))
      const fresca = refresco.status === 'ok' ? refresco.session : null
      if (fresca) {
        // Del refresco sólo se toma lo que caducaba. El resto se deja como
        // estaba, que es lo que MCLC ya había aceptado.
        //
        // No se copia el objeto entero a propósito: msmc y MCLC describen la
        // sesión con tipos que no encajan —msmc admite `meta.type: 'legacy'`,
        // que MCLC no conoce, y marca opcionales campos que MCLC exige—. Como
        // lo único que se venció es el token, copiar campo por campo es más
        // honesto que forzar el tipo con un cast y esperar que coincidan.
        authorization = {
          ...request.mclcUser,
          access_token: fresca.mclc.access_token,
          uuid: fresca.mclc.uuid ?? request.mclcUser.uuid,
          name: fresca.mclc.name ?? request.mclcUser.name
        }
      } else {
        // Si el refresh falla se intenta igual con lo que había: puede que el
        // token siga vivo y que lo que falló sea la red. Negarse a lanzar
        // sería peor que dejarlo probar.
        authorization = request.mclcUser
        // Se reusa la etapa 'starting' en vez de inventar una: los estados que
        // acepta el renderer están declarados en preload/api.d.ts y agregar uno
        // significa que la pantalla no sabría dibujarlo.
        send('launch:status', {
          stage: 'starting',
          message: 'No se pudo renovar la sesión de Microsoft; se intenta con la anterior.'
        })
      }
    } else {
      const name = request.offlineUsername as string
      // MCLC invents a random UUID for offline users. An offline-mode server
      // derives it from the name instead, so override it to keep the client and
      // the server agreeing on who this player is.
      authorization = { ...(await Authenticator.getAuth(name)), uuid: offlineUuid(name) }
    }

    // Installs a JRE if this PC has none. Must happen before Forge: without a
    // usable Java there is nothing to install Forge with.
    const javaPath = await ensureJava(
      settings.javaPath,
      (message) => send('launch:status', { stage: 'java', message }),
      (percent) => send('launch:progress', { type: 'java', percent })
    )

    const forgePath = await ensureForgeInstaller()
    const client = new Client()

    client.on('progress', (event: { type: string; task: number; total: number }) => {
      send('launch:progress', {
        type: event.type,
        percent: event.total > 0 ? Math.round((event.task / event.total) * 100) : 0
      })
    })
    client.on('download-status', (event: { name: string }) => {
      send('launch:status', { stage: 'download', message: `Descargando ${event.name}` })
    })
    client.on('data', (line: string) => send('launch:log', String(line)))
    client.on('close', (code: number) => {
      running = false
      // Bring the launcher back when the game exits, even if it was hidden.
      for (const win of BrowserWindow.getAllWindows()) win.show()
      // Solo se busca la causa si se cerró mal: en una salida normal no hay
      // nada que diagnosticar y leer archivos sería trabajo tirado.
      send('launch:closed', { code, diagnosis: code === 0 ? null : diagnoseCrash() })
    })

    const options: ILauncherOptions = {
      authorization,
      root: launcherRoot(),
      forge: forgePath,
      javaPath,
      version: { number: MC_VERSION, type: 'release' },
      memory: {
        max: `${settings.maxMemoryMb}M`,
        min: `${settings.minMemoryMb}M`
      },
      // The instance was launching with no JVM arguments, leaving G1 on its
      // defaults. That is the usual cause of periodic stutter in a pack this
      // size, and costs nothing to fix.
      customArgs: settings.optimizedJvm ? jvmPerformanceArgs(settings.maxMemoryMb) : undefined,
      overrides: {
        // The launcher's own per-user instance, where the sync put the mods,
        // config and resource packs.
        gameDirectory: instanceDir(),
        // Must match gameDirectory. MCLC defaults the java process's working
        // directory to `root`, and Forge resolves `config/` relative to the
        // working directory rather than to --gameDir. Leaving it unset split
        // the game in two: saves and resourcepacks landed in the instance,
        // while every mod config was read from <root>/config -- so FancyMenu
        // found an empty folder and fell back to the vanilla main menu even
        // though all 28 layouts had synced correctly.
        cwd: instanceDir(),
        maxSockets: 8
      }
    }

    send('launch:status', { stage: 'starting', message: 'Iniciando Minecraft...' })
    const child = await client.launch(options)

    // MCLC resolves null when it fails to spawn the process without throwing.
    // No 'close' event follows, so `running` must be cleared here or every later
    // launch attempt is rejected with "el juego ya se está iniciando".
    if (!child) {
      running = false
      throw new Error(
        'No se pudo iniciar Minecraft.\n\n' +
          `Java usado: ${javaPath}\n\n` +
          'Si el antivirus está bloqueando esa ruta, añádela a las excepciones. ' +
          'También puedes indicar otra instalación de Java en Ajustes.'
      )
    }

    send('launch:status', { stage: 'running', message: 'Minecraft en ejecución' })

    if (settings.closeOnLaunch) {
      for (const win of BrowserWindow.getAllWindows()) win.hide()
    }
  } catch (error) {
    running = false
    // If closeOnLaunch already hid the launcher, a failure here would leave an
    // invisible process holding the single-instance lock, so the user could
    // never reopen it. Always bring it back before reporting.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.show()
    }
    send('launch:error', { message: (error as Error).message })
    throw error
  }
}

export function registerLaunchHandlers(): void {
  ipcMain.handle('launch:start', (_event, request: LaunchRequest) => launchGame(request))
  ipcMain.handle('launch:is-running', () => running)
}
