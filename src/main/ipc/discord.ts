import { BrowserWindow } from 'electron'
import { createServer, type Server } from 'http'
import { randomBytes } from 'crypto'
import { env, DISCORD_CALLBACK_PORT } from '../config'
import { buildAuthorizeUrl } from '../lib/discord-url'

const SUCCESS_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Discord vinculado</title><style>
body{background:#0d0d12;color:#fff;font-family:system-ui,sans-serif;display:grid;
place-items:center;height:100vh;margin:0}h1{font-weight:600}p{color:#9aa}
</style></head><body><div><h1>Cuenta de Discord vinculada</h1>
<p>Ya puedes volver al launcher.</p></div></body></html>`

const ERROR_PAGE = SUCCESS_PAGE.replace('Cuenta de Discord vinculada', 'No se pudo vincular')
  .replace('Ya puedes volver al launcher.', 'Cierra esta ventana e inténtalo de nuevo.')

/**
 * Opens Discord's consent screen and captures the authorization code from a
 * loopback redirect. Resolves with the raw code, which only the edge function
 * can exchange (it holds the client secret).
 */
export function linkDiscord(): Promise<string> {
  return new Promise((resolve, reject) => {
    const state = randomBytes(16).toString('hex')
    let server: Server | null = null
    let win: BrowserWindow | null = null
    let settled = false

    const cleanup = (): void => {
      server?.close()
      server = null
      if (win && !win.isDestroyed()) win.destroy()
      win = null
    }

    const finish = (error: Error | null, code?: string): void => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(code!)
    }

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${DISCORD_CALLBACK_PORT}`)
      if (url.pathname !== '/discord/callback') {
        res.writeHead(404).end()
        return
      }

      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(ERROR_PAGE)
        finish(new Error('Respuesta de Discord inválida.'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SUCCESS_PAGE)
      finish(null, code)
    })

    server.on('error', (error) => finish(error))

    server.listen(DISCORD_CALLBACK_PORT, '127.0.0.1', () => {
      win = new BrowserWindow({
        width: 520,
        height: 780,
        autoHideMenuBar: true,
        title: 'Vincular Discord',
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })
      win.on('closed', () => finish(new Error('Vinculación cancelada.')))
      win.loadURL(
        buildAuthorizeUrl({
          clientId: env.discordClientId,
          redirectUri: env.discordRedirectUri,
          state
        })
      )
    })
  })
}
