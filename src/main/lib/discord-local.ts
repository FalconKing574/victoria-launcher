import { createServer } from 'http'
import { randomBytes } from 'crypto'
import { paginaDiscord } from './pagina-discord'

/**
 * Vincular Discord sin dominio: Discord vuelve a una escucha en la propia PC.
 *
 * ```
 * launcher --abre el navegador--> discord.com/oauth2/authorize
 * jugador  --autoriza------------> Discord
 * Discord  --redirige------------> http://127.0.0.1:53682/discord?code=...&state=...
 * launcher --code, en el sobre---> VictoriaAuth --canjea con el secret--> Discord
 * ```
 *
 * El `state` es al azar y tiene que volver igual: sin él, cualquier página que
 * el jugador visite podría mandarle a esta escucha un code de OTRA cuenta de
 * Discord y el launcher la vincularía sin que se dé cuenta.
 *
 * El code no sirve solo: canjearlo pide el client secret, que vive en el
 * servidor. Por eso puede viajar al plugin sin más.
 */

export function urlAutorizar(clientId: string, redirect: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    scope: 'identify guilds.join',
    state,
    prompt: 'consent'
  })
  return `https://discord.com/oauth2/authorize?${p.toString()}`
}

export interface OpcionesDiscord {
  clientId: string
  puerto: number
  abrir: (url: string) => void | Promise<void>
  /** Cuánto se espera a que el jugador autorice. */
  esperaMs?: number
}

export function esperarCodigoDiscord(o: OpcionesDiscord): Promise<string> {
  const redirect = `http://127.0.0.1:${o.puerto}/discord`
  const state = randomBytes(16).toString('hex')

  return new Promise((resolve, reject) => {
    let terminado = false

    const servidor = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirect)
      if (url.pathname !== '/discord') {
        res.writeHead(404).end()
        return
      }
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(paginaDiscord('ajeno'))
        return
      }
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(paginaDiscord(code ? 'ok' : error === 'access_denied' ? 'cancelado' : 'error'))
      if (code) terminar(null, code)
      else
        terminar(
          new Error(
            error === 'access_denied'
              ? 'Cancelaste la autorización en Discord.'
              : 'Discord no devolvió la autorización.'
          ),
          null
        )
    })

    const reloj = setTimeout(
      () => terminar(new Error('Se acabó el tiempo para autorizar en Discord. Probá de nuevo.'), null),
      o.esperaMs ?? 5 * 60_000
    )

    function terminar(error: Error | null, code: string | null): void {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      servidor.close()
      if (code) resolve(code)
      else reject(error ?? new Error('Discord no devolvió la autorización.'))
    }

    servidor.on('error', (e) =>
      terminar(
        new Error(`No se pudo abrir el puerto ${o.puerto} para Discord (${e.message}). Cerrá otros launchers y probá de nuevo.`),
        null
      )
    )
    servidor.listen(o.puerto, '127.0.0.1', () => {
      Promise.resolve(o.abrir(urlAutorizar(o.clientId, redirect, state))).catch((e) =>
        terminar(e as Error, null)
      )
    })
  })
}
