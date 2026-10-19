import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthConfig } from '../src/main/lib/auth-config'
import { ManifestUnavailable } from '../src/main/lib/network-error'
import bootstrap from '../src/main/data/auth-respaldo.json'

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  configuration: vi.fn(), backend: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getPath: () => 'Z:/victoria-test-inexistente' },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mocked.handlers.set(channel, handler) },
  safeStorage: { isEncryptionAvailable: () => false }, BrowserWindow: {}, shell: {}, net: { fetch: vi.fn() }
}))
vi.mock('../src/main/lib/auth-config-runtime', () => ({ getAuthConfig: mocked.configuration }))
vi.mock('../src/main/lib/cuentas-api', async (original) => ({ ...await original<typeof import('../src/main/lib/cuentas-api')>(), llamar: mocked.backend }))
vi.mock('../src/main/lib/huella', () => ({ obtenerHuella: async () => 'equipo-simulado' }))
vi.mock('../src/main/lib/certificado-mojang', () => ({ pedirCertificado: async () => null }))
vi.mock('../src/main/lib/discord-local', () => ({ esperarCodigoDiscord: vi.fn() }))
vi.mock('../src/main/lib/network-log', () => ({ logNetwork: vi.fn() }))

beforeEach(async () => {
  vi.resetModules()
  mocked.backend.mockReset()
  mocked.configuration.mockReset()
  mocked.handlers.clear()
  const get = createAuthConfig({
    url: 'https://produccion.test', bootstrap, read: () => null, write: () => undefined,
    loadManifest: async () => { throw new ManifestUnavailable(new TypeError('fetch failed')) }
  })
  mocked.configuration.mockImplementation(get)
  const { registerCuentasHandlers } = await import('../src/main/ipc/cuentas')
  registerCuentasHandlers()
})

describe('el respaldo recupera el acceso sin reemplazar la autoridad del servidor', () => {
  it('completa el login premium con el manifiesto inaccesible y oculta el token de sesión', async () => {
    mocked.backend.mockResolvedValue({ ok: true, sesion: 'sesion-simulada', cuenta: { nombre: 'Prueba', tipo: 'PREMIUM', pasos: [] } })
    const result = await mocked.handlers.get('cuentas:premium')?.({}, 'token-de-prueba-local')
    expect(result).toEqual({ ok: true, cuenta: { nombre: 'Prueba', tipo: 'PREMIUM', pasos: [] } })
    expect(mocked.backend).toHaveBeenCalledWith(bootstrap, 'premium', { mcToken: 'token-de-prueba-local', cert: null, huella: 'equipo-simulado' }, expect.any(Function))
  })

  it('respeta un rechazo o sanción aunque exista configuración de respaldo', async () => {
    const denied = { ok: false, error: 'sancion', mensaje: 'Cuenta bloqueada' }
    mocked.backend.mockResolvedValue(denied)
    expect(await mocked.handlers.get('cuentas:premium')?.({}, 'token-de-prueba-local')).toEqual(denied)
  })

  it('el pase de entrada también debe ser autorizado por el servidor', async () => {
    mocked.backend.mockResolvedValueOnce({ ok: true, sesion: 'sesion-simulada' })
    await mocked.handlers.get('cuentas:premium')?.({}, 'token-de-prueba-local')
    mocked.backend.mockResolvedValueOnce({ ok: false, error: 'pasos', mensaje: 'Faltan las normas' })
    const { pedirValeCuenta } = await import('../src/main/ipc/cuentas')
    expect(await pedirValeCuenta()).toEqual({ ok: false, error: 'pasos', mensaje: 'Faltan las normas' })
    expect(mocked.backend.mock.calls[1][1]).toBe('vale')
  })
})
