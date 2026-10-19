import { describe, it, expect, vi, afterEach } from 'vitest'
import type { UpdaterPhase, UpdaterState } from '../src/preload/api'
import {
  SPLASH_BUSQUEDA_MAX_MS,
  SPLASH_MINIMO_MS,
  SPLASH_SALTAR_DESCARGA_MS,
  SPLASH_SALTAR_INSTALACION_MS,
  ARRANQUE_CUENTA_MAX_MS,
  ARRANQUE_MICROSOFT_MAX_MS,
  conLimite,
  decidirSplash,
  puedeSaltar
} from '../src/renderer/src/lib/arranque'
import { avisoLauncher } from '../src/renderer/src/lib/aviso-launcher'

/**
 * Qué protege esto.
 *
 * La pantalla de carga ahora espera a saber si el launcher tiene versión nueva,
 * para instalarla antes de que el jugador empiece nada. La regla que no se puede
 * romper es la negativa: nunca deja a nadie atascado en el logo. Sin conexión,
 * con GitHub caído, con el antivirus bloqueando o con un actualizador que no
 * contesta, se entra igual.
 */
describe('decidirSplash', () => {
  it('sin nada que instalar, entra después del logo y no antes', () => {
    for (const fase of ['none', 'error', 'blocked', 'dev'] as UpdaterPhase[]) {
      expect(decidirSplash(fase, 0), fase).toBe('esperar')
      expect(decidirSplash(fase, SPLASH_MINIMO_MS), fase).toBe('entrar')
    }
  })

  it('mientras busca, espera; pero no más del máximo', () => {
    for (const fase of ['idle', 'checking', null] as Array<UpdaterPhase | null>) {
      expect(decidirSplash(fase, SPLASH_MINIMO_MS), String(fase)).toBe('esperar')
      expect(decidirSplash(fase, SPLASH_BUSQUEDA_MAX_MS), String(fase)).toBe('entrar')
    }
  })

  it('el máximo de búsqueda es corto: es lo que espera alguien sin internet', () => {
    expect(SPLASH_BUSQUEDA_MAX_MS).toBeLessThanOrEqual(10000)
  })

  it('con versión nueva, se queda actualizando', () => {
    for (const fase of ['available', 'downloading', 'ready', 'installing'] as UpdaterPhase[]) {
      expect(decidirSplash(fase, 0), fase).toBe('actualizar')
      expect(decidirSplash(fase, 120000), fase).toBe('actualizar')
    }
  })
})

describe('puedeSaltar', () => {
  it('una descarga lenta se puede dejar para después', () => {
    expect(puedeSaltar('downloading', 0)).toBe(false)
    expect(puedeSaltar('downloading', SPLASH_SALTAR_DESCARGA_MS)).toBe(true)
    expect(puedeSaltar('available', SPLASH_SALTAR_DESCARGA_MS)).toBe(true)
  })

  it('instalando no se ofrece enseguida, pero tampoco puede quedar ahí para siempre', () => {
    expect(puedeSaltar('installing', SPLASH_SALTAR_DESCARGA_MS)).toBe(false)
    expect(puedeSaltar('installing', SPLASH_SALTAR_INSTALACION_MS)).toBe(true)
    expect(puedeSaltar('ready', SPLASH_SALTAR_INSTALACION_MS)).toBe(true)
  })

  it('cuando no hay actualización no hace falta: ya entra solo', () => {
    expect(puedeSaltar('none', 999999)).toBe(false)
    expect(puedeSaltar('checking', 999999)).toBe(false)
  })
})

const estado = (over: Partial<UpdaterState>): UpdaterState => ({
  phase: 'none',
  version: '1.8.0',
  current: '1.7.1',
  percent: 0,
  message: null,
  manualUrl: null,
  antivirus: false,
  ...over
})

describe('avisoLauncher', () => {
  it('sin actualización, o sin conexión, no molesta en Jugar', () => {
    expect(avisoLauncher(null)).toBeNull()
    for (const phase of ['none', 'error', 'checking', 'idle', 'dev'] as UpdaterPhase[]) {
      expect(avisoLauncher(estado({ phase })), phase).toBeNull()
    }
  })

  it('lo que baja con el launcher abierto dice que se instala al cerrar', () => {
    const aviso = avisoLauncher(estado({ phase: 'downloading', percent: 40 }))
    expect(aviso?.texto).toContain('40%')
    expect(aviso?.texto).toContain('cuando cierres el launcher')
    expect(aviso?.accion).toBeNull()
  })

  it('lista: se puede reiniciar ya', () => {
    const aviso = avisoLauncher(estado({ phase: 'ready' }))
    expect(aviso?.accion).toBe('reiniciar')
    expect(aviso?.tono).toBe('info')
  })

  it('bloqueada: alerta, se puede reintentar, y usa el mensaje del proceso principal', () => {
    const aviso = avisoLauncher(
      estado({ phase: 'blocked', message: 'El antivirus la bloqueó.', antivirus: true })
    )
    expect(aviso).toEqual({
      tono: 'alerta',
      texto: 'El antivirus la bloqueó.',
      accion: 'reintentar'
    })
  })
})

describe('conLimite: el arranque no espera a la red para siempre', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('devuelve la respuesta si llega a tiempo', async () => {
    await expect(conLimite(Promise.resolve('ok'), 1000, 'vencio')).resolves.toBe('ok')
  })

  it('una respuesta que no llega nunca no deja el logo para siempre', async () => {
    vi.useFakeTimers()
    // Lo que pasaba: una conexión que no contesta, ni bien ni mal.
    const nunca = new Promise<string>(() => undefined)
    const resultado = conLimite(nunca, ARRANQUE_CUENTA_MAX_MS, 'vencio')
    await vi.advanceTimersByTimeAsync(ARRANQUE_CUENTA_MAX_MS)
    await expect(resultado).resolves.toBe('vencio')
  })

  it('un error cuenta como sin respuesta, no como un arranque roto', async () => {
    await expect(conLimite(Promise.reject(new Error('IPC')), 1000, 'vencio')).resolves.toBe('vencio')
  })

  it('lo que llega tarde se ignora', async () => {
    vi.useFakeTimers()
    let contestar: (v: string) => void = () => undefined
    const tarde = new Promise<string>((r) => (contestar = r))
    const resultado = conLimite(tarde, 1000, 'vencio')
    await vi.advanceTimersByTimeAsync(1000)
    contestar('tarde')
    await expect(resultado).resolves.toBe('vencio')
  })

  it('el peor arranque no pasa de 80 segundos', () => {
    // Microsoft, después la cuenta, y en el peor caso la cuenta otra vez como
    // premium: se esperan uno detrás del otro.
    expect(ARRANQUE_MICROSOFT_MAX_MS + 2 * ARRANQUE_CUENTA_MAX_MS).toBeLessThanOrEqual(80_000)
    // Y no corta antes que el proceso principal: cada llamada al servidor de
    // cuentas ya tiene 15 s propios, y un servidor lento pero vivo tiene que
    // poder contestar.
    expect(ARRANQUE_CUENTA_MAX_MS).toBeGreaterThan(15_000)
  })
})
