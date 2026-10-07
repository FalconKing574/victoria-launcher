import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as modpack } from '../web/functions/api/modpack.js'
import { onRequestGet as normas } from '../web/functions/api/normas.js'

/**
 * Qué protege esto.
 *
 * Las cifras de la portada y la página de normas salen del manifiesto vivo del
 * modpack, el mismo que lee el launcher. Si el manifiesto no llega, la web tiene
 * que recibir un error que sabe ignorar (y quedarse con lo escrito en el HTML),
 * nunca números o normas inventados.
 *
 * En JavaScript y no en TypeScript porque las funciones de Cloudflare lo son.
 */

function manifiesto(cuerpo, estado = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/api/modpack', () => {
  it('cuenta los mods del manifiesto, no los escribe a mano', async () => {
    manifiesto({
      packVersion: '1.4.0',
      minecraft: '1.20.1',
      forge: '47.4.0',
      mods: Array.from({ length: 117 }, (_, i) => ({ filename: `mod${i}.jar` })),
      optional: [{ id: 'distant-horizons' }, { id: 'forgematica' }]
    })
    const r = await modpack()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      version: '1.4.0',
      minecraft: '1.20.1',
      forge: '47.4.0',
      mods: 117,
      opcionales: 2
    })
  })

  it('si R2 falla, un error y ningún número', async () => {
    manifiesto({ error: 'caído' }, 503)
    const r = await modpack()
    expect(r.status).toBe(502)
    const cuerpo = await r.json()
    expect(cuerpo.error).toBeTruthy()
    expect(cuerpo.mods).toBeUndefined()
  })
})

describe('/api/normas', () => {
  it('devuelve las normas tal cual están en el manifiesto', async () => {
    const lasNormas = {
      version: 1,
      titulo: 'Normas de Victoria Kingdom',
      secciones: [{ titulo: 'Respeto', texto: 'Nada de insultos.' }]
    }
    manifiesto({ mods: [], normas: lasNormas })
    const r = await normas()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual(lasNormas)
  })

  it('un manifiesto sin normas es un error, no una página vacía', async () => {
    manifiesto({ mods: [] })
    const r = await normas()
    expect(r.status).toBe(502)
    expect((await r.json()).error).toBeTruthy()
  })
})
