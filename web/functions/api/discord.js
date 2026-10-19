import { json } from '../../lib/manifiesto.js'
import { resumirInvitacion, URL_INVITACION } from '../../lib/discord.js'

/**
 * GET /api/discord → `{ miembros, conectados }` del Discord de Victoria.
 *
 * Cloudflare guarda la respuesta de Discord 10 minutos, así la portada no le
 * pregunta a Discord en cada visita. Si Discord no contesta o cambia lo que
 * devuelve, un error: la portada no muestra nada, nunca un número inventado.
 */
export async function onRequestGet() {
  try {
    const r = await fetch(URL_INVITACION, {
      headers: { accept: 'application/json', 'user-agent': 'VictoriaKingdomWeb (https://victoriakingdom.com)' },
      signal: AbortSignal.timeout(5000),
      cf: { cacheTtl: 600, cacheEverything: true }
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return json(resumirInvitacion(await r.json()), 600)
  } catch {
    return json({ error: 'No se pudo consultar el Discord ahora.' }, 60, 502)
  }
}
