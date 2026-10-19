import { ipcMain, net } from 'electron'
import { NOVEDADES_JSON, WEB } from '../../preload/web'
import { leerNovedades, type Novedad } from '../lib/novedades'

/** Cada cuánto se vuelve a preguntar de verdad; entre medio se contesta lo último. */
const VIGENCIA_MS = 10 * 60_000

let ultimo: { lista: Novedad[]; hora: number } | null = null
let enCurso: Promise<Novedad[] | null> | null = null

/**
 * Las novedades de la web para la pantalla Jugar. Nunca falla: sin red, o con
 * un archivo que no se entiende, devuelve `null` y la pantalla muestra las que
 * trae el launcher. Primero la red de Chromium (respeta el proxy del sistema) y
 * después la de Node, como el manifiesto (lib/manifest-runtime.ts).
 */
const REDES: Array<(url: string, init: RequestInit) => Promise<Response>> = [
  (url, init) => net.fetch(url, init),
  (url, init) => fetch(url, init)
]

async function pedir(): Promise<Novedad[] | null> {
  for (const traer of REDES) {
    try {
      const r = await traer(NOVEDADES_JSON, {
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000)
      })
      if (!r.ok) continue
      const lista = leerNovedades(await r.json(), WEB)
      if (lista) ultimo = { lista, hora: Date.now() }
      return lista ?? ultimo?.lista ?? null
    } catch {
      // Se prueba la otra red; si las dos fallan, se queda lo último que llegó.
    }
  }
  return ultimo?.lista ?? null
}

export function registerNovedadesHandlers(): void {
  ipcMain.handle('novedades:lista', () => {
    if (ultimo && Date.now() - ultimo.hora < VIGENCIA_MS) return ultimo.lista
    enCurso ??= pedir().finally(() => {
      enCurso = null
    })
    return enCurso
  })
}
