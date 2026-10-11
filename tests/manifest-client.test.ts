import { afterEach, describe, expect, it, vi } from 'vitest'
import { createManifestClient } from '../src/main/lib/manifest-client'
import { ManifestUnavailable, networkCodes } from '../src/main/lib/network-error'

const manifest = { packVersion: '2.2.2', minecraft: '1.20.1', forge: '47.4.0', mods: [], optional: [] }
const ok = () => new Response(JSON.stringify(manifest))
const url = 'https://example.test/manifest.json'
afterEach(() => vi.useRealTimers())

describe('la descarga del manifiesto no bloquea una conexión recuperable', () => {
  it('prueba el segundo transporte si el primero falla por red', async () => {
    const first = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const second = vi.fn().mockImplementation(ok)
    const load = createManifestClient({ url, fetchers: [first, second], wait: async () => undefined })
    expect(await load()).toEqual(manifest)
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it.each([429, 503])('recupera HTTP %s con el segundo intento', async (status) => {
    const load = createManifestClient({ url, fetchers: [async () => new Response('', { status }), async () => ok()], wait: async () => undefined })
    expect(await load()).toEqual(manifest)
  })

  it('no repite un 404 permanente y da un mensaje que identifica Victoria', async () => {
    const second = vi.fn()
    const load = createManifestClient({ url, fetchers: [async () => new Response('', { status: 404 }), second] })
    await expect(load()).rejects.toThrow('actualizaciones de Victoria')
    expect(second).not.toHaveBeenCalled()
  })

  it('comparte la descarga simultánea y reutiliza un éxito durante un minuto', async () => {
    let time = 1_000
    const fetcher = vi.fn().mockImplementation(ok)
    const load = createManifestClient({ url, fetchers: [fetcher], now: () => time })
    await Promise.all([load(), load(), load()])
    expect(fetcher).toHaveBeenCalledOnce()
    time += 59_000
    await load()
    expect(fetcher).toHaveBeenCalledOnce()
    time += 1_001
    await load()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('no guarda un JSON incompleto como manifiesto válido', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}')).mockImplementation(ok)
    const load = createManifestClient({ url, fetchers: [fetcher] })
    await expect(load()).rejects.toBeInstanceOf(ManifestUnavailable)
    expect(await load()).toEqual(manifest)
  })

  it('el límite aborta también una lectura de cuerpo que no termina', async () => {
    vi.useFakeTimers()
    const fetcher: typeof fetch = async (_url, init) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
    }) as Response
    const load = createManifestClient({ url, fetchers: [fetcher], timeoutMs: 10 })
    const result = expect(load()).rejects.toBeInstanceOf(ManifestUnavailable)
    // AbortSignal.timeout usa un reloj nativo, independiente del reloj falso de vitest.
    vi.useRealTimers()
    await result
  })

  it('conserva el código interno sin exponer el texto de la excepción', async () => {
    const error = new TypeError('fetch failed https://ejemplo/?token=SECRETO', { cause: { code: 'ENOTFOUND' } })
    const failure = vi.fn()
    const load = createManifestClient({ url, fetchers: [async () => { throw error }], failure })
    try { await load() } catch (e) {
      expect((e as Error).message).not.toContain('SECRETO')
      expect(networkCodes(e)).toContain('ENOTFOUND')
    }
    expect(failure).toHaveBeenCalledOnce()
  })
})
