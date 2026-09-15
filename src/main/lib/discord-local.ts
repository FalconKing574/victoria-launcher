import { createServer } from 'http'
import { randomBytes } from 'crypto'

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

const PAGINA = (texto: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Victoria Kingdom</title>` +
  `<body style="font-family:system-ui;background:#0d0d14;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h1 style="color:#f2a71b">Victoria Kingdom</h1><p>${texto}</p></div>`

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
        res
          .writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(PAGINA('Este enlace no es el que abrió el launcher. Volvé al launcher y probá de nuevo.'))
        return
      }
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(PAGINA(code ? 'Listo. Ya podés volver al launcher de Victoria.' : 'No se vinculó. Volvé al launcher.'))
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
