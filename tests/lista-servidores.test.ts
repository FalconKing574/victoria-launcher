import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  apuntaMal,
  asegurarListaServidores,
  DIRECCION_VICTORIA,
  escribirNbt,
  leerNbt,
  NOMBRE_VICTORIA,
  repararLista,
  type Etiqueta
} from '../src/main/lib/lista-servidores'

const entrada = (name: string, ip: string, extra: [string, Etiqueta][] = []): Map<string, Etiqueta> =>
  new Map<string, Etiqueta>([['name', { t: 8, v: name }], ['ip', { t: 8, v: ip }], ...extra])

function servidores(dir: string): { name: string; ip: string; icon?: string }[] {
  const { raiz } = leerNbt(readFileSync(join(dir, 'servers.dat')))
  if (raiz.t !== 10) throw new Error('raíz')
  const lista = raiz.v.get('servers')
  if (!lista || lista.t !== 9) throw new Error('lista')
  return lista.v.map((e) => {
    if (e.t !== 10) throw new Error('entrada')
    const s = (k: string): string | undefined => { const x = e.v.get(k); return x && x.t === 8 ? x.v : undefined }
    return { name: s('name') ?? '', ip: s('ip') ?? '', icon: s('icon') }
  })
}

function guardar(dir: string, entradas: Map<string, Etiqueta>[]): void {
  const raiz: Etiqueta = { t: 10, v: new Map([['servers', { t: 9, tipo: 10, v: entradas.map((v) => ({ t: 10 as const, v })) }]]) }
  writeFileSync(join(dir, 'servers.dat'), escribirNbt('', raiz))
}

describe('lista de servidores', () => {
  it('reconoce las direcciones de Victoria que no llegan al 25567', () => {
    expect(apuntaMal('131.221.32.76')).toBe(true)
    expect(apuntaMal('mc.victoriakingdom.com')).toBe(true)
    expect(apuntaMal('MC.VictoriaKingdom.com:25565')).toBe(true)
    expect(apuntaMal('131.221.32.76:25567')).toBe(false)
    expect(apuntaMal('mc.hypixel.net')).toBe(false)
  })

  it('sin servers.dat crea uno con Victoria', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-srv-'))
    expect(asegurarListaServidores(dir)).toBe(true)
    expect(servidores(dir)).toEqual([{ name: NOMBRE_VICTORIA, ip: DIRECCION_VICTORIA, icon: undefined }])
  })

  it('corrige la entrada sin puerto, la sube, saca la otra de Victoria y conserva el resto', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-srv-'))
    guardar(dir, [
      entrada('Hypixel', 'mc.hypixel.net'),
      entrada('Mi server', '131.221.32.76', [['icon', { t: 8, v: 'AAAA' }], ['hidden', { t: 1, v: 0 }]]),
      entrada('Otro nombre', 'mc.victoriakingdom.com:25565')
    ])
    expect(asegurarListaServidores(dir)).toBe(true)
    expect(servidores(dir)).toEqual([
      { name: NOMBRE_VICTORIA, ip: DIRECCION_VICTORIA, icon: 'AAAA' },
      { name: 'Hypixel', ip: 'mc.hypixel.net', icon: undefined }
    ])
    // La segunda vez no hay nada que hacer.
    expect(asegurarListaServidores(dir)).toBe(false)
  })

  it('borra las «mc.victoriakingdom.com» que fue sumando el botón JUGAR del menú', () => {
    // El servers.dat real de un jugador el 17-10-2026, después de seis partidas.
    const dir = mkdtempSync(join(tmpdir(), 'vk-srv-'))
    guardar(dir, [
      entrada(NOMBRE_VICTORIA, DIRECCION_VICTORIA),
      ...Array.from({ length: 5 }, () => entrada('mc.victoriakingdom.com', 'mc.victoriakingdom.com:25567')),
      entrada('Hypixel', 'mc.hypixel.net'),
      entrada('mc.victoriakingdom.com', 'mc.victoriakingdom.com')
    ])
    expect(asegurarListaServidores(dir)).toBe(true)
    expect(servidores(dir)).toEqual([
      { name: NOMBRE_VICTORIA, ip: DIRECCION_VICTORIA, icon: undefined },
      { name: 'Hypixel', ip: 'mc.hypixel.net', icon: undefined }
    ])
    expect(asegurarListaServidores(dir)).toBe(false)
  })

  it('un servers.dat que no se entiende queda como estaba', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-srv-'))
    writeFileSync(join(dir, 'servers.dat'), Buffer.from([1, 2, 3]))
    expect(asegurarListaServidores(dir)).toBe(false)
    expect(readFileSync(join(dir, 'servers.dat'))).toEqual(Buffer.from([1, 2, 3]))
  })

  it('leer y escribir devuelve los mismos bytes', () => {
    const raiz: Etiqueta = {
      t: 10,
      v: new Map<string, Etiqueta>([
        ['servers', { t: 9, tipo: 10, v: [{ t: 10, v: entrada('A', 'a:1', [['n', { t: 3, v: -5 }], ['l', { t: 4, v: 9n }]]) }] }],
        ['vacía', { t: 9, tipo: 0, v: [] }],
        ['bytes', { t: 7, v: Buffer.from([1, 2]) }],
        ['ints', { t: 11, v: new Int32Array([1, -1]) }]
      ])
    }
    const b = escribirNbt('', raiz)
    const leido = leerNbt(b)
    expect(escribirNbt(leido.nombre, leido.raiz)).toEqual(b)
  })

  it('no cambia nada si Victoria ya está bien y primera', () => {
    const { cambio } = repararLista([entrada(NOMBRE_VICTORIA, DIRECCION_VICTORIA), entrada('X', 'x.net')])
    expect(cambio).toBe(false)
  })
})
