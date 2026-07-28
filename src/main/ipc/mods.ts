import { ipcMain } from 'electron'
import { instanceDir } from '../lib/paths'
import { scanMods, toggleMod } from '../lib/mods-core'

export function registerModHandlers(): void {
  ipcMain.handle('mods:list', () => scanMods(instanceDir()))
  ipcMain.handle('mods:toggle', (_event, filename: string, enable: boolean) => {
    toggleMod(instanceDir(), filename, enable)
    return scanMods(instanceDir())
  })
}
