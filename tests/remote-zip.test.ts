/**
 * Troceo del formato zip, sin red.
 *
 * Los archivos de prueba se construyen a mano con `zlib` para no depender de
 * ningún .zip guardado en el repo: si el troceo se rompe, el fallo tiene que
 * señalar al código, no a un fichero de datos.
 */
import { describe, it, expect } from 'vitest'
import { deflateRawSync, crc32 } from 'zlib'
import { parseEocd, parseCentralDirectory, localHeaderLength } from '../src/main/lib/remote-zip'

/** Arma un zip mínimo pero válido con las entradas dadas. */
function buildZip(archivos: Array<{ name: string; contenido: Buffer; comprimir: boolean }>): Buffer {
  const locales: Buffer[] = []
  const centrales: Buffer[] = []
  let offset = 0

  for (const a of archivos) {
    const datos = a.comprimir ? deflateRawSync(a.contenido) : a.contenido
    const nombre = Buffer.from(a.name, 'utf8')
    const crc = crc32(a.contenido)

    const local = Buffer.alloc(30 + nombre.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(a.comprimir ? 8 : 0, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(datos.length, 18)
    local.writeUInt32LE(a.contenido.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    nombre.copy(local, 30)

    const central = Buffer.alloc(46 + nombre.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(a.comprimir ? 8 : 0, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(datos.length, 20)
    central.writeUInt32LE(a.contenido.length, 24)
    central.writeUInt16LE(nombre.length, 28)
    central.writeUInt32LE(offset, 42)
    nombre.copy(central, 46)

    locales.push(local, datos)
    centrales.push(central)
    offset += local.length + datos.length
  }

  const cd = Buffer.concat(centrales)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(archivos.length, 8)
  eocd.writeUInt16LE(archivos.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)

  return Buffer.concat([...locales, cd, eocd])
}

const zip = buildZip([
  { name: 'shaderpacks/BSL_v8.4.zip', contenido: Buffer.from('contenido del shader'), comprimir: true },
  { name: 'config/algo.txt', contenido: Buffer.from('x'.repeat(300)), comprimir: true },
  { name: 'guardado.bin', contenido: Buffer.from('sin comprimir'), comprimir: false }
])

describe('parseEocd', () => {
  it('encuentra el índice al final del archivo', () => {
    const eocd = parseEocd(zip)
    expect(eocd).not.toBeNull()
    expect(eocd!.entries).toBe(3)
    expect(eocd!.needsZip64).toBe(false)
  })

  it('lo encuentra aunque solo se tenga la cola', () => {
    const cola = zip.subarray(zip.length - 200)
    expect(parseEocd(cola)).not.toBeNull()
  })

  it('devuelve null en algo que no es un zip', () => {
    expect(parseEocd(Buffer.from('esto no es un zip, ni de lejos'))).toBeNull()
  })

  it('marca Zip64 cuando el desplazamiento viene con el centinela', () => {
    const copia = Buffer.from(zip)
    const pos = copia.length - 22
    copia.writeUInt32LE(0xffffffff, pos + 16)
    expect(parseEocd(copia)!.needsZip64).toBe(true)
  })
})

describe('parseCentralDirectory', () => {
  const eocd = parseEocd(zip)!
  const entradas = parseCentralDirectory(zip.subarray(eocd.cdOffset, eocd.cdOffset + eocd.cdSize))

  it('lee todas las entradas con su nombre', () => {
    expect(entradas.map((e) => e.name)).toEqual([
      'shaderpacks/BSL_v8.4.zip',
      'config/algo.txt',
      'guardado.bin'
    ])
  })

  it('distingue lo comprimido de lo guardado tal cual', () => {
    expect(entradas[0].method).toBe(8)
    expect(entradas[2].method).toBe(0)
  })

  it('apunta al byte donde empieza cada entrada', () => {
    for (const e of entradas) {
      expect(zip.readUInt32LE(e.headerOffset)).toBe(0x04034b50)
    }
  })

  it('guarda el tamaño real y el comprimido por separado', () => {
    expect(entradas[0].size).toBe('contenido del shader'.length)
    expect(entradas[0].compressedSize).toBeGreaterThan(0)
  })
})

describe('localHeaderLength', () => {
  it('mide la cabecera para saber dónde empiezan los datos', () => {
    const eocd = parseEocd(zip)!
    const entradas = parseCentralDirectory(zip.subarray(eocd.cdOffset, eocd.cdOffset + eocd.cdSize))
    const primera = entradas[0]
    const largo = localHeaderLength(zip.subarray(primera.headerOffset))
    // 30 fijos + el nombre, que en esta entrada no lleva campo extra.
    expect(largo).toBe(30 + primera.name.length)
  })

  it('rechaza algo que no es una cabecera local', () => {
    expect(localHeaderLength(Buffer.alloc(60))).toBeNull()
  })
})
