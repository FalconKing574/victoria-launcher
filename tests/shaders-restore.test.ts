/**
 * Dónde acaba cada archivo de shader, contra disco de verdad.
 *
 * El resto de los tests son de lógica pura, pero esto no se puede comprobar
 * así: la regla es «en `shaderpacks/` solo está el que se usa», y eso es
 * movimiento de archivos. `electron` se sustituye por un doble, así que sigue
 * corriendo en Node sin abrir nada.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userData = ''
const handlers = new Map<string, (event: unknown, ...args: never[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: never[]) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

interface Pack {
  filename: string
  name: string
  sizeBytes: number
}
interface Removed extends Pack {
  restorable: boolean
}
interface Settings {
  enabled: boolean
  selected: string | null
  packs: Pack[]
  removed: Removed[]
  installed: boolean
}

const call = (channel: string, ...args: unknown[]): Settings =>
  handlers.get(channel)!(null, ...(args as never[])) as Settings

/** Lo que ve Minecraft. */
const inGame = (): string => join(userData, 'instance', 'shaderpacks')
/** Instalados pero aparcados fuera del alcance del juego. */
const library = (): string => join(userData, 'minecraft', 'shaders-library')
const trash = (): string => join(userData, 'minecraft', 'shaders-trash')
const removedList = (): string => join(userData, 'minecraft', 'shaders-removed.json')
const configFile = (): string => join(userData, 'instance', 'config', 'oculus.properties')

const BSL = 'BSL_v8.4.zip'
const COMP = 'ComplementaryReimagined_r5.8.1.zip'

const names = (packs: Pack[]): string[] => packs.map((p) => p.filename).sort()

async function boot(): Promise<void> {
  vi.resetModules()
  const shaders = await import('../src/main/ipc/shaders')
  shaders.registerShaderHandlers()
}

beforeEach(async () => {
  handlers.clear()
  userData = mkdtempSync(join(tmpdir(), 'victoria-shaders-'))
  mkdirSync(inGame(), { recursive: true })
  writeFileSync(join(inGame(), BSL), 'zip-bsl')
  writeFileSync(join(inGame(), COMP), 'zip-comp')
  await boot()
})

afterEach(() => {
  rmSync(userData, { recursive: true, force: true })
})

describe('en shaderpacks/ solo está el que se usa', () => {
  it('con los shaders apagados la carpeta del juego queda vacía', () => {
    // Arrancar ya coloca: la instancia venía con los dos dentro.
    expect(existsSync(join(inGame(), BSL))).toBe(false)
    expect(existsSync(join(inGame(), COMP))).toBe(false)
    // Pero siguen instalados y se siguen viendo en la pantalla.
    expect(existsSync(join(library(), BSL))).toBe(true)
    expect(names(call('shaders:get').packs)).toEqual([BSL, COMP])
  })

  it('elegir uno lo mete en la carpeta y aparca el anterior', () => {
    call('shaders:set-enabled', true)
    call('shaders:select', COMP)
    expect(existsSync(join(inGame(), COMP))).toBe(true)
    expect(existsSync(join(inGame(), BSL))).toBe(false)

    call('shaders:select', BSL)
    expect(existsSync(join(inGame(), BSL))).toBe(true)
    expect(existsSync(join(inGame(), COMP))).toBe(false)
    expect(existsSync(join(library(), COMP))).toBe(true)
  })

  it('dejar de usarlo lo saca de la carpeta sin desinstalarlo', () => {
    call('shaders:set-enabled', true)
    call('shaders:select', BSL)
    expect(existsSync(join(inGame(), BSL))).toBe(true)

    const after = call('shaders:set-enabled', false)

    // Esto es lo pedido: no está donde Minecraft lo cargaría...
    expect(existsSync(join(inGame(), BSL))).toBe(false)
    expect(readFileSync(configFile(), 'utf8')).toContain('enableShaders=false')
    // ...pero no se ha borrado ni se ha perdido la elección.
    expect(existsSync(join(library(), BSL))).toBe(true)
    expect(readFileSync(join(library(), BSL), 'utf8')).toBe('zip-bsl')
    expect(names(after.packs)).toEqual([BSL, COMP])
    expect(after.selected).toBe(BSL)
    expect(after.removed).toEqual([])
  })

  it('volver a encenderlo devuelve el mismo, no el primero de la lista', () => {
    call('shaders:set-enabled', true)
    call('shaders:select', BSL)
    call('shaders:set-enabled', false)

    const after = call('shaders:set-enabled', true)

    // Complementary va antes alfabéticamente: si se adoptara el primero de la
    // lista, apagar y encender cambiaría de shader sin pedirlo.
    expect(after.selected).toBe(BSL)
    expect(existsSync(join(inGame(), BSL))).toBe(true)
    expect(existsSync(join(inGame(), COMP))).toBe(false)
  })

  it('la instancia sigue contando como instalada con la carpeta vacía', () => {
    expect(call('shaders:get').installed).toBe(true)
  })

  it('un .zip copiado a mano se aparca al abrir el launcher y aparece en la lista', async () => {
    writeFileSync(join(inGame(), 'Solas Shader V3.7.zip'), 'zip-solas')
    await boot()

    expect(existsSync(join(inGame(), 'Solas Shader V3.7.zip'))).toBe(false)
    expect(names(call('shaders:get').packs)).toEqual([BSL, COMP, 'Solas Shader V3.7.zip'])
  })
})

describe('quitar y recuperar shaders', () => {
  it('quitar manda el archivo a la papelera en vez de destruirlo', () => {
    const after = call('shaders:delete', BSL)

    expect(existsSync(join(inGame(), BSL))).toBe(false)
    expect(existsSync(join(library(), BSL))).toBe(false)
    expect(existsSync(join(trash(), BSL))).toBe(true)
    expect(names(after.packs)).toEqual([COMP])
    expect(after.removed.map((p) => p.filename)).toEqual([BSL])
    expect(after.removed[0].restorable).toBe(true)
  })

  it('quitar el que está en uso también funciona', () => {
    call('shaders:set-enabled', true)
    call('shaders:select', BSL)

    const after = call('shaders:delete', BSL)

    expect(existsSync(join(trash(), BSL))).toBe(true)
    expect(after.removed.map((p) => p.filename)).toEqual([BSL])
    // La elección pasa al que queda, y ese entra en la carpeta del juego.
    expect(after.selected).toBe(COMP)
    expect(existsSync(join(inGame(), COMP))).toBe(true)
  })

  it('recuperar lo reinstala sin ponérselo', () => {
    call('shaders:delete', BSL)
    const after = call('shaders:restore', BSL)

    // Vuelve a estar instalado y visible...
    expect(names(after.packs)).toEqual([BSL, COMP])
    expect(readFileSync(join(library(), BSL), 'utf8')).toBe('zip-bsl')
    // ...pero recuperarlo no es ponérselo, así que no entra en la carpeta.
    expect(existsSync(join(inGame(), BSL))).toBe(false)
    expect(after.removed).toEqual([])
    expect(JSON.parse(readFileSync(removedList(), 'utf8'))).toEqual([])
  })

  it('aguanta quitar y recuperar el mismo shader dos veces', () => {
    call('shaders:delete', BSL)
    call('shaders:restore', BSL)
    call('shaders:delete', BSL)
    const after = call('shaders:restore', BSL)

    expect(names(after.packs)).toEqual([BSL, COMP])
    expect(after.removed).toEqual([])
  })

  it('lista lo que borró la versión vieja, marcado como no recuperable', () => {
    mkdirSync(join(userData, 'minecraft'), { recursive: true })
    writeFileSync(removedList(), JSON.stringify(['Solas Shader V3.7.zip']))

    const settings = call('shaders:get')
    expect(settings.removed.map((p) => p.filename)).toEqual(['Solas Shader V3.7.zip'])
    expect(settings.removed[0].restorable).toBe(false)
  })

  it('desbloquear uno heredado lo saca de la lista para que el pack lo reinstale', () => {
    mkdirSync(join(userData, 'minecraft'), { recursive: true })
    writeFileSync(removedList(), JSON.stringify(['Solas Shader V3.7.zip']))

    const after = call('shaders:restore', 'Solas Shader V3.7.zip')

    expect(after.removed).toEqual([])
    expect(JSON.parse(readFileSync(removedList(), 'utf8'))).toEqual([])
  })

  it('no lista como quitado algo que sigue instalado', () => {
    mkdirSync(join(userData, 'minecraft'), { recursive: true })
    writeFileSync(removedList(), JSON.stringify([BSL]))

    const settings = call('shaders:get')
    expect(names(settings.packs)).toContain(BSL)
    expect(settings.removed).toEqual([])
  })
})

describe('después de que el pack se actualice', () => {
  it('guarda lo quitado y vuelve a aparcar lo que no se usa', async () => {
    call('shaders:set-enabled', true)
    call('shaders:select', COMP)
    call('shaders:delete', BSL)

    // El pack extrae otra vez TODOS sus shaderpacks encima de la instancia.
    writeFileSync(join(inGame(), BSL), 'zip-bsl')
    writeFileSync(join(inGame(), COMP), 'zip-comp')
    writeFileSync(join(inGame(), 'Solas Shader V3.7.zip'), 'zip-solas')

    const shaders = await import('../src/main/ipc/shaders')
    shaders.pruneDeletedShaders()

    // El quitado no vuelve, y sigue siendo recuperable.
    expect(existsSync(join(inGame(), BSL))).toBe(false)
    expect(existsSync(join(trash(), BSL))).toBe(true)
    // En la carpeta del juego queda solo el que se usa.
    expect(existsSync(join(inGame(), COMP))).toBe(true)
    expect(existsSync(join(inGame(), 'Solas Shader V3.7.zip'))).toBe(false)
    // El nuevo del pack queda instalado y a la vista.
    expect(names(call('shaders:get').packs)).toEqual([COMP, 'Solas Shader V3.7.zip'])
  })
})
