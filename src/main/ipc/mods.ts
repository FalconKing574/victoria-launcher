import { ipcMain } from 'electron'
import { INSTANCE_DIR } from '../config'
import { scanMods, toggleMod } from '../lib/mods-core'

export function registerModHandlers(): void {
  ipcMain.handle('mods:list', () => scanMods(INSTANCE_DIR))
  ipcMain.handle('mods:toggle', (_event, filename: string, enable: boolean) => {
    toggleMod(INSTANCE_DIR, filename, enable)
    return scanMods(INSTANCE_DIR)
  })
}
