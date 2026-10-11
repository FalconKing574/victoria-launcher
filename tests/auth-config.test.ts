import { describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import { createAuthConfig, validAuth } from '../src/main/lib/auth-config'
import { ManifestUnavailable } from '../src/main/lib/network-error'
import bootstrap from '../src/main/data/auth-respaldo.json'

const url = 'https://example.test/manifest.json'
const now = 2_000_000_000
const unavailable = new ManifestUnavailable(new TypeError('fetch failed'))
const options = () => ({ url, now: () => now, read: () => null, write: vi.fn(), loadManifest: vi.fn().mockRejectedValue(unavailable), bootstrap })

describe('entrar con el pack ya instalado aunque falle la distribución', () => {
  it('incluye un respaldo público válido para quien nunca tuvo caché', async () => {
    const o = options()
    expect(validAuth(bootstrap)).toBe(true)
    expect(await createAuthConfig(o)()).toEqual(bootstrap)
    expect(o.loadManifest).toHaveBeenCalledOnce()
    expect(o.write).not.toHaveBeenCalled()
  })

  it('prioriza un manifiesto nuevo sobre la llave del respaldo', async () => {
    const o = options()
    const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    const rotated = { ...bootstrap, llave: key }
    o.loadManifest.mockResolvedValue({ auth: rotated })
    expect(await createAuthConfig(o)()).toEqual(rotated)
    expect(o.write).toHaveBeenCalledWith({ url, savedAt: now, auth: rotated })
  })

  it('reutiliza datos recientes de esta misma URL sin volver a descargar', async () => {
    const o = options()
    o.read = () => ({ url, savedAt: now - 60_000, auth: bootstrap }) as never
    expect(await createAuthConfig(o)()).toEqual(bootstrap)
    expect(o.loadManifest).not.toHaveBeenCalled()
  })

  it('usa un caché anterior tras fallar la red', async () => {
    const o = options()
    const cached = { ...bootstrap, host: 'respaldo.example.test' }
    o.read = () => ({ url, savedAt: now - 600_000, auth: cached }) as never
    expect(await createAuthConfig(o)()).toEqual(cached)
    expect(o.loadManifest).toHaveBeenCalledOnce()
  })

  it.each(['otra-url', 'vencido', 'futuro', 'llave-rota'])('descarta un caché %s', async (problem) => {
    const o = options()
    o.read = () => ({ url: problem === 'otra-url' ? 'https://other.test' : url,
      savedAt: problem === 'vencido' ? now - 8 * 86400_000 : problem === 'futuro' ? now + 1 : now,
      auth: problem === 'llave-rota' ? { ...bootstrap, llave: 'rota' } : bootstrap }) as never
    expect(await createAuthConfig(o)()).toEqual(bootstrap)
    expect(o.loadManifest).toHaveBeenCalledOnce()
  })

  it('una configuración nueva inválida no se oculta con el respaldo', async () => {
    const o = options()
    o.loadManifest.mockResolvedValue({ auth: { ...bootstrap, llave: 'rota' } })
    await expect(createAuthConfig(o)()).rejects.toThrow('configuración de cuentas')
  })

  it('recuerda que un manifiesto retiró auth incluso si después falla la red', async () => {
    const o = options()
    let time = now
    o.now = () => time
    o.loadManifest.mockResolvedValueOnce({})
    const get = createAuthConfig(o)
    expect(await get()).toBeNull()
    time += 600_000
    expect(await get()).toBeNull()
  })

  it('un disco lleno no impide usar la configuración válida de red', async () => {
    const o = options()
    o.write.mockImplementation(() => { throw new Error('disco lleno') })
    o.loadManifest.mockResolvedValue({ auth: bootstrap })
    expect(await createAuthConfig(o)()).toEqual(bootstrap)
  })

  it('sin respaldo autorizado no redirige otro servidor a producción', async () => {
    const o = options()
    const get = createAuthConfig({ ...o, bootstrap: undefined })
    await expect(get()).rejects.toBe(unavailable)
  })

  it('no guarda errores y permite reintentar la lectura', async () => {
    const o = options()
    const get = createAuthConfig({ ...o, bootstrap: undefined })
    await expect(get()).rejects.toBe(unavailable)
    o.loadManifest.mockResolvedValue({ auth: bootstrap })
    expect(await get()).toEqual(bootstrap)
  })

  it('reutiliza brevemente el respaldo y después vuelve a buscar la configuración actual', async () => {
    const o = options()
    let time = now
    o.now = () => time
    const get = createAuthConfig(o)
    await get()
    await get()
    expect(o.loadManifest).toHaveBeenCalledOnce()
    time += 30_001
    const updated = { ...bootstrap, host: 'nuevo.example.test' }
    o.loadManifest.mockResolvedValue({ auth: updated })
    expect(await get()).toEqual(updated)
    expect(o.loadManifest).toHaveBeenCalledTimes(2)
  })
})
