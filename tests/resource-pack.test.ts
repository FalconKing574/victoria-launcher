/**
 * Que el pack de Victoria quede encendido en `options.txt`.
 *
 * Esta función ya se rompió dos veces y las dos pasó inadvertida, porque su
 * síntoma no se parece en nada a su causa: sin el pack se van las hojas de
 * glifos que le agrega a `minecraft:default` y **la interfaz entera del juego se
 * dibuja en cajitas**. Nadie mira el launcher cuando ve eso.
 *
 *   1. Corría dentro de `if (overridesApplied)`. Los overrides sólo cambian
 *      cuando se publica una versión que los toca, así que una instancia que
 *      perdía la línea no la recuperaba nunca más.
 *   2. No reponía `vanilla`. Cuando Minecraft descarta los packs por un config
 *      roto deja la lista VACÍA, y agregarle sólo Victoria daba un orden que el
 *      juego nunca escribe.
 *
 * Toca disco de verdad --es edición de archivo, no lógica-- sobre una carpeta
 * temporal, vía `VICTORIA_INSTANCE_DIR`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

let userData = ''
let instancia = ''

const { ensureResourcePack } = await import('../src/main/ipc/sync')

const PACK = 'file/Victoria - RP.zip'
const OPCIONES = () => join(instancia, 'options.txt')

/** La línea `resourcePacks:` tal cual quedó, o `null` si no hay. */
function linea(): string | null {
  const l = readFileSync(OPCIONES(), 'utf8')
    .split(/\r?\n/)
    .find((x) => x.startsWith('resourcePacks:'))
  return l ?? null
}

function packs(): string[] {
  const l = linea()
  return l ? (JSON.parse(l.slice('resourcePacks:'.length)) as string[]) : []
}

beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'victoria-pack-'))
  instancia = join(userData, 'instance')
  mkdirSync(instancia, { recursive: true })
  process.env.VICTORIA_INSTANCE_DIR = instancia
})

afterEach(() => {
  delete process.env.VICTORIA_INSTANCE_DIR
  rmSync(userData, { recursive: true, force: true })
})

describe('ensureResourcePack', () => {
  it('crea options.txt cuando la instancia es nueva', () => {
    rmSync(instancia, { recursive: true, force: true })
    ensureResourcePack()
    expect(existsSync(OPCIONES())).toBe(true)
    expect(packs()).toEqual(['vanilla', PACK])
  })

  it('repone vanilla cuando Minecraft dejó la lista vacía', () => {
    // El estado exacto que deja `removing all selected resourcepacks`.
    writeFileSync(OPCIONES(), 'lang:es_ar\nresourcePacks:[]\nfov:1.0\n', 'utf8')
    ensureResourcePack()
    expect(packs()).toEqual(['vanilla', PACK])
  })

  it('agrega el pack al final y deja los otros donde estaban', () => {
    writeFileSync(
      OPCIONES(),
      `resourcePacks:["vanilla","file/otro.zip"]\n`,
      'utf8'
    )
    ensureResourcePack()
    expect(packs()).toEqual(['vanilla', 'file/otro.zip', PACK])
  })

  it('no toca nada si el pack ya está', () => {
    const antes = `lang:es_ar\nresourcePacks:["vanilla","${PACK}"]\nfov:1.0\n`
    writeFileSync(OPCIONES(), antes, 'utf8')
    ensureResourcePack()
    expect(readFileSync(OPCIONES(), 'utf8')).toBe(antes)
  })

  it('no pisa el resto de options.txt', () => {
    // Es el archivo del jugador: teclas, video, volumen. Se edita una línea.
    writeFileSync(
      OPCIONES(),
      'key_key.forward:key.keyboard.w\nresourcePacks:[]\nsoundCategory_master:0.35\n',
      'utf8'
    )
    ensureResourcePack()
    const texto = readFileSync(OPCIONES(), 'utf8')
    expect(texto).toContain('key_key.forward:key.keyboard.w')
    expect(texto).toContain('soundCategory_master:0.35')
  })

  it('agrega la línea si options.txt no la tiene', () => {
    writeFileSync(OPCIONES(), 'lang:es_ar\n', 'utf8')
    ensureResourcePack()
    expect(packs()).toEqual(['vanilla', PACK])
  })

  it('no revienta con un options.txt corrupto', () => {
    // Que el pack quede apagado es molesto; que falle la instalación entera por
    // un archivo del jugador que no se puede leer, no.
    writeFileSync(OPCIONES(), 'resourcePacks:[esto no es JSON\n', 'utf8')
    expect(() => ensureResourcePack()).not.toThrow()
  })
})
