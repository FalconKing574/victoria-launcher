import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import {
  MAX_INTENTOS_AUTOMATICOS,
  borrarIntento,
  compararVersiones,
  diagnosticarErrorActualizacion,
  evaluarIntento,
  guardarIntento,
  leerIntento,
  registrarIntento,
  urlDescargaManual
} from '../src/main/lib/actualizacion'

/**
 * Qué protege esto.
 *
 * El actualizador cierra el launcher para abrir el instalador. Si el antivirus
 * bloquea ese instalador, no se instala nada y el launcher no vuelve: al abrirlo
 * otra vez la actualización ya está bajada, se intenta de nuevo y se vuelve a
 * cerrar. Sin este registro el launcher quedaba cerrándose solo en cada
 * apertura, y para el jugador era imposible de entender.
 */

const AHORA = new Date('2026-10-06T12:00:00Z')

describe('compararVersiones', () => {
  it('ordena por número, no por texto', () => {
    expect(compararVersiones('1.10.0', '1.9.9')).toBe(1)
    expect(compararVersiones('1.7.1', '1.7.2')).toBe(-1)
    expect(compararVersiones('2.0.0', '1.99.99')).toBe(1)
  })

  it('trata igual lo que sólo cambia en ceros, prefijo o sufijo', () => {
    expect(compararVersiones('1.7', '1.7.0')).toBe(0)
    expect(compararVersiones('v1.7.2', '1.7.2')).toBe(0)
    expect(compararVersiones('1.7.2-beta.1', '1.7.2')).toBe(0)
  })
})

describe('el freno contra el ciclo de cierres', () => {
  it('el primer intento de una versión cuenta uno', () => {
    const intento = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    expect(intento).toEqual({
      version: '1.8.0',
      desde: '1.7.1',
      intentos: 1,
      ultimo: AHORA.toISOString()
    })
  })

  it('volver a intentar la misma versión suma', () => {
    const primero = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    expect(registrarIntento(primero, '1.8.0', '1.7.1', AHORA).intentos).toBe(2)
  })

  it('una versión más nueva empieza de cero: el antivirus pudo marcar sólo aquella', () => {
    const viejo = { version: '1.8.0', desde: '1.7.1', intentos: 5, ultimo: AHORA.toISOString() }
    expect(registrarIntento(viejo, '1.8.1', '1.7.1', AHORA).intentos).toBe(1)
  })

  it('sin registro no hay nada que revisar', () => {
    expect(evaluarIntento(null, '1.7.1')).toEqual({ estado: 'nada' })
  })

  it('si la versión instalada ya es la nueva, el instalador funcionó', () => {
    const intento = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    expect(evaluarIntento(intento, '1.8.0')).toEqual({ estado: 'instalada', version: '1.8.0' })
    // También si mientras tanto llegó otra más nueva por otro camino.
    expect(evaluarIntento(intento, '1.9.0').estado).toBe('instalada')
  })

  it('un fallo suelto se reintenta solo', () => {
    const intento = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    expect(evaluarIntento(intento, '1.7.1')).toEqual({
      estado: 'fallida',
      version: '1.8.0',
      intentos: 1,
      bloqueada: false
    })
  })

  it(`después de ${MAX_INTENTOS_AUTOMATICOS} fallos con la misma versión, deja de instalarse sola`, () => {
    let intento = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    for (let i = 1; i < MAX_INTENTOS_AUTOMATICOS; i++) {
      intento = registrarIntento(intento, '1.8.0', '1.7.1', AHORA)
    }
    const resultado = evaluarIntento(intento, '1.7.1')
    expect(resultado.estado).toBe('fallida')
    expect(resultado.estado === 'fallida' && resultado.bloqueada).toBe(true)
  })

  it('no insiste para siempre: el límite es chico', () => {
    // Cada intento fallido es el launcher cerrándose en la cara del jugador.
    expect(MAX_INTENTOS_AUTOMATICOS).toBeGreaterThanOrEqual(1)
    expect(MAX_INTENTOS_AUTOMATICOS).toBeLessThanOrEqual(3)
  })
})

describe('el registro en disco', () => {
  let dir: string
  let ruta: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'victoria-actualizacion-'))
    ruta = join(dir, 'actualizacion-launcher.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('guarda y lee lo mismo', () => {
    const intento = registrarIntento(null, '1.8.0', '1.7.1', AHORA)
    guardarIntento(ruta, intento)
    expect(leerIntento(ruta)).toEqual(intento)
  })

  it('sin archivo, no hay registro', () => {
    expect(leerIntento(ruta)).toBeNull()
  })

  it('un archivo roto cuenta como que no hay, en vez de romper el arranque', () => {
    writeFileSync(ruta, '{"version": "1.8.0", "intent')
    expect(leerIntento(ruta)).toBeNull()
    writeFileSync(ruta, JSON.stringify({ version: '1.8.0' }))
    expect(leerIntento(ruta)).toBeNull()
  })

  it('borrar deja todo como antes, y borrar dos veces no falla', () => {
    guardarIntento(ruta, registrarIntento(null, '1.8.0', '1.7.1', AHORA))
    borrarIntento(ruta)
    expect(existsSync(ruta)).toBe(false)
    expect(() => borrarIntento(ruta)).not.toThrow()
  })
})

describe('urlDescargaManual', () => {
  it('apunta al instalador de esa versión en la release', () => {
    expect(
      urlDescargaManual(
        'FalconKing574/victoria-launcher',
        '1.8.0',
        'Victoria-Kingdom-actualizacion-1.8.0.exe'
      )
    ).toBe(
      'https://github.com/FalconKing574/victoria-launcher/releases/download/v1.8.0/Victoria-Kingdom-actualizacion-1.8.0.exe'
    )
  })

  it('escapa un nombre con espacios', () => {
    expect(urlDescargaManual('a/b', '1.0.0', 'Victoria Kingdom Setup 1.0.0.exe')).toBe(
      'https://github.com/a/b/releases/download/v1.0.0/Victoria%20Kingdom%20Setup%201.0.0.exe'
    )
  })
})

describe('diagnosticarErrorActualizacion', () => {
  // Textos reales de electron-updater 6.x y de Node.
  it('archivo tocado por el antivirus mientras bajaba', () => {
    const d = diagnosticarErrorActualizacion(
      new Error('sha512 checksum mismatch, expected abc, got def')
    )
    expect(d.antivirus).toBe(true)
    expect(d.mensaje).not.toContain('sha512')
  })

  it('archivo que desapareció o no se pudo mover', () => {
    for (const crudo of [
      "ENOENT: no such file or directory, rename 'C:\\Users\\x\\AppData\\Local\\victoria-launcher-updater\\pending\\temp-Victoria-Kingdom-actualizacion-1.8.0.exe'",
      "EPERM: operation not permitted, open 'C:\\Users\\x\\AppData\\Local\\victoria-launcher-updater\\pending\\Victoria-Kingdom-actualizacion-1.8.0.exe'",
      'EBUSY: resource busy or locked',
      'spawn EACCES'
    ]) {
      const d = diagnosticarErrorActualizacion(new Error(crudo))
      expect(d.antivirus, crudo).toBe(true)
      expect(d.mensaje).toContain('antivirus')
      expect(d.mensaje).not.toContain('AppData')
    }
  })

  it('sin conexión no culpa al antivirus', () => {
    for (const crudo of [
      'net::ERR_INTERNET_DISCONNECTED',
      'getaddrinfo ENOTFOUND github.com',
      'connect ETIMEDOUT 140.82.112.3:443',
      'read ECONNRESET'
    ]) {
      const d = diagnosticarErrorActualizacion(new Error(crudo))
      expect(d.antivirus, crudo).toBe(false)
      expect(d.mensaje).toContain('conectar')
    }
  })

  it('release sin latest.yml', () => {
    const d = diagnosticarErrorActualizacion(
      new Error(
        'Cannot find latest.yml in the latest release artifacts (https://github.com/FalconKing574/victoria-launcher/releases/download/v1.8.0/latest.yml): HttpError: 404'
      )
    )
    expect(d.antivirus).toBe(false)
    expect(d.mensaje).toContain('No se encontró')
  })

  it('cualquier otra cosa: una línea, corta, y dice que se puede jugar', () => {
    const d = diagnosticarErrorActualizacion(new Error(`algo raro\n${'x'.repeat(500)}`))
    expect(d.mensaje).toContain('algo raro')
    expect(d.mensaje).toContain('Puedes jugar igual')
    expect(d.mensaje.length).toBeLessThan(260)
  })

  it('no revienta con lo que no es un Error', () => {
    expect(diagnosticarErrorActualizacion(undefined).mensaje).toContain('Puedes jugar igual')
    expect(diagnosticarErrorActualizacion('texto suelto').mensaje).toContain('texto suelto')
  })
})
