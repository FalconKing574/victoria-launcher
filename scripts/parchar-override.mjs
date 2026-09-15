/**
 * Replace one file inside the published overrides without rebuilding them.
 *
 * ## Why this exists
 *
 * The pack's configs live inside the overrides, so fixing a single line of a
 * single `.toml` used to mean running `build-manifest.mjs`, which repacks all
 * three archives from scratch. A zip is not byte-reproducible, so all three
 * hashes change, and the launcher — which compares per part — makes every player
 * download 685 MB for a 3 KB edit.
 *
 * That is not a theoretical cost. `eyemod-common.toml` shipped with a stray
 * comma inside an array; Forge could not parse it, the exception surfaced during
 * a resource reload, and Minecraft answered the way it always does:
 *
 *     Caught error loading resourcepacks, removing all selected resourcepacks
 *
 * Every pack off, for every player. Without the Victoria pack the glyph sheets
 * it adds to `minecraft:default` are gone and the entire interface — the game's
 * own screens included — draws as the "no glyph" box. A one-character fix that
 * had to reach everyone, fast.
 *
 * This script rewrites only the archive that actually contains the file. The
 * other parts keep their bytes and therefore their sha1, and the launcher skips
 * them: 173 MB instead of 685 MB, and a much shorter upload from here.
 *
 * ## Safety
 *
 * The live manifest is the source of truth for what players have. The script
 * refuses to run if `dist-modpack/` does not match it hash for hash, because
 * patching a stale local archive would publish an override built from files
 * nobody has ever seen.
 *
 * ## Use
 *
 *     node scripts/parchar-override.mjs \
 *       --archivo config/eyemod-common.toml \
 *       --desde "C:/.../Victoria Bien Hecho/config/eyemod-common.toml" \
 *       --version 1.47.0
 *
 * Add `--publish` to upload. Without it nothing leaves the machine: it patches
 * `dist-modpack/` and prints what it would send, so the diff can be checked
 * first.
 *
 * Repeat `--archivo`/`--desde` in pairs to patch several files at once — but
 * every file has to already exist inside the overrides. Adding or removing a
 * file changes the bin-packing, and that is `build-manifest.mjs`'s job.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AdmZip from 'adm-zip'

const OUT = 'dist-modpack'
const BUCKET = 'victoria-modpack'
const MANIFEST_URL =
  'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'

// --- argumentos --------------------------------------------------------------
//
// Pares repetibles, así que no sirve `Object.fromEntries`: se recorre a mano.
const argv = process.argv.slice(2)
const parches = []
let version = null
let publicar = false

for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]
  if (a === '--publish') publicar = true
  else if (a === '--version') version = argv[++i]
  else if (a === '--archivo') parches.push({ dentro: argv[++i], desde: null })
  else if (a === '--desde') {
    const ultimo = parches[parches.length - 1]
    if (!ultimo || ultimo.desde) {
      console.error('--desde tiene que venir después de su --archivo.')
      process.exit(2)
    }
    ultimo.desde = argv[++i]
  } else {
    console.error(`Argumento que no entiendo: ${a}`)
    process.exit(2)
  }
}

if (!parches.length || parches.some((p) => !p.desde) || !version) {
  console.error(
    'Faltan argumentos.\n\n' +
      '  node scripts/parchar-override.mjs --archivo <ruta dentro del zip> ' +
      '--desde <archivo local> --version <nueva>\n'
  )
  process.exit(2)
}

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

// --- 1. qué tienen hoy los jugadores ----------------------------------------
console.log('Leyendo el manifiesto vivo...')
const respuesta = await fetch(MANIFEST_URL, { cache: 'no-store' })
if (!respuesta.ok) {
  console.error(`No se pudo leer el manifiesto: HTTP ${respuesta.status}`)
  process.exit(1)
}
const manifiesto = await respuesta.json()
console.log(`  packVersion vivo: ${manifiesto.packVersion}`)

// Con la misma o menor, los launchers creen que están al día y no bajan nada.
const num = (v) => v.split('.').map(Number)
const [a1, a2, a3] = num(manifiesto.packVersion)
const [b1, b2, b3] = num(version)
if (b1 * 1e6 + b2 * 1e3 + b3 <= a1 * 1e6 + a2 * 1e3 + a3) {
  console.error(
    `\n${version} no es mayor que ${manifiesto.packVersion}. Con una versión ` +
      'que no sube, el launcher no baja nada y el arreglo no llega a nadie.'
  )
  process.exit(1)
}

// --- 2. que lo local sea de verdad lo publicado ------------------------------
//
// Sin esto se podría parchar un zip viejo y publicar configs que nadie vio.
for (const parte of manifiesto.overrides) {
  const p = join(OUT, parte.name)
  if (!existsSync(p)) {
    console.error(
      `\nFalta ${p}.\n\nEste script parcha lo que ya está publicado, así que ` +
        'necesita los zips exactos. Si no están, hay que rehacerlos con ' +
        'build-manifest.mjs (y entonces ya cambian los tres hashes igual).'
    )
    process.exit(1)
  }
  const mio = sha1(readFileSync(p))
  if (mio !== parte.sha1) {
    console.error(
      `\n${parte.name} no coincide con lo publicado.\n` +
        `  acá:       ${mio}\n  publicado: ${parte.sha1}\n\n` +
        'dist-modpack/ quedó viejo. Parcharlo publicaría un override armado ' +
        'con archivos que nadie tiene.'
    )
    process.exit(1)
  }
}
console.log('  los tres overrides locales coinciden con lo publicado')

// --- 3. quién contiene cada archivo -----------------------------------------
const zips = new Map()
const tocados = new Set()

for (const { dentro, desde } of parches) {
  if (!existsSync(desde)) {
    console.error(`\nNo existe el archivo local: ${desde}`)
    process.exit(1)
  }

  let parte = null
  for (const p of manifiesto.overrides) {
    if (!zips.has(p.name)) zips.set(p.name, new AdmZip(join(OUT, p.name)))
    if (zips.get(p.name).getEntry(dentro)) {
      parte = p.name
      break
    }
  }

  if (!parte) {
    console.error(
      `\n${dentro} no está en ninguno de los overrides.\n\n` +
        'Agregar un archivo cambia el reparto por tamaño entre las partes, y ' +
        'eso es trabajo de build-manifest.mjs. Este script sólo reemplaza.'
    )
    process.exit(1)
  }

  const nuevo = readFileSync(desde)
  const viejo = zips.get(parte).readFile(dentro)
  if (viejo && Buffer.compare(viejo, nuevo) === 0) {
    console.log(`  ${dentro}: idéntico, no hace falta tocarlo`)
    continue
  }

  const zip = zips.get(parte)
  zip.deleteFile(dentro)
  // `addFile` con la ruta entera, no `addLocalFile`: éste último la deduce del
  // nombre del archivo en disco y lo dejaría en la raíz del zip.
  zip.addFile(dentro, nuevo)
  tocados.add(parte)
  console.log(
    `  ${dentro}: ${viejo ? viejo.length : 0} -> ${nuevo.length} bytes, en ${parte}`
  )
}

if (!tocados.size) {
  console.log('\nNo cambió nada. No hay nada que publicar.')
  process.exit(0)
}

// --- 4. reescribir sólo las partes tocadas, y comprobar que no se perdió nada -
const overrides = manifiesto.overrides.map((p) => ({ ...p }))
for (const nombre of tocados) {
  const ruta = join(OUT, nombre)

  // La lista de antes, para compararla con la de después. `writeZip` rearma el
  // archivo entero desde la estructura en memoria: son 3.779 entradas pasando
  // por una biblioteca, y publicar un override al que le falta un archivo es
  // peor que el bug que se está arreglando. Cuesta milisegundos comprobarlo.
  const antes = new Map(
    zips.get(nombre).getEntries().map((e) => [e.entryName, e.header.size])
  )

  zips.get(nombre).writeZip(ruta)

  const despues = new Map(
    new AdmZip(ruta).getEntries().map((e) => [e.entryName, e.header.size])
  )
  const faltan = [...antes.keys()].filter((k) => !despues.has(k))
  const sobran = [...despues.keys()].filter((k) => !antes.has(k))
  if (faltan.length || sobran.length) {
    console.error(
      `\n${nombre} salió mal al reescribirse: ` +
        `${faltan.length} entradas perdidas, ${sobran.length} de más.\n` +
        [...faltan.slice(0, 5), ...sobran.slice(0, 5)].map((x) => `    ${x}`).join('\n') +
        '\n\nNO se publica. Restaurá el zip y rehacelo con build-manifest.mjs.'
    )
    process.exit(1)
  }

  const parte = overrides.find((p) => p.name === nombre)
  parte.sha1 = sha1(readFileSync(ruta))
  parte.sizeBytes = statSync(ruta).size
  console.log(
    `\n${nombre} reescrito: ${(parte.sizeBytes / 1048576).toFixed(0)} MB, ` +
      `${despues.size} entradas intactas, sha1 ${parte.sha1}`
  )
}

const intactos = overrides.filter((p) => !tocados.has(p.name))
const mb = (n) => (n / 1048576).toFixed(0)
console.log(
  `\nEl jugador baja ${mb(
    overrides.filter((p) => tocados.has(p.name)).reduce((s, p) => s + p.sizeBytes, 0)
  )} MB. Se saltea ${mb(
    intactos.reduce((s, p) => s + p.sizeBytes, 0)
  )} MB porque esas partes no cambiaron de hash.`
)

// --- 5. el manifiesto --------------------------------------------------------
//
// Se parte del vivo y se cambia lo mínimo: así no se pierde nada que se haya
// editado en R2 a mano (la llave de `auth`, por ejemplo).
manifiesto.packVersion = version
manifiesto.overrides = overrides
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifiesto, null, 2), 'utf8')
console.log(`manifest.json escrito con packVersion ${version}`)

if (!publicar) {
  console.log('\nEnsayo. No se subió nada. Repetí con --publish.')
  process.exit(0)
}

// --- 6. subir: primero los zips, el manifiesto último ------------------------
//
// El manifiesto es lo único que el launcher lee para decidir, así que es el
// interruptor. Va al final para que la publicación sea atómica desde su punto
// de vista: o está viva la versión vieja y completa, o la nueva. Nunca la mitad
// de cada una.
/**
 * `shell: true` no es opcional en Windows: `npx` es un `.cmd` y desde Node 20
 * `execFileSync` se niega a lanzarlo sin shell — tira `ENOENT` con stdout y
 * stderr vacíos, que es indistinguible de «no hay sesión». Costó una corrida:
 * el parche se armó bien y la publicación abortó diciendo que faltaba login.
 *
 * Y con shell, cmd vuelve a partir los argumentos por los espacios, así que hay
 * que citarlos: `Immersive Vehicles-1.20.1.jar` llegó una vez a wrangler como
 * dos argumentos. Es la misma pareja de `publish-modpack-r2.mjs`.
 */
function citar(arg) {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args.map(citar)], {
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe'
  })
}

/**
 * ¿Hay sesión de wrangler?
 *
 * 🔴 El código de salida de `wrangler whoami` no sirve para decidir esto, y se
 * equivoca **en los dos sentidos**: devuelve éxito sin sesión, y acá devolvió
 * 255 CON sesión y la tabla de la cuenta impresa. La primera versión de esta
 * comprobación miraba el código y abortaba una publicación que estaba
 * perfectamente autorizada.
 *
 * Lo único confiable es el texto, así que se lee la salida --venga por donde
 * venga-- y se busca la frase.
 */
function haySesion() {
  let salida
  try {
    salida = wrangler(['whoami'])
  } catch (error) {
    salida = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
  return salida.length > 0 && !/not authenticated/i.test(salida)
}

if (!haySesion()) {
  console.error(
    '\nNo hay sesión de wrangler. Pedísela al usuario: `npx wrangler login`.'
  )
  process.exit(1)
}

const subidas = [...tocados].map((n) => [n, n])
subidas.push(['manifest.json', 'manifest.json'])

for (const [local, clave] of subidas) {
  process.stdout.write(`  subiendo ${clave}... `)
  try {
    wrangler(['r2', 'object', 'put', `${BUCKET}/${clave}`, '--file', join(OUT, local), '--remote'])
  } catch (error) {
    console.error(`\nFalló: ${error.stdout ?? ''}${error.stderr ?? error.message}`)
    process.exit(1)
  }
  console.log('ok')
}

console.log(`\nPublicado. packVersion ${version}.`)
