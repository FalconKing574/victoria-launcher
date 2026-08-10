/**
 * Saca UN archivo de un .zip remoto sin descargarlo entero.
 *
 * Los shaderpacks del pack viajan dentro de `overrides-3.zip`, que pesa 177 MB.
 * Recuperar un shader de 1 MB no puede costar eso, así que se usa lo que un zip
 * permite por diseño: el índice está al final del archivo, y cada entrada dice
 * en qué byte empieza. Con tres peticiones `Range` se baja solo lo necesario.
 *
 * El troceo del formato va aparte de la red para poder probarlo sin salir a
 * internet.
 */
import { createHash } from 'crypto'
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'fs'
import { dirname } from 'path'
import { inflateRawSync } from 'zlib'

export interface ZipEntry {
  name: string
  /** 0 = guardado tal cual, 8 = deflate. Son los únicos que produce el empaquetador. */
  method: number
  compressedSize: number
  size: number
  crc32: number
  /** Byte donde empieza la cabecera local de esta entrada. */
  headerOffset: number
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50

export interface Eocd {
  cdOffset: number
  cdSize: number
  entries: number
  /** El zip usa los campos de 64 bits; hay que leer el registro Zip64. */
  needsZip64: boolean
}

/** Busca el fin del índice en la cola del archivo. */
export function parseEocd(tail: Buffer): Eocd | null {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== EOCD) continue

    const entries = tail.readUInt16LE(i + 10)
    const cdSize = tail.readUInt32LE(i + 12)
    const cdOffset = tail.readUInt32LE(i + 16)
    // 0xffffffff es el centinela que dice "el valor de verdad está en Zip64".
    const needsZip64 = cdOffset === 0xffffffff || cdSize === 0xffffffff || entries === 0xffff

    return { cdOffset, cdSize, entries, needsZip64 }
  }
  return null
}

/**
 * Convierte el índice central en entradas.
 *
 * Solo se queda con lo que hace falta para bajar un archivo suelto: dónde
 * empieza, cuánto ocupa comprimido y cómo verificarlo.
 */
export function parseCentralDirectory(cd: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = []
  let p = 0

  while (p + 46 <= cd.length && cd.readUInt32LE(p) === CENTRAL) {
    const method = cd.readUInt16LE(p + 10)
    const crc32 = cd.readUInt32LE(p + 16)
    let compressedSize = cd.readUInt32LE(p + 20)
    let size = cd.readUInt32LE(p + 24)
    const nameLen = cd.readUInt16LE(p + 28)
    const extraLen = cd.readUInt16LE(p + 30)
    const commentLen = cd.readUInt16LE(p + 32)
    let headerOffset = cd.readUInt32LE(p + 42)
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen)

    // Campo extra Zip64: sustituye los valores que vinieron como 0xffffffff, y
    // solo esos, en este orden.
    if (size === 0xffffffff || compressedSize === 0xffffffff || headerOffset === 0xffffffff) {
      let e = p + 46 + nameLen
      const end = e + extraLen
      while (e + 4 <= end) {
        const tag = cd.readUInt16LE(e)
        const len = cd.readUInt16LE(e + 2)
        if (tag === 0x0001) {
          let q = e + 4
          if (size === 0xffffffff) { size = Number(cd.readBigUInt64LE(q)); q += 8 }
          if (compressedSize === 0xffffffff) { compressedSize = Number(cd.readBigUInt64LE(q)); q += 8 }
          if (headerOffset === 0xffffffff) headerOffset = Number(cd.readBigUInt64LE(q))
          break
        }
        e += 4 + len
      }
    }

    entries.push({ name, method, compressedSize, size, crc32, headerOffset })
    p += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

/**
 * Cuánto ocupa la cabecera local, que va justo antes de los datos.
 *
 * Sus campos de nombre y extra pueden no medir lo mismo que en el índice
 * central, así que hay que leerla en vez de suponerlo.
 */
export function localHeaderLength(header: Buffer): number | null {
  if (header.length < 30 || header.readUInt32LE(0) !== 0x04034b50) return null
  return 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
}

async function range(url: string, start: number, end: number): Promise<Buffer> {
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
  if (!response.ok) throw new Error(`el servidor no admite descargas parciales (HTTP ${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

async function totalSize(url: string): Promise<number> {
  const response = await fetch(url, { method: 'HEAD' })
  const length = Number(response.headers.get('content-length') ?? 0)
  if (!response.ok || !length) throw new Error(`no se pudo consultar ${url} (HTTP ${response.status})`)
  return length
}

/** Lista lo que hay dentro de un zip remoto leyendo solo su índice. */
export async function listRemoteZip(url: string): Promise<ZipEntry[]> {
  const size = await totalSize(url)
  const tailLength = Math.min(size, 128 * 1024)
  const tail = await range(url, size - tailLength, size - 1)

  const eocd = parseEocd(tail)
  if (!eocd) throw new Error('no se encontró el índice del archivo comprimido')
  // Los overrides son de 177-260 MB con unos miles de entradas, muy lejos de
  // los límites que obligan a Zip64. Si algún día se pasan, mejor un error
  // claro aquí que leer campos con el valor centinela y bajar basura.
  if (eocd.needsZip64) throw new Error('el archivo usa Zip64 y esto no lo soporta')

  const cd = await range(url, eocd.cdOffset, eocd.cdOffset + eocd.cdSize - 1)
  return parseCentralDirectory(cd)
}

/**
 * Baja una sola entrada y la escribe en disco.
 *
 * Se escribe a un `.part` y se renombra al final, igual que las descargas
 * normales: un archivo a medias que parezca bueno es peor que no tenerlo.
 */
export async function extractRemoteEntry(
  url: string,
  entry: ZipEntry,
  target: string
): Promise<void> {
  const head = await range(url, entry.headerOffset, entry.headerOffset + 4095)
  const headerLength = localHeaderLength(head)
  if (headerLength === null) throw new Error(`cabecera ilegible para ${entry.name}`)

  const start = entry.headerOffset + headerLength
  const raw = await range(url, start, start + entry.compressedSize - 1)

  let data: Buffer
  if (entry.method === 0) data = raw
  else if (entry.method === 8) data = inflateRawSync(raw)
  else throw new Error(`compresión no soportada (${entry.method}) en ${entry.name}`)

  if (data.length !== entry.size) {
    throw new Error(`${entry.name} salió con ${data.length} bytes y debían ser ${entry.size}`)
  }

  mkdirSync(dirname(target), { recursive: true })
  const partial = `${target}.part`
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(partial)
      stream.on('error', reject)
      stream.on('finish', () => resolve())
      stream.end(data)
    })
    rmSync(target, { force: true })
    renameSync(partial, target)
  } catch (error) {
    rmSync(partial, { force: true })
    throw error
  }
}

/** Solo para diagnósticos: identifica un archivo ya descargado. */
export function sha1Of(buffer: Buffer): string {
  return createHash('sha1').update(buffer).digest('hex')
}
