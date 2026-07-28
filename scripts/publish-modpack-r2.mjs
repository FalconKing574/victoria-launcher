/**
 * Publishes the modpack to a Cloudflare R2 bucket and prints the URL to bake
 * into the launcher.
 *
 * R2 is used instead of a GitHub release because the bucket's public hostname
 * is a random pub-*.r2.dev subdomain: it is reachable by anyone who has the
 * link, but it is not listed, browsable or indexed the way a public repo is.
 *
 * Run `node scripts/build-manifest.mjs` first so dist-modpack/ exists.
 *
 *   node scripts/publish-modpack-r2.mjs [--bucket victoria-modpack]
 */
import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, [])
)

const BUCKET = args.bucket ?? 'victoria-modpack'
const OUT = 'dist-modpack'

/**
 * `shell: true` makes Node hand the arguments to cmd as one string, so anything
 * containing a space is re-split by the shell. "Immersive Vehicles-1.20.1.jar"
 * arrived at wrangler as two arguments and the upload died 52 files in. Quoting
 * each argument keeps names with spaces intact.
 */
function quote(arg) {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

function wrangler(argv, options = {}) {
  return execFileSync('npx', ['wrangler', ...argv.map(quote)], {
    encoding: 'utf8',
    shell: true,
    ...options
  })
}

function wranglerOk(argv) {
  try {
    wrangler(argv, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

console.log(`
==========================================================
  Publicar el modpack en Cloudflare R2
==========================================================
`)

/**
 * `wrangler whoami` exits 0 even when signed out, so the exit code says
 * nothing — the output has to be read, or the script sails past the check and
 * fails later on the first real command.
 */
function isAuthenticated() {
  try {
    const output = wrangler(['whoami'], { stdio: 'pipe' })
    return !/not authenticated/i.test(output)
  } catch {
    return false
  }
}

if (!isAuthenticated()) {
  console.log(`No has iniciado sesión en Cloudflare. Ejecuta:

  npx wrangler login

Se abre el navegador, aceptas, y vuelves a lanzar este script.
La sesión la haces tú: yo no manejo tus credenciales.
`)
  process.exit(1)
}

if (!existsSync(join(OUT, 'manifest.json'))) {
  console.error(`Falta ${OUT}/manifest.json.

Genera el modpack primero:
  node scripts/build-manifest.mjs --version 1.0.0
`)
  process.exit(1)
}

// Create the bucket only if it is not already there, so re-running is safe.
if (!wranglerOk(['r2', 'bucket', 'info', BUCKET])) {
  console.log(`Creando el bucket ${BUCKET}...`)
  try {
    wrangler(['r2', 'bucket', 'create', BUCKET], { stdio: 'pipe' })
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    // R2 has to be activated once in the dashboard before the API works, and
    // the raw error is a stack trace that explains none of that.
    if (/10042|enable R2/i.test(output)) {
      console.error(`
R2 todavía no está activado en tu cuenta de Cloudflare.

  1. Entra en https://dash.cloudflare.com
  2. Menú lateral -> R2 Object Storage
  3. Pulsa el botón de activar / "Purchase R2"

Cloudflare pide una tarjeta aunque no vayas a pagar: el plan gratuito son
10 GB de almacenamiento y salida de datos ilimitada. Tu modpack ocupa ~1.1 GB.

Cuando esté activado, vuelve a lanzar este script.
`)
      process.exit(1)
    }
    console.error(output || error.message)
    process.exit(1)
  }
} else {
  console.log(`El bucket ${BUCKET} ya existe, lo reutilizo.`)
}

console.log('\nHabilitando el acceso por enlace público...')
try {
  wrangler(['r2', 'bucket', 'dev-url', 'enable', BUCKET], { stdio: 'inherit' })
} catch {
  console.log('(ya estaba habilitado)')
}

const info = wrangler(['r2', 'bucket', 'dev-url', 'get', BUCKET])
const match = info.match(/https:\/\/[a-z0-9-]+\.r2\.dev/i)
if (!match) {
  console.error(`
No pude leer la URL pública del bucket. Salida de wrangler:

${info}
`)
  process.exit(1)
}
const baseUrl = match[0]

/** Every file to upload, as [localPath, keyInBucket]. */
const uploads = [['manifest.json', 'manifest.json']]

// The overrides ship as several parts because wrangler caps uploads at 300 MiB.
for (const file of readdirSync(OUT)) {
  if (/^overrides-\d+\.zip$/.test(file)) uploads.push([file, file])
}

const modsDir = join(OUT, 'mods')
if (existsSync(modsDir)) {
  for (const file of readdirSync(modsDir)) {
    uploads.push([join('mods', file), `mods/${file}`])
  }
}

// The manifest was generated with GitHub URLs; rewrite them to the bucket so
// the launcher fetches everything from one place.
const manifestPath = join(OUT, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const retarget = (entry) => ({
  ...entry,
  url: `${baseUrl}/mods/${encodeURIComponent(entry.filename)}`
})
manifest.mods = manifest.mods.map(retarget)
manifest.optional = manifest.optional.map(retarget)
if (Array.isArray(manifest.overrides)) {
  manifest.overrides = manifest.overrides.map((part) => ({
    ...part,
    url: `${baseUrl}/${part.name}`
  }))
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
console.log(`\nURLs del manifiesto apuntando a ${baseUrl}`)

const totalMb = uploads.reduce((sum, [local]) => sum + statSync(join(OUT, local)).size, 0) / 1048576
console.log(`\nSubiendo ${uploads.length} archivos (${totalMb.toFixed(0)} MB)...\n`)

let done = 0
for (const [local, key] of uploads) {
  try {
    wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', join(OUT, local), '--remote'], {
      stdio: 'pipe'
    })
  } catch (error) {
    // Swallowing this hid a 300 MiB size limit behind an unreadable stack trace.
    console.error(`

Falló la subida de ${key}:
${error.stdout ?? ''}${error.stderr ?? error.message}`)
    process.exit(1)
  }
  done += 1
  process.stdout.write(`\r  ${done}/${uploads.length}  ${key.slice(0, 60)}`.padEnd(80))
}

console.log(`

==========================================================
  Modpack publicado
==========================================================

  Manifiesto: ${baseUrl}/manifest.json

Compila el launcher apuntando ahí:

  set VICTORIA_MANIFEST_URL=${baseUrl}/manifest.json
  npm run release

Ese enlace solo lo conoce quien lo tenga: el bucket no aparece listado ni
indexado. Para actualizar el modpack, vuelve a generar y a lanzar este script.
`)
