import type { RespuestaCuenta } from '@shared/api'

/**
 * Por qué el launcher no dejó jugar, sacado del error de `launch.start`.
 *
 * El proceso main no puede mandar un objeto por un error de IPC: Electron sólo
 * pasa el texto, y encima le antepone "Error invoking remote method…". Por eso
 * `ipc/launch.ts` escribe la respuesta del servidor como JSON detrás de
 * `VICTORIA_BLOQUEO:` y acá se la vuelve a leer.
 */
const PREFIJO = 'VICTORIA_BLOQUEO:'

export function leerBloqueo(mensaje: string | null | undefined): RespuestaCuenta | null {
  if (!mensaje) return null
  const i = mensaje.indexOf(PREFIJO)
  if (i < 0) return null
  try {
    return JSON.parse(mensaje.slice(i + PREFIJO.length)) as RespuestaCuenta
  } catch {
    return null
  }
}
