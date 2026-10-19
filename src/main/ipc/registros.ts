import { app, ipcMain, shell } from 'electron'
import { launcherRoot, instanceDir } from '../lib/paths'
import { leerFinal, listarRegistros, rutaDeRegistro, type CarpetasRegistros } from '../lib/registros'

function carpetas(): CarpetasRegistros {
  return { datos: app.getPath('userData'), instancia: instanceDir(), minecraft: launcherRoot() }
}

function ruta(id: string): string {
  const r = rutaDeRegistro(carpetas(), String(id))
  if (!r) throw new Error('Ese registro ya no existe.')
  return r
}

/** Ajustes → Registros: ver, abrir y encontrar los logs sin saber dónde están. */
export function registerRegistrosHandlers(): void {
  ipcMain.handle('registros:lista', () => listarRegistros(carpetas()))
  ipcMain.handle('registros:leer', (_e, id: string) => leerFinal(ruta(id)))
  ipcMain.handle('registros:abrir', async (_e, id: string) => {
    const error = await shell.openPath(ruta(id))
    if (error) throw new Error(error)
  })
  ipcMain.handle('registros:carpeta', (_e, id: string) => shell.showItemInFolder(ruta(id)))
}
