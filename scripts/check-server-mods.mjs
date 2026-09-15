/**
 * Pregunta al servidor de Minecraft qué mods tiene, desde fuera.
 *
 * Un servidor Forge contesta al ping de la lista de servidores con un bloque
 * `forgeData` que incluye cada mod y su versión. Eso permite comprobar si el
 * servidor quedó al día sin tener acceso a sus archivos: se compara lo que
 * responde con lo que publica el manifiesto del modpack.
 *
 *   node scripts/check-server-mods.mjs
 *   node scripts/check-server-mods.mjs --host 1.2.3.4 --port 25565
 *
 * Solo lee. No toca nada del servidor.
 */
import { connect } from 'net'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, [])
)

// El host cambio el 29-08-2026. La IP vieja era 167.253.65.58:25590.
const HOST = args.host ?? '131.221.32.76'
const PORT = Number(args.port ?? 25567)
const MANIFEST = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'

// --- protocolo: enteros VarInt y cadenas con longitud delante ---------------
function varInt(value) {
  const out = []
  let v = value
  do {
    let byte = v & 0x7f
    v >>>= 7
    if (v !== 0) byte |= 0x80
    out.push(byte)
  } while (v !== 0)
  return Buffer.from(out)
}

function packet(id, ...parts) {
  const body = Buffer.concat([varInt(id), ...parts])
  return Buffer.concat([varInt(body.length), body])
}

function mcString(text) {
  const buf = Buffer.from(text, 'utf8')
  return Buffer.concat([varInt(buf.length), buf])
}

function readVarInt(buf, offset) {
  let result = 0
  let shift = 0
  let pos = offset
  for (;;) {
    if (pos >= buf.length) return null
    const byte = buf[pos]
    pos += 1
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
    if (shift > 35) return null
  }
  return { value: result, offset: pos }
}

function status(host, port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, timeout: 10000 })
    const chunks = []

    socket.on('connect', () => {
      const handshake = packet(
        0x00,
        varInt(763), // versión de protocolo de 1.20.1
        mcString(host),
        Buffer.from([port >> 8, port & 0xff]),
        varInt(1) // siguiente estado: status
      )
      socket.write(Buffer.concat([handshake, packet(0x00)]))
    })

    socket.on('data', (chunk) => {
      chunks.push(chunk)
      const buf = Buffer.concat(chunks)

      const len = readVarInt(buf, 0)
      if (!len) return
      if (buf.length < len.offset + len.value) return // aún faltan bytes

      const id = readVarInt(buf, len.offset)
      const str = readVarInt(buf, id.offset)
      if (buf.length < str.offset + str.value) return

      socket.destroy()
      try {
        resolve(JSON.parse(buf.toString('utf8', str.offset, str.offset + str.value)))
      } catch (error) {
        reject(error)
      }
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('el servidor no contestó en 10 s'))
    })
    socket.on('error', reject)
  })
}

console.log(`Preguntando a ${HOST}:${PORT} ...`)

let info
try {
  info = await status(HOST, PORT)
} catch (error) {
  console.error(`No contesta: ${error.message}`)
  console.error('Puede estar apagado, reiniciando, o el puerto no es ese.')
  process.exit(1)
}

const motd =
  typeof info.description === 'string'
    ? info.description
    : (info.description?.text ?? '') +
      (info.description?.extra ?? []).map((e) => e.text ?? '').join('')

console.log(`\nEn línea: ${info.version?.name ?? '?'}`)
console.log(`Jugadores: ${info.players?.online ?? '?'} / ${info.players?.max ?? '?'}`)
if (motd.trim()) console.log(`MOTD: ${motd.replace(/§./g, '').trim()}`)

const forge = info.forgeData ?? info.modinfo
const serverMods = forge?.mods ?? forge?.modList ?? []

if (!serverMods.length) {
  console.log('\nEl servidor no publica su lista de mods en el ping.')
  console.log('Pasa con algunos proxies y con servidores que la ocultan a propósito.')
  process.exit(0)
}

console.log(`\nEl servidor declara ${serverMods.length} mods.`)

// --- compara con lo que publica el modpack ---------------------------------
const manifest = await (await fetch(MANIFEST, { cache: 'no-store' })).json()
console.log(`Modpack publicado: packVersion ${manifest.packVersion}`)

/** De `hardcorerevival-forge-1.20.1-12.0.15.jar` saca `12.0.15`. */
function versionOf(filename) {
  const match = /-(\d[\d.]*[a-z]?)(?:-[a-z]+)?\.jar$/i.exec(filename)
  return match ? match[1] : null
}

const VIGILADOS = [
  'hardcorerevival',
  'legendarysurvivaloverhaul',
  'legendarytabs',
  'starcatcher',
  'tacz_optimization',
  'jei',
  'balm',
  'fusion',
  'supermartijn642corelib',
  'immersive_melodies',
  'fancymenu'
]

const byId = new Map(serverMods.map((m) => [(m.modId ?? m.modid ?? '').toLowerCase(), m]))

console.log('\nmod                        servidor        modpack')
console.log('-'.repeat(60))
let desfasados = 0
for (const id of VIGILADOS) {
  const enServidor = byId.get(id)
  const entry = manifest.mods.find((m) => m.filename.toLowerCase().startsWith(id.slice(0, 8)))
  const esperada = entry ? versionOf(entry.filename) : null
  const tiene = enServidor?.modmarker ?? enServidor?.version ?? null

  if (!enServidor) {
    console.log(`${id.padEnd(26)} ${'(no está)'.padEnd(15)} ${esperada ?? '?'}`)
    continue
  }
  const igual = tiene && esperada && tiene.includes(esperada)
  if (!igual) desfasados += 1
  console.log(`${id.padEnd(26)} ${String(tiene).padEnd(15)} ${esperada ?? '?'} ${igual ? '' : '  <-- revisar'}`)
}

console.log('-'.repeat(60))
console.log(desfasados === 0 ? 'Todo cuadra.' : `${desfasados} por revisar.`)
