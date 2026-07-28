/**
 * Publishes a launcher release wired to the modpack currently in R2.
 *
 * The manifest URL has to be baked in at build time — a packaged app has no
 * .env and no shell — so this reads the bucket's public hostname from wrangler
 * rather than relying on someone remembering to set the variable.
 *
 *   node scripts/release-with-modpack.mjs [--bucket victoria-modpack]
 */
import { execFileSync } from 'child_process'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, [])
)

const BUCKET = args.bucket ?? 'victoria-modpack'

function run(command, argv, options = {}) {
  return execFileSync(command, argv, { encoding: 'utf8', shell: true, ...options })
}

console.log(`Leyendo la URL pública de ${BUCKET}...`)

let baseUrl
try {
  const info = run('npx', ['wrangler', 'r2', 'bucket', 'dev-url', 'get', BUCKET])
  const match = info.match(/https:\/\/[a-z0-9-]+\.r2\.dev/i)
  if (!match) throw new Error(info)
  baseUrl = match[0]
} catch (error) {
  console.error(`
No pude leer la URL del bucket ${BUCKET}.

Publica el modpack primero:
  node scripts/publish-modpack-r2.mjs

${error.message ?? ''}`)
  process.exit(1)
}

const manifestUrl = `${baseUrl}/manifest.json`
console.log(`Modpack: ${manifestUrl}\n`)

// The GitHub token comes from the gh session rather than being stored anywhere.
let ghToken
try {
  ghToken = run('gh', ['auth', 'token']).trim()
} catch {
  try {
    ghToken = run('"C:\\Program Files\\GitHub CLI\\gh.exe"', ['auth', 'token']).trim()
  } catch {
    console.error('No hay sesión de GitHub. Ejecuta: gh auth login')
    process.exit(1)
  }
}

run('npm', ['run', 'release'], {
  stdio: 'inherit',
  env: { ...process.env, VICTORIA_MANIFEST_URL: manifestUrl, GH_TOKEN: ghToken }
})

console.log(`
Publicado. El launcher descargará el modpack desde:
  ${manifestUrl}
`)
