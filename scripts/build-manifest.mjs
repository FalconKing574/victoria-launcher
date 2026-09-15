/**
 * Builds the modpack manifest from the CurseForge instance.
 *
 * Every jar in mods/ becomes a required entry with its sha1, so the launcher
 * can tell "same file" from "same name". The optional mods are declared here by
 * hand because they are not installed locally — players opt into them.
 *
 * Publishing an update:
 *   1. node scripts/build-manifest.mjs
 *   2. Create a GitHub Release and upload dist-modpack/manifest.json plus every
 *      jar in dist-modpack/mods/
 *   3. Nothing else. Players pick it up on next launch.
 *
 * Usage:
 *   node scripts/build-manifest.mjs --repo usuario/repo --version 1.1.0
 */
import { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, [])
)

const INSTANCE =
  args.instance ?? 'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho'
const REPO = args.repo ?? 'TU_USUARIO/TU_REPO'
const VERSION = args.version ?? '1.0.0'
const OUT = 'dist-modpack'

const RELEASE_BASE = `https://github.com/${REPO}/releases/download/v${VERSION}`

/**
 * La raiz del repo del servidor, de donde salen las piezas que no vive aca.
 *
 * Hoy: el zip del mapa de la ciudad (`_deploy/mapa-ciudad.zip`) y los datos del
 * servidor de autenticacion (`_deploy/auth.json`). Los dos los produce
 * VictoriaRP y los consume el modpack, asi que el camino tiene que existir en
 * alguna parte; ponerlo aca es mas honesto que copiar los archivos a mano.
 */
const RAIZ_RP = args['rp'] ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '.', 'Desktop', 'VictoriaRP')

/**
 * El servidor de autenticacion, si se sabe cual es.
 *
 * ## Se arrastra en vez de perderse
 *
 * Sale de `_deploy/auth.json` si esta, y si no, del manifiesto QUE YA ESTA
 * PUBLICADO. Lo segundo no es un adorno: sin eso, publicar una version por
 * cualquier otro motivo BORRARIA el bloque `auth` del manifiesto y todos los
 * launchers dejarian de pedir el vale en silencio --el codigo hace
 * `if (!manifest.auth) return`--. Un dato que se pierde al publicar es un dato
 * que se va a perder.
 *
 * El `llave` es la base64 de `plugins/VictoriaAuth/llave.pub` del servidor.
 */
let auth
const AUTH_LOCAL = join(RAIZ_RP, '_deploy', 'auth.json')
if (existsSync(AUTH_LOCAL)) {
  auth = JSON.parse(readFileSync(AUTH_LOCAL, 'utf8'))
  console.log(`  auth: ${auth.host}:${auth.puerto} (de _deploy/auth.json)`)
} else {
  try {
    const vivo = await fetch('https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json', { cache: 'no-store' }).then((r) => r.json())
    if (vivo.auth) {
      auth = vivo.auth
      console.log(`  auth: ${auth.host}:${auth.puerto} (arrastrado del manifiesto vivo)`)
    }
  } catch {
    // Sin red se publica sin auth. Se avisa abajo.
  }
}
if (!auth) {
  console.log('  Sin auth: el launcher no va a pedir el vale y el jugador entra con /login.')
}

/**
 * Required mods that are not installed in the instance yet.
 *
 * The whole performance stack (Embeddium, ModernFix, FerriteCore, EntityCulling,
 * ImmediatelyFast, MemoryLeakFix, Clumps, SmoothBoot) is already in the instance
 * and therefore already required — nobody has to opt into a smoother game.
 */
const EXTRA_REQUIRED = []

/**
 * Mods present in the instance that the pack should NOT ship.
 *
 * Matched as a substring of the filename so version bumps do not silently
 * un-exclude something. Removing an entry here and republishing puts the mod
 * back; the launcher deletes it from players on the next sync because it is
 * one of the files the launcher installed.
 *
 * `voicechat-forge` apareció en la instancia y nunca se había publicado. Un mod
 * nuevo no entra por una actualización de versiones: Simple Voice Chat además
 * necesita estar también en el servidor y un puerto UDP abierto, o los
 * jugadores lo ven instalado y no les funciona. Quita esta entrada el día que
 * el servidor lo tenga.
 *
 * `NEOFORGE` es una red de seguridad. Este pack corre **Forge 47.4.0**, y varios
 * mods (EnhancedVisuals, CreativeCore...) publican dos archivos casi idénticos,
 * `..._FORGE_...` y `..._NEOFORGE_...`. El de NeoForge declara dentro
 * `modId="neoforge"`, que Forge no proporciona: lo trata como dependencia
 * obligatoria ausente y **aborta el arranque**. Ya se coló uno
 * (EnhancedVisuals_NEOFORGE_v1.8.30) al actualizar desde CurseForge. Si algún
 * día el pack migra a NeoForge, quita esta entrada.
 */
const EXCLUDED = ['Essential_', 'voicechat-forge', 'NEOFORGE']

/**
 * Mods the player chooses. Deliberately a short list: the launcher must not let
 * anyone toggle the pack's required mods, because disabling one desyncs them
 * from the server and produces a connection failure nobody can diagnose.
 *
 * Every entry's jar must exist in the instance's mods folder, or the manifest
 * lists it with an empty hash and the launcher cannot install it.
 *
 * NO pongas `image` con una URL de media.forgecdn.net. Las tres que había aquí
 * devolvían 404 (NoSuchKey), así que en la pestaña Mods todos los mods salían
 * como una letra gigante. El icono de estos tres va empaquetado en el launcher
 * (`src/renderer/src/assets/mods/<id>.png`), que no se puede caer.
 *
 * Si añades un mod opcional nuevo: mete su icono ahí y regístralo en
 * LOCAL_ICONS de `src/renderer/src/screens/Modpack.tsx`. `image` sigue
 * existiendo como reserva, pero comprueba que la URL responde 200 antes de
 * publicarla.
 */
// El mapa de Xaero salió de esta lista el 25-08-2026, y con él entró su
// minimapa como mod requerido.
//
// El motivo no es de gusto: el servidor va a mandar waypoints —el punto de
// encuentro de un viaje en taxi, el lugar de un aviso al 911— y el que los
// crea es el MINIMAPA. `xaeroworldmap` solo los muestra: su
// `xaero/map/mods/gui/WaypointReader` es un puente para leer los del minimapa,
// no un almacén propio.
//
// Un sistema del que la mitad de los jugadores no recibe la ubicación no es un
// sistema: es una función que a veces anda. Por eso los dos son requeridos, y
// por eso este cambio también toca `DEFAULT_OPTIONAL` en `src/main/ipc/sync.ts`
// —que es código y hay que publicar el launcher— y `LOCAL_ICONS` en
// `Modpack.tsx`.
const OPTIONAL = [
  {
    id: 'distant-horizons',
    name: 'Distant Horizons',
    summary:
      'Renderiza el terreno lejano en baja resolución, así que ves muchísimo más lejos sin hundir los FPS. Viene activado.',
    category: 'visual',
    filename: 'DistantHorizons-3.2.0-b-1.20.1-fabric-forge.jar'
  },
  {
    id: 'forgematica',
    name: 'Forgematica',
    summary:
      'Carga esquemas y te los proyecta como un plano fantasma para construirlos bloque a bloque. Util para construir, innecesario si solo juegas.',
    category: 'calidad-de-vida',
    filename: 'Forgematica-0.1.13-mc1.20.1.jar'
  }
]

const modsDir = join(INSTANCE, 'mods')
if (!existsSync(modsDir)) {
  console.error(`No encuentro la carpeta de mods: ${modsDir}`)
  process.exit(1)
}

mkdirSync(join(OUT, 'mods'), { recursive: true })

// A mod that is opt-in must not also be required, or everyone gets it anyway.
const OPTIONAL_FILENAMES = new Set(OPTIONAL.map((m) => m.filename))

const jars = readdirSync(modsDir)
  .filter((f) => f.toLowerCase().endsWith('.jar'))
  .filter((f) => !OPTIONAL_FILENAMES.has(f))
  .filter((f) => {
    const excluded = EXCLUDED.find((pattern) => f.includes(pattern))
    if (excluded) console.log(`Excluido del pack: ${f}`)
    return !excluded
  })
const mods = []

for (const filename of jars) {
  const path = join(modsDir, filename)
  const buffer = readFileSync(path)
  mods.push({
    filename,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(path).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(filename)}`
  })
  cpSync(path, join(OUT, 'mods', filename))
}

// Required mods that live only in dist-modpack/mods, not in the instance.
for (const extra of EXTRA_REQUIRED) {
  const staged = join(OUT, 'mods', extra.filename)
  if (!existsSync(staged)) {
    console.warn(
      `AVISO: falta ${extra.filename} en ${OUT}/mods. ` +
        'Descárgalo y ponlo ahí, o los jugadores no lo recibirán.'
    )
    continue
  }
  if (mods.some((m) => m.filename === extra.filename)) continue
  const buffer = readFileSync(staged)
  mods.push({
    filename: extra.filename,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(staged).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(extra.filename)}`
  })
}

// Optional mods that are already in the instance get staged from there.
for (const mod of OPTIONAL) {
  const inInstance = join(modsDir, mod.filename)
  const staged = join(OUT, 'mods', mod.filename)
  if (existsSync(inInstance) && !existsSync(staged)) cpSync(inInstance, staged)
}

const optional = OPTIONAL.map((mod) => {
  const staged = join(OUT, 'mods', mod.filename)
  if (!existsSync(staged)) {
    console.warn(
      `AVISO: ${mod.filename} no está en ${OUT}/mods. ` +
        'Descárgalo y ponlo ahí antes de publicar, o los jugadores no podrán activarlo.'
    )
    return { ...mod, sha1: '', sizeBytes: 0, url: `${RELEASE_BASE}/${mod.filename}` }
  }
  const buffer = readFileSync(staged)
  return {
    ...mod,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(staged).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(mod.filename)}`
  }
})

/**
 * `--tambien-requeridos id,id` publishes those optional mods in BOTH lists.
 *
 * Moving a mod from required to optional is not free: `planSync` deletes any
 * managed jar that is no longer wanted, and a player whose `enabledOptional`
 * predates the id loses the mod on their next update without having asked for
 * anything. That is fine when it is the point of the release, and unacceptable
 * when it rides along with an unrelated one.
 *
 * So a publish that is only meant to ship something else can pin the affected
 * mods as required for that round and move them later, deliberately.
 *
 * Used on pack 1.3.0, whose only real change was the phone: `distant-horizons`
 * and `xaeros-world-map` had become optional in this script since pack 1.2.0
 * was built, and shipping that quietly would have turned off two mods for
 * everyone who installed before those ids existed.
 */
const TAMBIEN_REQUERIDOS = (args['tambien-requeridos'] ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

for (const id of TAMBIEN_REQUERIDOS) {
  const mod = optional.find((m) => m.id === id)
  if (!mod) {
    console.warn(`AVISO: --tambien-requeridos ${id} no es un opcional conocido.`)
    continue
  }
  if (!mod.sha1) {
    console.warn(`AVISO: ${id} no tiene hash, no se publica como requerido.`)
    continue
  }
  if (mods.some((m) => m.filename === mod.filename)) continue
  mods.push({
    filename: mod.filename,
    sha1: mod.sha1,
    sizeBytes: mod.sizeBytes,
    url: mod.url
  })
  console.log(`  ${id} publicado tambien como requerido.`)
}

// config/, resourcepacks/ and shaderpacks/ as one archive. options.txt is
// deliberately excluded: it holds the player's keybinds and video settings, and
// overwriting it on every update would wipe their setup.
const OVERRIDE_DIRS = ['config', 'resourcepacks', 'shaderpacks', 'resources', 'tacz']

/**
 * Paths inside the override folders that are NOT shipped.
 *
 * resources/videos is 726 MB of tutorial videos that are byte-identical
 * duplicates of the ones in config/fancymenu/assets/videos -- two even under a
 * different name -- and nothing in the menu configuration references that path.
 * The menu reads its videos from config/ and only pulls images and sounds out
 * of resources/, so shipping the folder would double half a gigabyte for
 * nothing. Verified by grepping the FancyMenu customization files.
 */
const OVERRIDE_EXCLUDE = [
  'resources/videos',
  // Owned by the launcher's Shaders tab, not by the pack. Shipping it would
  // reset the player's shader choice -- and switch shaders back on -- every
  // time the overrides change.
  'config/oculus.properties'
]

/**
 * Wrangler refuses uploads over 300 MiB and this pack's config folder is
 * 614 MiB, most of it menu videos, so the overrides ship as several archives
 * instead of one. Files are bin-packed by size; each archive stays under the
 * cap and the launcher extracts them in order.
 */
const PART_LIMIT_BYTES = 260 * 1024 * 1024

function walk(dir, base, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    const rel = `${base}/${entry.name}`
    if (entry.isDirectory()) walk(full, rel, out)
    else out.push({ full, rel, size: statSync(full).size })
  }
  return out
}

let overrides
if (args['skip-overrides'] === undefined) {
  console.log('Empaquetando configuración... (puede tardar, son cientos de MB)')

  const files = []
  for (const folder of OVERRIDE_DIRS) {
    const source = join(INSTANCE, folder)
    if (existsSync(source)) files.push(...walk(source, folder))
    else console.warn(`AVISO: no existe ${folder}/ en la instancia, se omite.`)
  }

  const before = files.length
  const kept = files.filter(
    // Matches a whole folder or one exact file, so single configs can be
    // excluded as well as directories.
    (f) => !OVERRIDE_EXCLUDE.some((entry) => f.rel === entry || f.rel.startsWith(`${entry}/`))
  )
  if (kept.length !== before) {
    const saved = files
      .filter((f) => !kept.includes(f))
      .reduce((sum, f) => sum + f.size, 0)
    console.log(`  Excluidos ${before - kept.length} archivos (${(saved / 1048576).toFixed(0)} MB): ${OVERRIDE_EXCLUDE.join(', ')}`)
  }
  files.length = 0
  files.push(...kept)

  // Largest first so big files claim their own part instead of stranding
  // small ones in a part that then overflows.
  files.sort((a, b) => b.size - a.size)

  const groups = []
  for (const file of files) {
    let target = groups.find((g) => g.size + file.size <= PART_LIMIT_BYTES)
    if (!target) {
      target = { size: 0, files: [] }
      groups.push(target)
    }
    target.files.push(file)
    target.size += file.size
  }

  overrides = []
  groups.forEach((group, i) => {
    const name = `overrides-${i + 1}.zip`
    const path = join(OUT, name)
    const zip = new AdmZip()
    for (const file of group.files) {
      const dirInZip = file.rel.split('/').slice(0, -1).join('/')
      zip.addLocalFile(file.full, dirInZip)
    }
    zip.writeZip(path)
    const buffer = readFileSync(path)
    const bytes = statSync(path).size
    overrides.push({
      name,
      sha1: createHash('sha1').update(buffer).digest('hex'),
      sizeBytes: bytes,
      url: `${RELEASE_BASE}/${name}`
    })
    console.log(`  ${name}: ${(bytes / 1048576).toFixed(0)} MB (${group.files.length} archivos)`)
  })
} else {
  console.log('Saltando overrides (--skip-overrides).')
}

/**
 * La siembra: lo que se instala una sola vez y despues es del jugador.
 *
 * Hoy es el mapa de la ciudad ya explorado, que lo arma
 * `VictoriaRP/tools/armar_mapa_ciudad.py`. NO puede viajar en los overrides
 * --se extraen pisando, y esa carpeta la reescribe el jugador con cada cuadra
 * que camina-- asi que va aparte y el launcher solo la instala si la carpeta no
 * existe. Ver `ManifestSeed` en `src/main/lib/sync-plan.ts`.
 *
 * Si el zip no esta, no se publica siembra y no pasa nada: el mapa arranca
 * negro, que es como venia.
 */
const SIEMBRA_MAPA = join(
  RAIZ_RP, '_deploy', 'mapa-ciudad.zip'
)
let siembra
if (existsSync(SIEMBRA_MAPA)) {
  const destino = leerDestinoDeLaSiembra(SIEMBRA_MAPA)
  if (destino) {
    const buffer = readFileSync(SIEMBRA_MAPA)
    const bytes = statSync(SIEMBRA_MAPA).size
    cpSync(SIEMBRA_MAPA, join(OUT, 'mapa-ciudad.zip'))
    siembra = [
      {
        nombre: 'el mapa de la ciudad',
        destino,
        sha1: createHash('sha1').update(buffer).digest('hex'),
        sizeBytes: bytes,
        url: `${RELEASE_BASE}/mapa-ciudad.zip`
      }
    ]
    console.log(`  mapa-ciudad.zip: ${(bytes / 1048576).toFixed(1)} MB -> ${destino}`)
  } else {
    console.log('  mapa-ciudad.zip no tiene la forma esperada: no se publica.')
  }
} else {
  console.log('  Sin mapa-ciudad.zip: el mapa va a arrancar negro para el que instala.')
}

/**
 * De donde sale el `destino` de la siembra del mapa.
 *
 * Se LEE DEL ZIP en vez de escribirse a mano porque el nombre del mundo lo
 * inventa Xaero --`Multiplayer_<lo que el jugador escribio en la lista de
 * servidores>`-- y escribirlo aca seria apostar a que coincida. La primera
 * carpeta del zip es la que hay que comprobar: si esa existe, el jugador ya
 * tiene mapa.
 */
function leerDestinoDeLaSiembra(zipPath) {
  const zip = new AdmZip(zipPath)
  for (const entrada of zip.getEntries()) {
    const partes = entrada.entryName.split('/').filter(Boolean)
    // xaero/world-map/<mundo>/... -- se comprueba hasta el mundo.
    if (partes.length >= 3 && partes[0] === 'xaero') {
      return `${partes[0]}/${partes[1]}/${partes[2]}`
    }
  }
  return null
}

const manifest = {
  packVersion: VERSION,
  minecraft: '1.20.1',
  forge: '47.4.0',
  mods,
  optional,
  ...(overrides ? { overrides } : {}),
  ...(siembra ? { siembra } : {}),
  ...(auth ? { auth } : {})
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

const totalMb = (mods.reduce((sum, m) => sum + m.sizeBytes, 0) / 1048576).toFixed(0)

console.log(`
Manifiesto generado: ${OUT}/manifest.json

  Versión del pack : ${VERSION}
  Mods requeridos  : ${mods.length} (${totalMb} MB)
  Mods opcionales  : ${optional.length}
  Repositorio      : ${REPO}

Siguiente paso — crea una release en GitHub con la etiqueta v${VERSION} y sube:
  - ${OUT}/manifest.json
  - todos los .jar de ${OUT}/mods/
  - ${OUT}/overrides.zip (configs, resourcepacks y shaders)

Luego apunta el launcher a:
  https://github.com/${REPO}/releases/latest/download/manifest.json
`)
