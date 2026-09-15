/**
 * Qué permisos del navegador se le dan a la interfaz del launcher.
 *
 * Electron da varios por defecto, y un pedido de cámara, ubicación o
 * notificaciones sólo puede venir de algo que no tiene nada que hacer ahí. Por
 * eso todo está cerrado salvo dos:
 *
 * - **Pantalla completa.**
 * - **Micrófono, sólo audio.** Lo usa la prueba de micrófono de la configuración
 *   guiada (chat de voz por proximidad). Antes estaba cerrado también, y la
 *   prueba fallaba siempre con un mensaje que culpaba a Windows (15-09-2026).
 *   La cámara sigue cerrada: un pedido de audio + video se rechaza entero.
 *
 * Aparte de Electron para poder probarlo: `index.ts` sólo lo enchufa.
 */

export interface DetallesPermiso {
  /** Lo que manda `setPermissionRequestHandler` para 'media'. */
  mediaTypes?: string[]
  /** Lo que manda `setPermissionCheckHandler` para 'media'. */
  mediaType?: string
}

export function permisoPermitido(permiso: string, detalles: DetallesPermiso = {}): boolean {
  if (permiso === 'fullscreen') return true
  if (permiso === 'media') {
    const tipos = detalles.mediaTypes ?? (detalles.mediaType ? [detalles.mediaType] : [])
    return tipos.length > 0 && tipos.every((t) => t === 'audio')
  }
  return false
}
