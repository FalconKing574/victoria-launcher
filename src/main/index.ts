import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { registerWindowHandlers } from './ipc/window'
import { registerAuthHandlers } from './ipc/auth'
import { registerModHandlers } from './ipc/mods'
import { registerLaunchHandlers } from './ipc/launch'
import { registerSyncHandlers } from './ipc/sync'
import { registerUpdaterHandlers } from './ipc/updater'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { crashLogPath } from './lib/paths'

/**
 * Appends to a log next to the app's data. A packaged Electron app has no
 * console attached, so without this every startup failure is invisible.
 */
function logCrash(what: string, detail: string): void {
  const line = `[${new Date().toISOString()}] ${what}\n${detail}\n\n`
  try {
    appendFileSync(crashLogPath(), line, 'utf8')
  } catch {
    // Logging must never be the thing that takes the app down.
  }
}

function reportFatal(what: string, detail: string): void {
  logCrash(what, detail)
  dialog.showErrorBox(
    'Victoria Kingdom se ha cerrado',
    `${what}\n\n${detail}\n\nDetalles guardados en:\n${crashLogPath()}`
  )
}

process.on('uncaughtException', (error) => {
  reportFatal('Error inesperado en el launcher.', error.stack ?? String(error))
  app.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logCrash('Promesa rechazada sin gestionar.', String(reason))
})

/**
 * Electron grants several permissions to renderer content by default. The
 * launcher never needs the camera, the microphone, the user's location or
 * notifications, and a request for any of them can only come from something
 * that has no business asking — so deny the lot rather than let Windows show
 * the user a prompt the launcher cannot justify.
 */
function lockDownPermissions(win: BrowserWindow): void {
  const ALLOWED = new Set(['fullscreen'])

  win.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED.has(permission))
  })

  win.webContents.session.setPermissionCheckHandler((_contents, permission) =>
    ALLOWED.has(permission)
  )

  // Blocks getUserMedia outright, which is what triggers the camera and
  // microphone prompts, without relying on the permission handler alone.
  win.webContents.session.setDisplayMediaRequestHandler?.((_request, callback) => {
    callback({})
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // A window created with show:false that never receives ready-to-show becomes
  // an invisible process holding the single-instance lock: window-all-closed
  // never fires because the window is hidden, not closed, so the app never
  // quits, and every later launch dies instantly against the lock. Showing it
  // regardless after a timeout means the launcher can always be seen and closed.
  const showTimer = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      logCrash(
        'La ventana tardó demasiado en estar lista.',
        'ready-to-show no llegó en 12s; se muestra igualmente.'
      )
      win.show()
    }
  }, 12000)

  win.on('ready-to-show', () => {
    clearTimeout(showTimer)
    win.show()
  })

  win.on('closed', () => clearTimeout(showTimer))

  lockDownPermissions(win)

  // A renderer crash destroys the window, which fires window-all-closed, which
  // quits the app. Without this the launcher just vanishes mid-startup with no
  // explanation — exactly the failure this handler exists to make visible.
  win.webContents.on('render-process-gone', (_event, details) => {
    reportFatal(
      'La interfaz del launcher se ha cerrado de forma inesperada.',
      `Motivo: ${details.reason}${details.exitCode ? ` (código ${details.exitCode})` : ''}`
    )
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    // A failed subresource fires this too; only a failed main frame is fatal.
    if (url && !url.startsWith('devtools')) {
      logCrash('No se pudo cargar la interfaz.', `${errorCode} ${errorDescription} — ${url}`)
    }
  })

  win.webContents.on('unresponsive', () => {
    logCrash('La interfaz dejó de responder.', 'render process unresponsive')
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:save', (_event, patch: Partial<Settings>) => saveSettings(patch))
}

// app.quit() is asynchronous and does NOT stop execution, so the whole startup
// has to sit inside the else branch. Getting this wrong meant a leftover
// instance holding the lock let a second launch build a window and then die —
// the app appearing to open and immediately close.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    registerWindowHandlers()
    registerAuthHandlers()
    registerModHandlers()
    registerLaunchHandlers()
    registerSyncHandlers()
    registerUpdaterHandlers()
    registerSettingsHandlers()

    const win = createWindow()

    app.on('second-instance', () => {
      // show() must come first and unconditionally: a window hidden by
      // closeOnLaunch, or one that never reached ready-to-show, is NOT
      // minimised, so restore() alone left the launcher permanently invisible
      // while its process kept the lock and killed every new launch.
      if (win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
