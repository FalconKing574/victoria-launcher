import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { validateEnv, runtimeEnv } from './config'
import { registerWindowHandlers } from './ipc/window'
import { registerAuthHandlers } from './ipc/auth'
import { registerSupabaseHandlers } from './ipc/supabase'
import { registerModHandlers } from './ipc/mods'
import { registerLaunchHandlers } from './ipc/launch'
import { loadSettings, saveSettings, type Settings } from './lib/settings'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

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

  win.on('ready-to-show', () => win.show())

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

app.whenReady().then(() => {
  const validation = validateEnv(runtimeEnv())
  if (!validation.ok) {
    dialog.showErrorBox(
      'Configuración incompleta',
      `Faltan estas variables en tu archivo .env:\n\n${validation.missing.join('\n')}\n\n` +
        'Consulta SETUP.md para saber cómo obtenerlas.'
    )
    app.quit()
    return
  }

  registerWindowHandlers()
  registerAuthHandlers()
  registerSupabaseHandlers()
  registerModHandlers()
  registerLaunchHandlers()
  registerSettingsHandlers()

  const win = createWindow()
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore()
    win.focus()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
