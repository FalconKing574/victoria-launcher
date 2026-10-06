import type { UpdaterState } from '@shared/api'

/**
 * El aviso de la pantalla Jugar sobre la actualización del propio launcher.
 *
 * Tiene que decir qué va a pasar y cuándo, porque lo que confundía era
 * justamente eso: la ventana se cerraba sola y aparecía el instalador. Ahora lo
 * que se encuentra con el launcher abierto se instala al cerrarlo, y el aviso
 * lo cuenta. Si el instalador quedó bloqueado (casi siempre el antivirus), lo
 * dice sin impedir jugar.
 */
export interface AvisoLauncher {
  tono: 'info' | 'alerta'
  texto: string
  /** El botón del aviso, si hay algo que se pueda hacer desde ahí. */
  accion: 'reiniciar' | 'reintentar' | null
}

export function avisoLauncher(estado: UpdaterState | null): AvisoLauncher | null {
  if (!estado) return null
  const version = estado.version ? ` ${estado.version}` : ''

  switch (estado.phase) {
    case 'available':
    case 'downloading':
      return {
        tono: 'info',
        texto:
          `Descargando la versión${version} del launcher` +
          (estado.phase === 'downloading' ? ` (${estado.percent}%)` : '') +
          '. Se instalará sola cuando cierres el launcher.',
        accion: null
      }
    case 'ready':
      return {
        tono: 'info',
        texto: `La versión${version} del launcher está lista. Se instala sola al cerrar el launcher, o ahora mismo si lo reinicias.`,
        accion: 'reiniciar'
      }
    case 'installing':
      return {
        tono: 'info',
        texto:
          'Instalando la actualización: el launcher se cerrará y se volverá a abrir solo en unos segundos.',
        accion: null
      }
    case 'blocked':
      return {
        tono: 'alerta',
        texto:
          estado.message ??
          `La versión${version} del launcher no se pudo instalar. Casi siempre es el antivirus. Puedes seguir jugando.`,
        accion: 'reintentar'
      }
    default:
      // Sin conexión o al día: nada que avisar en Jugar. El detalle está en Ajustes.
      return null
  }
}
