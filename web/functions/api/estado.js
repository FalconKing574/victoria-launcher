import { connect } from 'cloudflare:sockets'
import { consultarEstado } from '../../lib/ping.ts'

/**
 * GET /api/estado → si el servidor de Minecraft está en línea y cuánta gente hay.
 *
 * Cloudflare no deja hacer `fetch` a una IP con puerto, pero sí abrir una
 * conexión TCP (`cloudflare:sockets`), que es lo que usa el ping de la lista de
 * servidores. Nunca falla: cualquier problema es «sin respuesta».
 *
 * Si cambia la IP o el puerto del servidor, se cambia acá y en
 * `src/main/config.ts` del launcher.
 */
const HOST = '131.221.32.76'
const PUERTO = 25567
const TIEMPO_MS = 4000
const VIGENCIA_S = 30

export async function onRequestGet(context) {
  const clave = new Request(new URL('/api/estado', context.request.url).toString())
  const cache = caches.default
  const guardada = await cache.match(clave).catch(() => undefined)
  if (guardada) return guardada

  const estado = await consultarEstado(connect, HOST, PUERTO, TIEMPO_MS)
  const respuesta = new Response(JSON.stringify(estado), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${VIGENCIA_S}`
    }
  })
  context.waitUntil(cache.put(clave, respuesta.clone()).catch(() => undefined))
  return respuesta
}
