import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createHash } from 'crypto'
import {
  artefactosDe,
  jarCliente,
  esFalloDeForge,
  repararMinecraft,
  marcarFalloForge
} from '../src/main/lib/reparar-minecraft'

const sha1 = (s: string): string => createHash('sha1').update(s).digest('hex')

describe('artefactosDe', () => {
  it('saca librerías, nativos y mavenFiles con su hash', () => {
    const json = {
      libraries: [
        { downloads: { artifact: { path: 'a/b/c.jar', sha1: 'A'.repeat(40) } } },
        { downloads: { classifiers: { 'natives-windows': { path: 'n/w.jar', sha1: 'b'.repeat(40) } } } },
        { name: 'sin-downloads' },
        { downloads: { artifact: { path: 'x.jar', sha1: 'corto' } } }
      ],
      mavenFiles: [{ downloads: { artifact: { path: 'm/p.zip', sha1: 'c'.repeat(40) } } }]
    }
    expect(artefactosDe(json)).toEqual([
      { ruta: 'libraries/a/b/c.jar', sha1: 'a'.repeat(40) },
      { ruta: 'libraries/n/w.jar', sha1: 'b'.repeat(40) },
      { ruta: 'libraries/m/p.zip', sha1: 'c'.repeat(40) }
    ])
  })

  it('no rompe con basura', () => {
    expect(artefactosDe(null)).toEqual([])
    expect(artefactosDe({ libraries: 'no' })).toEqual([])
  })

  it('el jar de Minecraft sale de downloads.client', () => {
    expect(jarCliente({ downloads: { client: { sha1: 'd'.repeat(40) } } }, '1.20.1')).toEqual({
      ruta: 'versions/1.20.1/1.20.1.jar',
      sha1: 'd'.repeat(40)
    })
    expect(jarCliente({}, '1.20.1')).toBeNull()
  })
})

describe('esFalloDeForge', () => {
  it('reconoce el error del jugador', () => {
    expect(esFalloDeForge('Failed to run processor: java.io.EOFException:Unexpected end of ZLIB input stream')).toBe(true)
    expect(esFalloDeForge('java.util.zip.ZipException: invalid entry compressed size')).toBe(true)
    expect(esFalloDeForge('[main/INFO]: Loading 125 mods')).toBe(false)
  })
})

describe('repararMinecraft', () => {
  let root: string
  const avisos: string[] = []

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'victoria-reparar-'))
    avisos.length = 0
    mkdirSync(join(root, 'versions', '1.20.1'), { recursive: true })
    mkdirSync(join(root, 'libraries', 'a'), { recursive: true })
    mkdirSync(join(root, 'libraries', 'net', 'minecraft', 'client', '1.20.1-20230612.114412'), { recursive: true })
    writeFileSync(join(root, 'libraries', 'net', 'minecraft', 'client', '1.20.1-20230612.114412', 'client-srg.jar'), 'x')
    mkdirSync(join(root, 'forge', '1.20.1'), { recursive: true })
    writeFileSync(join(root, 'forge', '1.20.1', 'version.json'), JSON.stringify({ libraries: [] }))
    writeFileSync(join(root, 'versions', '1.20.1', '1.20.1.jar'), 'cliente sano')
    writeFileSync(join(root, 'libraries', 'a', 'sana.jar'), 'sana')
    writeFileSync(join(root, 'libraries', 'a', 'rota.jar'), 'rota a medi')
    writeFileSync(
      join(root, 'versions', '1.20.1', '1.20.1.json'),
      JSON.stringify({
        downloads: { client: { sha1: sha1('cliente sano') } },
        libraries: [
          { downloads: { artifact: { path: 'a/sana.jar', sha1: sha1('sana') } } },
          { downloads: { artifact: { path: 'a/rota.jar', sha1: sha1('rota a medias') } } },
          { downloads: { artifact: { path: 'a/falta.jar', sha1: sha1('falta') } } }
        ]
      })
    )
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('borra sólo lo dañado y hace rearmar Forge', async () => {
    const r = await repararMinecraft(root, '1.20.1', '47.4.0', null, (m) => avisos.push(m))
    expect(r.borrados).toEqual(['libraries/a/rota.jar'])
    expect(r.revisados).toBe(3)
    expect(r.forgeRehecho).toBe(true)
    expect(existsSync(join(root, 'libraries', 'a', 'sana.jar'))).toBe(true)
    expect(existsSync(join(root, 'versions', '1.20.1', '1.20.1.jar'))).toBe(true)
    expect(existsSync(join(root, 'libraries', 'net', 'minecraft', 'client', '1.20.1-20230612.114412'))).toBe(false)
    expect(existsSync(join(root, 'forge', '1.20.1'))).toBe(false)
  })

  it('con todo sano no toca Forge, y la segunda vez usa la caché', async () => {
    rmSync(join(root, 'libraries', 'a', 'rota.jar'))
    const r = await repararMinecraft(root, '1.20.1', '47.4.0', null, () => undefined)
    expect(r.borrados).toEqual([])
    expect(r.forgeRehecho).toBe(false)
    expect(existsSync(join(root, 'forge', '1.20.1', 'version.json'))).toBe(true)
    const r2 = await repararMinecraft(root, '1.20.1', '47.4.0', null, () => undefined)
    expect(r2.revisados).toBe(2)
    expect(r2.forgeRehecho).toBe(false)
  })

  it('si el arranque anterior falló en Forge, lo rehace aunque todo esté sano', async () => {
    rmSync(join(root, 'libraries', 'a', 'rota.jar'))
    await marcarFalloForge(root)
    const r = await repararMinecraft(root, '1.20.1', '47.4.0', null, () => undefined)
    expect(r.forgeRehecho).toBe(true)
    expect(existsSync(join(root, 'cache', 'reparar-forge.flag'))).toBe(false)
  })

  it('un instalador que no abre como zip se borra', async () => {
    const inst = join(root, 'forge-installer.jar')
    writeFileSync(inst, 'esto no es un zip')
    const r = await repararMinecraft(root, '1.20.1', '47.4.0', inst, () => undefined)
    expect(existsSync(inst)).toBe(false)
    expect(r.borrados).toContain('forge installer')
  })
})
