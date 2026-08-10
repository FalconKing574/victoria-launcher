/**
 * Actualiza SOLO los .jar del modpack, sin volver a empaquetar los overrides.
 *
 * `build-manifest.mjs` regenera `dist-modpack/` entera, incluidos los tres
 * overrides-*.zip. Un zip no se genera byte a byte igual dos veces, así que sus
 * sha1 cambian aunque el contenido sea idéntico — y el launcher, que compara
 * por hash, le haría bajar 697 MB a cada jugador por una actualización que solo
 * toca mods.
 *
 * Esto parte del manifiesto VIVO, sustituye las entradas de los mods cuya
 * versión cambió en la instancia, y deja los overrides exactamente como están.
 *
 *   node scripts/update-mods-only.mjs --version 1.6.0            (genera y enseña)
 *   node scripts/update-mods-only.mjs --version 1.6.0 --publish  (sube a R2)
 *
 * Un mod NUEVO o RETIRADO no se cuela por aquí: si el recuento no cuadra, para.
 * Para eso está `build-manifest.mjs`.
 */
import { createHash } from 'crypto'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true])
    return pairs
  }, [])
)

const INSTANCE =
  args.instance ?? 'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho'
const OUT = 'dist-modpack'
const BASE = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev'
const BUCKET = 'victoria-modpack'

/** Igual que en build-manifest.mjs. Manténlos sincronizados. */
const EXCLUDED = ['Essential_', 'voicechat-forge', 'NEOFORGE']

const VERSION = typeof args.version === 'string' ? args.version : null
if (!VERSION) {
  console.error('Falta --version. Tiene que ser MAYOR que la publicada.')
  process.exit(1)
}

/** Nombre del mod sin su versión, para emparejar viejo con nuevo. */
function modKey(filename) {
  return filename
    .replace(/\.jar$/i, '')
    .toLowerCase()
    // corta en el primer trozo que empieza por un dígito: ahí empieza la versión
    .split(/[-_](?=\d)/)[0]
    .replace(/[^a-z0-9]/g, '')
}

function sha1(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

const live = await (await fetch(`${BASE}/manifest.json`, { cache: 'no-store' })).json()
console.log(`Manifiesto vivo: packVersion ${live.packVersion}, ${live.mods.length} requeridos`)

if (VERSION === live.packVersion) {
  console.error(`--version ${VERSION} es la que ya está publicada. Los launchers no bajarían nada.`)
  process.exit(1)
}

const modsDir = join(INSTANCE, 'mods')
const local = readdirSync(modsDir)
  .filter((f) => f.toLowerCase().endsWith('.jar'))
  .filter((f) => !EXCLUDED.some((x) => f.includes(x)))

const published = [...live.mods, ...live.optional].map((m) => m.filename)
const localSet = new Set(local)
const publishedSet = new Set(published)

const added = local.filter((f) => !publishedSet.has(f))
const dropped = published.filter((f) => !localSet.has(f))

// Empareja por nombre-sin-versión. Lo que no empareja es un mod nuevo o retirado.
const byKey = new Map(dropped.map((f) => [modKey(f), f]))
const bumps = []
for (const nuevo of added) {
  const viejo = byKey.get(modKey(nuevo))
  if (viejo) {
    bumps.push({ viejo, nuevo })
    byKey.delete(modKey(nuevo))
  }
}

const nuevos = added.filter((f) => !bumps.some((b) => b.nuevo === f))
const retirados = [...byKey.values()]

console.log(`\n${bumps.length} mods suben de versión:`)
for (const { viejo, nuevo } of bumps) console.log(`   ${viejo}\n   -> ${nuevo}`)

if (nuevos.length || retirados.length) {
  console.error('\nEsto NO es solo una subida de versiones:')
  nuevos.forEach((f) => console.error('  MOD NUEVO:', f))
  retirados.forEach((f) => console.error('  MOD RETIRADO:', f))
  console.error('\nUsa scripts/build-manifest.mjs para eso. Abortado.')
  process.exit(1)
}

if (bumps.length === 0) {
  console.log('\nNada que actualizar.')
  process.exit(0)
}

// --- Reescribe el manifiesto vivo, tocando solo lo que cambia ---------------
const next = { ...live, packVersion: VERSION }
const replaced = new Map(bumps.map((b) => [b.viejo, b.nuevo]))

next.mods = live.mods.map((entry) => {
  const nuevo = replaced.get(entry.filename)
  if (!nuevo) return entry

  const source = join(modsDir, nuevo)
  copyFileSync(source, join(OUT, 'mods', nuevo))
  return {
    filename: nuevo,
    sha1: sha1(source),
    sizeBytes: statSync(source).size,
    url: `${BASE}/mods/${encodeURIComponent(nuevo)}`
  }
})

// Los .jar viejos salen de dist-modpack para que no se vuelvan a subir.
for (const { viejo } of bumps) rmSync(join(OUT, 'mods', viejo), { force: true })

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(next, null, 2), 'utf8')

const totalMb = bumps.reduce((t, b) => t + statSync(join(modsDir, b.nuevo)).size, 0) / 1048576
console.log(`\nmanifest.json escrito: packVersion ${live.packVersion} -> ${VERSION}`)
console.log(`Overrides intactos (${live.overrides.length} partes, sin retocar).`)
console.log(`A subir: ${bumps.length} jars, ${totalMb.toFixed(1)} MB.`)

if (!args.publish) {
  console.log('\nNada subido. Repite con --publish cuando lo veas bien.')
  process.exit(0)
}

// --- Sube ------------------------------------------------------------------
function quote(arg) {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

function put(key, file) {
  // shell:true más un nombre con espacios rompió una subida a mitad de camino;
  // por eso todo pasa por quote().
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', quote(`${BUCKET}/${key}`), '--file', quote(file), '--remote'],
    { stdio: 'pipe', shell: true }
  )
}

let done = 0
for (const { nuevo } of bumps) {
  put(`mods/${nuevo}`, join(OUT, 'mods', nuevo))
  done += 1
  console.log(`  [${done}/${bumps.length}] ${nuevo}`)
}

// El manifiesto va EL ÚLTIMO: hasta que no está, ningún launcher pide los jars
// nuevos, así que no hay ventana en la que apunte a algo que aún no existe.
put('manifest.json', join(OUT, 'manifest.json'))
console.log('\nmanifest.json subido. Publicado.')
