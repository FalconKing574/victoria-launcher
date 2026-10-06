/**
 * La configuración gráfica con la que arranca un jugador nuevo (02-10-2026).
 *
 * Lo que no se puede romper: que se toquen SOLO las líneas de video. options.txt
 * es del jugador —teclas, sonido, idioma— y un preset que se las pise es peor que
 * no tener preset.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { aplicarOpciones, esPreset, presetSugerido, PRESETS } from '../src/preload/opciones-graficas'

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

let userData = ''
let instancia = ''

const { ensureResourcePack, aplicarPreset } = await import('../src/main/ipc/sync')

function valor(texto: string, clave: string): string | undefined {
  return texto
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${clave}:`))
    ?.slice(clave.length + 1)
}

describe('aplicarOpciones', () => {
  it('cambia sólo las claves pedidas y deja el resto en su lugar', () => {
    const antes = 'key_key.forward:key.keyboard.w\nrenderDistance:32\nsoundCategory_master:0.35\n'
    const despues = aplicarOpciones(antes, { renderDistance: '12', graphicsMode: '0' })
    expect(despues).toBe('key_key.forward:key.keyboard.w\nrenderDistance:12\nsoundCategory_master:0.35\ngraphicsMode:0\n')
  })

  it('arma el archivo desde cero', () => {
    expect(aplicarOpciones(null, { maxFps: '120' })).toBe('maxFps:120\n')
  })

  it('no multiplica las líneas vacías al reescribir', () => {
    const una = aplicarOpciones('fov:1.0\n', { maxFps: '120' })
    expect(aplicarOpciones(una, { maxFps: '60' })).toBe('fov:1.0\nmaxFps:60\n')
  })
})

describe('presets', () => {
  it('ninguno toca teclas, sonido, idioma ni campo de visión', () => {
    for (const valores of Object.values(PRESETS)) {
      for (const clave of Object.keys(valores)) {
        expect(clave.startsWith('key_')).toBe(false)
        expect(clave.startsWith('soundCategory')).toBe(false)
        expect(['lang', 'fov', 'mouseSensitivity', 'resourcePacks', 'guiScale']).not.toContain(clave)
      }
    }
  })

  it('la sugerencia sigue a la placa y a la memoria', () => {
    expect(presetSugerido('intel', 32768)).toBe('liviana')
    expect(presetSugerido('otra', 8192)).toBe('liviana')
    expect(presetSugerido('nvidia', 8192)).toBe('equilibrada')
    expect(presetSugerido('amd', 32768)).toBe('alta')
    expect(esPreset('alta')).toBe(true)
    expect(esPreset('ultra')).toBe(false)
  })
})

describe('options.txt del jugador nuevo', () => {
  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'victoria-graf-'))
    instancia = join(userData, 'instance')
    mkdirSync(instancia, { recursive: true })
    process.env.VICTORIA_INSTANCE_DIR = instancia
  })

  afterEach(() => {
    delete process.env.VICTORIA_INSTANCE_DIR
    rmSync(userData, { recursive: true, force: true })
  })

  it('arranca con la equilibrada y el resource pack prendido', () => {
    ensureResourcePack()
    const texto = readFileSync(join(instancia, 'options.txt'), 'utf8')
    expect(valor(texto, 'renderDistance')).toBe(PRESETS.equilibrada.renderDistance)
    expect(valor(texto, 'graphicsMode')).toBe(PRESETS.equilibrada.graphicsMode)
    expect(valor(texto, 'resourcePacks')).toBe('["vanilla","file/Victoria - RP.zip"]')
  })

  it('el que ya jugó conserva su video: ensureResourcePack no le aplica el preset', () => {
    writeFileSync(join(instancia, 'options.txt'), 'renderDistance:32\nresourcePacks:["vanilla","file/Victoria - RP.zip"]\n', 'utf8')
    ensureResourcePack()
    expect(valor(readFileSync(join(instancia, 'options.txt'), 'utf8'), 'renderDistance')).toBe('32')
  })

  it('el preset elegido en el tutorial pisa sólo el video', () => {
    writeFileSync(join(instancia, 'options.txt'), 'key_key.jump:key.keyboard.space\nrenderDistance:32\n', 'utf8')
    aplicarPreset('liviana')
    const texto = readFileSync(join(instancia, 'options.txt'), 'utf8')
    expect(valor(texto, 'renderDistance')).toBe('8')
    expect(valor(texto, 'key_key.jump')).toBe('key.keyboard.space')
    expect(valor(texto, 'resourcePacks')).toBe('["vanilla","file/Victoria - RP.zip"]')
  })
})
