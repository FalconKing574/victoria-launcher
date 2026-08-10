import { app, ipcMain, BrowserWindow } from 'electron'
import updaterPkg from 'electron-updater'
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
  | 'none'
  | 'error'
  | 'dev'

export interface UpdaterState {
  phase: UpdaterPhase
  version: string | null
  percent: number
  message: string | null
}

let state: UpdaterState = { phase: 'idle', version: null, percent: 0, message: null }

function push(next: Partial<UpdaterState>): void {
  state = { ...state, ...next }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:state', state)
  }
}

/**
 * Restarts into the new version by itself, as soon as it is safe to.
 *
 * Waiting for someone to press a button meant most players never restarted and
 * stayed behind for days. The two things it must not interrupt are a modpack
 * download, which would leave half a pack on disk, and a launch, which would
 * kill Minecraft as it starts. In either case autoInstallOnAppQuit still picks
 * it up when they close the launcher.
 *
 * The delay lets the renderer paint "reiniciando" first, so the window closing
 * on its own reads as an update rather than a crash.
 */
function installWhenIdle(): void {
  if (isLaunchRunning() || isSyncRunning()) return

  push({ message: 'Actualización lista. Reiniciando el launcher...' })

  setTimeout(() => {
    // Re-checked: the player may have pressed JUGAR during the delay.
    if (isLaunchRunning() || isSyncRunning()) return
    autoUpdater.quitAndInstall(false, true)
  }, 2000)
}

export function registerUpdaterHandlers(): void {
  // There is no app-update.yml outside a packaged build, so checking throws.
  // Reporting 'dev' keeps the UI honest instead of showing a fake error.
  if (!app.isPackaged) {
    state = { phase: 'dev', version: app.getVersion(), percent: 0, message: null }
    ipcMain.handle('updater:check', () => state)
    ipcMain.handle('updater:install', () => false)
    ipcMain.handle('updater:state', () => state)
    return
  }

  autoUpdater.autoDownload = true
  // Anyone who closes the launcher without clicking "reiniciar" still gets the
  // new version on next start, which is what makes the rollout reach everyone.
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => push({ phase: 'checking', message: null }))

  autoUpdater.on('update-available', (info) =>
    push({ phase: 'available', version: info.version, percent: 0 })
  )

  autoUpdater.on('update-not-available', () =>
    push({ phase: 'none', version: app.getVersion(), percent: 0 })
  )

  autoUpdater.on('download-progress', (progress) =>
    push({ phase: 'downloading', percent: Math.round(progress.percent) })
  )

  autoUpdater.on('update-downloaded', (info) => {
    push({ phase: 'ready', version: info.version, percent: 100 })
    installWhenIdle()
  })

  autoUpdater.on('error', (error) => {
    // Never fatal: a launcher that cannot reach GitHub must still start the game.
    push({ phase: 'error', message: error?.message ?? 'Error al buscar actualizaciones.' })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      push({ phase: 'error', message: (error as Error).message })
    }
    return state
  })

  ipcMain.handle('updater:state', () => state)

  ipcMain.handle('updater:install', () => {
    if (state.phase !== 'ready') return false
    // isSilent false so the installer shows progress; isForceRunAfter true so the
    // launcher comes back up on the new version.
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  // Check once shortly after boot rather than blocking startup on the network.
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => undefined)
  }, 4000)
}
