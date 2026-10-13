import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SERVIDOR_MINECRAFT } from '../config'

/**
 * La lista de servidores de Minecraft (`servers.dat`) siempre con Victoria bien escrita.
 *
 * Por qué: la IP del hosting la comparten varios servidores. En el puerto de siempre (25565)
 * contesta el de otro cliente, un vanilla de la última versión, y Victoria está en el 25567.
 * `mc.victoriakingdom.com` sólo llega al 25567 por el registro SRV, y si el jugador escribe la IP
 * pelada, pone `:25565` o su router no resuelve SRV, Minecraft cae en el otro servidor y dice
 * «¡Cliente no compatible! Por favor, usa 26.3» (13-10-2026).
 *
 * Antes de cada arranque el launcher deja arriba de todo una entrada «Victoria Kingdom» con la IP
 * y el puerto escritos, sin depender del SRV, y corrige las entradas que el jugador haya agregado
 * a mano apuntando a Victoria sin puerto o con el puerto equivocado. El resto de la lista no se
 * toca.
 */

export const NOMBRE_VICTORIA = 'Victoria Kingdom'
export const DIRECCION_VICTORIA = `${SERVIDOR_MINECRAFT.host}:${SERVIDOR_MINECRAFT.puerto}`

/** Hosts que son Victoria: la IP y los nombres del dominio. */
const HOSTS_VICTORIA = new Set([SERVIDOR_MINECRAFT.host, 'mc.victoriakingdom.com', 'victoriakingdom.com', 'play.victoriakingdom.com'])

// ---------------------------------------------------------------------------------------- NBT
// servers.dat es NBT sin comprimir. Se lee y se escribe entero, sin perder ningún campo que no
// conozcamos (íconos, hidden, acceptTextures…).

export type Etiqueta =
  | { t: 1; v: number }
  | { t: 2; v: number }
  | { t: 3; v: number }
  | { t: 4; v: bigint }
  | { t: 5; v: number }
  | { t: 6; v: number }
  | { t: 7; v: Buffer }
  | { t: 8; v: string }
  | { t: 9; tipo: number; v: Etiqueta[] }
  | { t: 10; v: Map<string, Etiqueta> }
  | { t: 11; v: Int32Array }
  | { t: 12; v: BigInt64Array }

class Lector {
  pos = 0
  constructor(private readonly b: Buffer) {}
  u8(): number { return this.b.readUInt8(this.pos++) }
  i8(): number { return this.b.readInt8(this.pos++) }
  i16(): number { const v = this.b.readInt16BE(this.pos); this.pos += 2; return v }
  u16(): number { const v = this.b.readUInt16BE(this.pos); this.pos += 2; return v }
  i32(): number { const v = this.b.readInt32BE(this.pos); this.pos += 4; return v }
  i64(): bigint { const v = this.b.readBigInt64BE(this.pos); this.pos += 8; return v }
  f32(): number { const v = this.b.readFloatBE(this.pos); this.pos += 4; return v }
  f64(): number { const v = this.b.readDoubleBE(this.pos); this.pos += 8; return v }
  texto(): string {
    const n = this.u16()
    const v = this.b.toString('utf8', this.pos, this.pos + n)
    this.pos += n
    return v
  }
  carga(t: number): Etiqueta {
    switch (t) {
      case 1: return { t, v: this.i8() }
      case 2: return { t, v: this.i16() }
      case 3: return { t, v: this.i32() }
      case 4: return { t, v: this.i64() }
      case 5: return { t, v: this.f32() }
      case 6: return { t, v: this.f64() }
      case 7: { const n = this.i32(); const v = Buffer.from(this.b.subarray(this.pos, this.pos + n)); this.pos += n; return { t, v } }
      case 8: return { t, v: this.texto() }
      case 9: {
        const tipo = this.u8()
        const n = this.i32()
        const v: Etiqueta[] = []
        for (let i = 0; i < n; i++) v.push(this.carga(tipo))
        return { t, tipo, v }
      }
      case 10: {
        const v = new Map<string, Etiqueta>()
        for (;;) {
          const hijo = this.u8()
          if (hijo === 0) break
          const nombre = this.texto()
          v.set(nombre, this.carga(hijo))
        }
        return { t, v }
      }
      case 11: { const n = this.i32(); const v = new Int32Array(n); for (let i = 0; i < n; i++) v[i] = this.i32(); return { t, v } }
      case 12: { const n = this.i32(); const v = new BigInt64Array(n); for (let i = 0; i < n; i++) v[i] = this.i64(); return { t, v } }
      default: throw new Error(`Etiqueta NBT desconocida: ${t}`)
    }
  }
}

export function leerNbt(b: Buffer): { nombre: string; raiz: Etiqueta } {
  const l = new Lector(b)
  const t = l.u8()
  if (t !== 10) throw new Error('servers.dat no empieza con un compuesto')
  const nombre = l.texto()
  return { nombre, raiz: l.carga(10) }
}

function escribirTexto(partes: Buffer[], s: string): void {
  const datos = Buffer.from(s, 'utf8')
  const n = Buffer.alloc(2)
  n.writeUInt16BE(datos.length)
  partes.push(n, datos)
}

function escribirCarga(partes: Buffer[], e: Etiqueta): void {
  const num = (bytes: number, f: (b: Buffer) => void): void => { const b = Buffer.alloc(bytes); f(b); partes.push(b) }
  switch (e.t) {
    case 1: return num(1, (b) => b.writeInt8(e.v))
    case 2: return num(2, (b) => b.writeInt16BE(e.v))
    case 3: return num(4, (b) => b.writeInt32BE(e.v))
    case 4: return num(8, (b) => b.writeBigInt64BE(e.v))
    case 5: return num(4, (b) => b.writeFloatBE(e.v))
    case 6: return num(8, (b) => b.writeDoubleBE(e.v))
    case 7: num(4, (b) => b.writeInt32BE(e.v.length)); partes.push(e.v); return
    case 8: return escribirTexto(partes, e.v)
    case 9:
      partes.push(Buffer.from([e.v.length ? e.v[0].t : e.tipo]))
      num(4, (b) => b.writeInt32BE(e.v.length))
      for (const h of e.v) escribirCarga(partes, h)
      return
    case 10:
      for (const [nombre, h] of e.v) {
        partes.push(Buffer.from([h.t]))
        escribirTexto(partes, nombre)
        escribirCarga(partes, h)
      }
      partes.push(Buffer.from([0]))
      return
    case 11: num(4, (b) => b.writeInt32BE(e.v.length)); for (const x of e.v) num(4, (b) => b.writeInt32BE(x)); return
    case 12: num(4, (b) => b.writeInt32BE(e.v.length)); for (const x of e.v) num(8, (b) => b.writeBigInt64BE(x)); return
  }
}

export function escribirNbt(nombre: string, raiz: Etiqueta): Buffer {
  const partes: Buffer[] = [Buffer.from([10])]
  escribirTexto(partes, nombre)
  escribirCarga(partes, raiz)
  return Buffer.concat(partes)
}

// ------------------------------------------------------------------------------ la reparación

/** Separa `host[:puerto]`, con IPv6 entre corchetes. */
function separar(direccion: string): { host: string; puerto: number | null } {
  const d = direccion.trim()
  const v6 = /^\[(.+)\](?::(\d+))?$/.exec(d)
  if (v6) return { host: v6[1].toLowerCase(), puerto: v6[2] ? Number(v6[2]) : null }
  const i = d.lastIndexOf(':')
  if (i > 0 && d.indexOf(':') === i && /^\d+$/.test(d.slice(i + 1))) {
    return { host: d.slice(0, i).toLowerCase().replace(/\.$/, ''), puerto: Number(d.slice(i + 1)) }
  }
  return { host: d.toLowerCase().replace(/\.$/, ''), puerto: null }
}

/** ¿Es una dirección de Victoria? Con o sin puerto. */
export function esVictoria(direccion: string): boolean {
  return HOSTS_VICTORIA.has(separar(direccion).host)
}

/** ¿Es de Victoria pero no llega al puerto bueno? */
export function apuntaMal(direccion: string): boolean {
  const { host, puerto } = separar(direccion)
  return HOSTS_VICTORIA.has(host) && puerto !== SERVIDOR_MINECRAFT.puerto
}

function texto(c: Map<string, Etiqueta>, clave: string): string {
  const e = c.get(clave)
  return e && e.t === 8 ? e.v : ''
}

/**
 * Devuelve la lista arreglada y si cambió algo.
 *
 * - Una sola entrada «Victoria Kingdom», primera, con `DIRECCION_VICTORIA`. Si ya había una de
 *   Victoria (aunque se llame distinto), se reusa y se sube, con su ícono.
 * - Cualquier otra entrada de Victoria con el puerto mal se corrige al bueno.
 * - Las entradas de otros servidores quedan iguales y en su orden.
 */
export function repararLista(entradas: Map<string, Etiqueta>[]): { lista: Map<string, Etiqueta>[]; cambio: boolean } {
  const lista = entradas.map((e) => new Map(e))
  let cambio = false

  for (const e of lista) {
    const ip = texto(e, 'ip')
    if (ip && apuntaMal(ip)) {
      const { host } = separar(ip)
      e.set('ip', { t: 8, v: host === SERVIDOR_MINECRAFT.host ? DIRECCION_VICTORIA : `${host}:${SERVIDOR_MINECRAFT.puerto}` })
      cambio = true
    }
  }

  let i = lista.findIndex((e) => texto(e, 'name') === NOMBRE_VICTORIA && esVictoria(texto(e, 'ip')))
  if (i < 0) i = lista.findIndex((e) => esVictoria(texto(e, 'ip')))
  let principal: Map<string, Etiqueta>
  if (i < 0) {
    principal = new Map<string, Etiqueta>([
      ['name', { t: 8, v: NOMBRE_VICTORIA }],
      ['ip', { t: 8, v: DIRECCION_VICTORIA }],
      ['acceptTextures', { t: 1, v: 1 }]
    ])
    lista.unshift(principal)
    return { lista, cambio: true }
  }
  principal = lista[i]
  if (texto(principal, 'name') !== NOMBRE_VICTORIA) { principal.set('name', { t: 8, v: NOMBRE_VICTORIA }); cambio = true }
  if (texto(principal, 'ip') !== DIRECCION_VICTORIA) { principal.set('ip', { t: 8, v: DIRECCION_VICTORIA }); cambio = true }
  const oculta = principal.get('hidden')
  if (oculta && oculta.t === 1 && oculta.v !== 0) { principal.set('hidden', { t: 1, v: 0 }); cambio = true }
  if (i !== 0) {
    lista.splice(i, 1)
    lista.unshift(principal)
    cambio = true
  }
  return { lista, cambio }
}

/**
 * Lee, arregla y guarda `servers.dat` de la instancia. Nunca rompe el arranque: si el archivo no
 * se puede leer (dañado, de otra versión), se deja como está y sólo se agrega Victoria si no
 * existía.
 */
export function asegurarListaServidores(instancia: string): boolean {
  const ruta = join(instancia, 'servers.dat')
  let nombre = ''
  let raiz: Map<string, Etiqueta> = new Map()
  if (existsSync(ruta)) {
    try {
      const leido = leerNbt(readFileSync(ruta))
      if (leido.raiz.t !== 10) return false
      nombre = leido.nombre
      raiz = leido.raiz.v
    } catch {
      return false
    }
  }
  const servidores = raiz.get('servers')
  const entradas = servidores && servidores.t === 9 && servidores.tipo === 10
    ? servidores.v.filter((e): e is { t: 10; v: Map<string, Etiqueta> } => e.t === 10).map((e) => e.v)
    : []
  const { lista, cambio } = repararLista(entradas)
  if (!cambio) return false
  raiz.set('servers', { t: 9, tipo: 10, v: lista.map((v) => ({ t: 10 as const, v })) })

  mkdirSync(instancia, { recursive: true })
  const parcial = `${ruta}.tmp`
  try {
    writeFileSync(parcial, escribirNbt(nombre, { t: 10, v: raiz }))
    renameSync(parcial, ruta)
    return true
  } catch {
    rmSync(parcial, { force: true })
    return false
  }
}
