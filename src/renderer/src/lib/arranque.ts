import type { UpdaterPhase } from '@shared/api'

/**
 * Qué hace la pantalla de carga mientras el launcher busca su propia
 * actualización.
 *
 * La idea es que la actualización pase ANTES de que el jugador empiece nada:
 * si hay versión nueva, se baja y se instala desde la pantalla de carga, con
 * su barra, y el launcher se vuelve a abrir solo. Antes se buscaba a los 4
 * segundos, en segundo plano, y cuando terminaba de bajar la ventana se cerraba
 * en medio de crear la cuenta o vincular Discord — y encima volvía a salir el
 * asistente del instalador.
 *
 * Nunca puede dejar a nadie atascado: sin conexión, con GitHub caído o con el
 * antivirus bloqueando, se entra igual.
 */

/** Lo mínimo que se ve el logo, aunque la respuesta llegue antes. */
export const SPLASH_MINIMO_MS = 1600

/** Lo máximo que se espera a saber si hay versión nueva; después se entra. */
export const SPLASH_BUSQUEDA_MAX_MS = 8000

/** Cuánto lleva descargando antes de ofrecer «Entrar sin esperar». */
export const SPLASH_SALTAR_DESCARGA_MS = 6000

/**
 * Si se queda en «Instalando» más que esto, el launcher no se cerró: algo falló
 * y no puede quedarse ahí para siempre.
 */
export const SPLASH_SALTAR_INSTALACION_MS = 15000

export type DecisionSplash = 'esperar' | 'entrar' | 'actualizar'

/**
 * @param fase La fase del actualizador; `null` si todavía no respondió.
 * @param ms Cuánto lleva abierta la pantalla de carga.
 */
export function decidirSplash(fase: UpdaterPhase | null, ms: number): DecisionSplash {
  switch (fase) {
    case 'available':
    case 'downloading':
    case 'ready':
    case 'installing':
      return 'actualizar'
    case null:
    case 'idle':
    case 'checking':
      return ms >= SPLASH_BUSQUEDA_MAX_MS ? 'entrar' : 'esperar'
    default:
      // none, error, blocked, dev: no hay nada que instalar ahora.
      return ms >= SPLASH_MINIMO_MS ? 'entrar' : 'esperar'
  }
}

/**
 * Si se ofrece «Entrar sin esperar». Lo que se esté bajando se instala al
 * cerrar el launcher.
 *
 * @param msEnFase Cuánto lleva el actualizador en la fase actual.
 */
export function puedeSaltar(fase: UpdaterPhase | null, msEnFase: number): boolean {
  if (fase === 'available' || fase === 'downloading') return msEnFase >= SPLASH_SALTAR_DESCARGA_MS
  if (fase === 'ready' || fase === 'installing') return msEnFase >= SPLASH_SALTAR_INSTALACION_MS
  return false
}
