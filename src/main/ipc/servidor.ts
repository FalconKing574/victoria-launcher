import { ipcMain } from 'electron'
import { SERVIDOR_MINECRAFT } from '../config'
import { consultarServidor, type EstadoServidor } from '../lib/estado-servidor'

/** Cada cuánto se vuelve a preguntar de verdad; entre medio se contesta lo último. */
const VIGENCIA_MS = 20_000

let ultimo: { estado: EstadoServidor; hora: number } | null = null
let enCurso: Promise<EstadoServidor> | null = null

/**
 * Estado del servidor de Minecraft para la pantalla Jugar. Va con caché y sin
 * consultas repetidas en paralelo: la pantalla se monta cada vez que se vuelve a
 * la pestaña, y no hace falta un ping por cada vuelta.
 */
export function registerServidorHandlers(): void {
  ipcMain.handle('servidor:estado', () => {
    if (ultimo && Date.now() - ultimo.hora < VIGENCIA_MS) return ultimo.estado
    enCurso ??= consultarServidor(SERVIDOR_MINECRAFT.host, SERVIDOR_MINECRAFT.puerto)
      .then((estado) => {
        ultimo = { estado, hora: Date.now() }
        return estado
      })
      .finally(() => {
        enCurso = null
      })
    return enCurso
  })
}
