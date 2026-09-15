import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'

const USER_DATA = join('C:', 'Users', 'quien-sea', 'AppData', 'Roaming', 'victoria-launcher')

vi.mock('electron', () => ({
  app: { getPath: (nombre: string) => (nombre === 'userData' ? USER_DATA : join(USER_DATA, nombre)) }
}))

import {
  crashLogPath,
  hashCachePath,
  instanceDir,
  launcherRoot,
  msTokenPath,
  settingsPath,
  syncStatePath
} from '../src/main/lib/paths'

/**
 * Qué protege esto.
 *
 * Acá vivió uno de los bugs más caros del launcher: la carpeta de la instancia
 * era una ruta fija al CurseForge del desarrollador, así que **a todos los demás
 * jugadores** les reventaba con
 *
 *   EPERM: operation not permitted, mkdir 'C:\\Users\\<otro>\\curseforge\\...'
 *
 * porque esa carpeta no es de ellos. Funcionaba perfecto en la máquina donde se
 * escribió, que es la peor clase de bug.
 *
 * La regla que salió de ahí —y que estos tests fijan— es que **todo cuelga de
 * `userData`**, que es propio de cada usuario, y que nada lleve un nombre de
 * usuario ni una carpeta de otro programa adentro.
 */
describe('rutas del launcher', () => {
  const antes = process.env.VICTORIA_INSTANCE_DIR

  beforeEach(() => {
    delete process.env.VICTORIA_INSTANCE_DIR
  })

  afterEach(() => {
    if (antes === undefined) delete process.env.VICTORIA_INSTANCE_DIR
    else process.env.VICTORIA_INSTANCE_DIR = antes
  })

  it('TODAS cuelgan de userData', () => {
    // El bug histórico en una línea: si alguna se sale de acá, es de otro.
    for (const ruta of [
      launcherRoot(),
      instanceDir(),
      settingsPath(),
      msTokenPath(),
      crashLogPath(),
      syncStatePath(),
      hashCachePath()
    ]) {
      expect(ruta.startsWith(USER_DATA)).toBe(true)
    }
  })

  it('ninguna nombra a un usuario ni a otro programa', () => {
    for (const ruta of [launcherRoot(), instanceDir(), syncStatePath(), hashCachePath()]) {
      expect(ruta.toLowerCase()).not.toContain('curseforge')
      expect(ruta.toLowerCase()).not.toContain('falconkingman')
    }
  })

  it('VICTORIA_INSTANCE_DIR manda sobre la instancia, y sólo sobre ella', () => {
    // Es la vía para reusar una instancia de CurseForge existente. Si dejara de
    // funcionar, quien la usa se encontraría con el pack bajándose de cero.
    const propia = join('D:', 'mi', 'instancia')
    process.env.VICTORIA_INSTANCE_DIR = propia

    expect(instanceDir()).toBe(propia)
    // El estado y el caché NO se mueven con ella: son del launcher, no del pack.
    expect(syncStatePath().startsWith(USER_DATA)).toBe(true)
    expect(hashCachePath().startsWith(USER_DATA)).toBe(true)
  })

  it('el estado y el caché viven fuera de la instancia', () => {
    // A propósito: si se borra la instancia, el registro de qué instaló el
    // launcher no se va con ella.
    expect(syncStatePath().startsWith(instanceDir())).toBe(false)
    expect(hashCachePath().startsWith(instanceDir())).toBe(false)
  })

  it('cada archivo tiene su propio nombre', () => {
    const rutas = [settingsPath(), msTokenPath(), crashLogPath(), syncStatePath(), hashCachePath()]
    expect(new Set(rutas).size).toBe(rutas.length)
  })
})
