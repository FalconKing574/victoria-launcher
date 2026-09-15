import { describe, it, expect } from 'vitest'
import { get } from 'http'
import { createServer } from 'net'
import { esperarCodigoDiscord, urlAutorizar } from '../src/main/lib/discord-local'
import { paginaDiscord } from '../src/main/lib/pagina-discord'

function pedir(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    }).on('error', reject)
  })
}

function puertoLibre(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
}

describe('discord-local', () => {
  it('la página de vuelta dice qué hacer y no promete el vínculo antes de tiempo', () => {
    const ok = paginaDiscord('ok')
    expect(ok).toContain('Volvé al launcher')
    expect(ok).not.toContain('vinculado')
    // Que el logo quede en base64 lo decide el build (`?inline`), no vitest:
    // se comprobó en out/main/index.js. Acá sólo que la imagen tenga origen.
    expect(ok).toMatch(/<img class="logo" src="[^"]+"/)
    expect(paginaDiscord('cancelado')).toContain('Cancelaste')
  })

  it('arma la URL de autorización', () => {
    const u = new URL(urlAutorizar('123', 'http://127.0.0.1:53682/discord', 'abc'))
    expect(u.origin + u.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(u.searchParams.get('client_id')).toBe('123')
    expect(u.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:53682/discord')
    expect(u.searchParams.get('scope')).toBe('identify guilds.join')
    expect(u.searchParams.get('state')).toBe('abc')
    expect(u.searchParams.get('response_type')).toBe('code')
  })

  it('devuelve el code cuando Discord vuelve con el state correcto', async () => {
    const puerto = await puertoLibre()
    let abierta = ''
    const promesa = esperarCodigoDiscord({
      clientId: '123',
      puerto,
      abrir: (url) => {
        abierta = url
      }
    })
    await new Promise((r) => setTimeout(r, 50))
    const state = new URL(abierta).searchParams.get('state')!
    expect(await pedir(`http://127.0.0.1:${puerto}/discord?code=otro&state=ajeno`)).toBe(400)
    expect(await pedir(`http://127.0.0.1:${puerto}/discord?code=el-code&state=${state}`)).toBe(200)
    await expect(promesa).resolves.toBe('el-code')
  })

  it('cancelar en Discord rechaza con un mensaje claro', async () => {
    const puerto = await puertoLibre()
    let abierta = ''
    const promesa = esperarCodigoDiscord({ clientId: '1', puerto, abrir: (u) => void (abierta = u) })
    await new Promise((r) => setTimeout(r, 50))
    const state = new URL(abierta).searchParams.get('state')!
    await pedir(`http://127.0.0.1:${puerto}/discord?error=access_denied&state=${state}`)
    await expect(promesa).rejects.toThrow(/Cancelaste/)
  })

  it('se rinde si pasa el tiempo', async () => {
    const puerto = await puertoLibre()
    await expect(
      esperarCodigoDiscord({ clientId: '1', puerto, abrir: () => undefined, esperaMs: 30 })
    ).rejects.toThrow(/tiempo/)
  })

  it('puerto ocupado rechaza', async () => {
    const puerto = await puertoLibre()
    const ocupado = createServer().listen(puerto, '127.0.0.1')
    await new Promise((r) => setTimeout(r, 30))
    await expect(
      esperarCodigoDiscord({ clientId: '1', puerto, abrir: () => undefined })
    ).rejects.toThrow(/puerto/)
    ocupado.close()
  })
})
