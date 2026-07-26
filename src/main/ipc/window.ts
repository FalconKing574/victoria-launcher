import { ipcMain, BrowserWindow, shell } from 'electron'

export function registerWindowHandlers(): void {
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    // Only ever hand http(s) links to the OS browser.
    if (!/^https?:\/\//i.test(url)) throw new Error('URL no permitida')
    return shell.openExternal(url)
  })
}
