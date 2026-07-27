import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, createWriteStream, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { Client, Authenticator } from 'minecraft-launcher-core'
import type { ILauncherOptions, IUser } from 'minecraft-launcher-core'
import { INSTANCE_DIR, MC_VERSION, FORGE_VERSION, FORGE_INSTALLER_URL } from '../config'
import { launcherRoot } from '../lib/paths'
import { detectJava } from '../lib/java'
import { loadSettings } from '../lib/settings'
import { jvmPerformanceArgs } from '../lib/settings-core'
import { offlineUuid } from '../lib/offline-uuid'

export interface LaunchRequest {
  /** Premium sessions pass the MCLC user object produced by msmc. */
  mclcUser?: IUser
  /** Custom accounts pass their nick; MCLC builds an offline user from it. */
  offlineUsername?: string
}

let running = false

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
      authorization = request.mclcUser
    } else {
      const name = request.offlineUsername as string
      // MCLC invents a random UUID for offline users. An offline-mode server
      // derives it from the name instead, so override it to keep the client and
      // the server agreeing on who this player is.
      authorization = { ...(await Authenticator.getAuth(name)), uuid: offlineUuid(name) }
    }

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
      send('launch:closed', { code })
    })

    const options: ILauncherOptions = {
      authorization,
      root: launcherRoot(),
      forge: forgePath,
      javaPath: detectJava(settings.javaPath),
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
        // Reuse the CurseForge instance so its mods, config and saves apply.
        gameDirectory: INSTANCE_DIR,
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
      throw new Error('No se pudo iniciar Minecraft. Revisa la ruta de Java en Ajustes.')
    }

    send('launch:status', { stage: 'running', message: 'Minecraft en ejecución' })

    if (settings.closeOnLaunch) {
      for (const win of BrowserWindow.getAllWindows()) win.hide()
    }
  } catch (error) {
    running = false
    send('launch:error', { message: (error as Error).message })
    throw error
  }
}

export function registerLaunchHandlers(): void {
  ipcMain.handle('launch:start', (_event, request: LaunchRequest) => launchGame(request))
  ipcMain.handle('launch:is-running', () => running)
}
