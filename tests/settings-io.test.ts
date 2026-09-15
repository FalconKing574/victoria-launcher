import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let raiz = ''

vi.mock('../src/main/lib/paths', () => ({
  settingsPath: () => join(raiz, 'settings.json')
}))

import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../src/main/lib/settings'

/**
 * Qué protege esto.
 *
 * `settings-core` ya tiene sus tests, pero el que lee y escribe el archivo no
 * tenía ninguno — y ahí están los dos comportamientos que deciden si el jugador
 * puede seguir usando el launcher:
 *
 *  1. Un settings.json corrupto **no puede impedir que el launcher abra**. Si
 *     `loadSettings` dejara escapar la excepción, un archivo a medio escribir
 *     dejaría la app inutilizable y el jugador no tendría forma de arreglarlo
 *     sin borrar archivos a mano.
 *  2. Guardar es **atómico**. Antes era un `writeFileSync` directo: un corte a
 *     la mitad dejaba un archivo que no parsea, y el punto 1 lo tapaba
 *     volviendo a los valores por defecto — o sea que el jugador perdía su
 *     memoria asignada, su Java y su música en silencio.
 */
describe('settings en disco', () => {
  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), 'victoria-settings-'))
  })

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true })
  })

  it('sin archivo devuelve los valores por defecto', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('un archivo corrupto NO rompe el launcher', () => {
    // El caso que importa: la app tiene que abrir igual.
    writeFileSync(join(raiz, 'settings.json'), '{ esto no es json', 'utf8')

    expect(() => loadSettings()).not.toThrow()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('un archivo vacío tampoco', () => {
    writeFileSync(join(raiz, 'settings.json'), '', 'utf8')

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('guarda y vuelve a leer lo guardado', () => {
    const guardado = saveSettings({ maxMemoryMb: 6144 })

    expect(guardado.maxMemoryMb).toBe(6144)
    expect(loadSettings().maxMemoryMb).toBe(6144)
  })

  it('un patch cambia sólo lo suyo y respeta el resto', () => {
    saveSettings({ maxMemoryMb: 6144 })
    saveSettings({ musicEnabled: false })

    const final = loadSettings()
    expect(final.maxMemoryMb).toBe(6144)
    expect(final.musicEnabled).toBe(false)
  })

  it('escribe de forma atómica y no deja .tmp', () => {
    // Lo que evita que un corte de luz le borre la configuración al jugador.
    saveSettings({ maxMemoryMb: 4096 })

    expect(readdirSync(raiz)).toEqual(['settings.json'])
    expect(existsSync(join(raiz, 'settings.json.tmp'))).toBe(false)
  })

  it('el archivo queda como JSON legible', () => {
    // Se edita a mano cuando algo va mal, así que tiene que poder leerse.
    saveSettings({ maxMemoryMb: 8192 })
    const texto = readFileSync(join(raiz, 'settings.json'), 'utf8')

    expect(() => JSON.parse(texto)).not.toThrow()
    expect(texto).toContain('\n')
  })

  it('guardar sobre un archivo corrupto lo deja sano', () => {
    // Es cómo sale el jugador del pozo sin borrar nada a mano: cambia cualquier
    // ajuste y el archivo vuelve a ser válido.
    writeFileSync(join(raiz, 'settings.json'), 'roto', 'utf8')

    saveSettings({ maxMemoryMb: 2048 })

    expect(loadSettings().maxMemoryMb).toBe(2048)
  })
})
