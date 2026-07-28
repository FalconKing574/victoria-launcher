/**
 * Points the launcher at your GitHub repos and publishes the first release.
 *
 * Everything here needs your GitHub account, so it runs on your machine with
 * your credentials rather than being done for you.
 *
 *   node scripts/setup-github.mjs
 */
import { createInterface } from 'readline'
import { execSync, execFileSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { stdin, stdout } from 'process'

const rl = createInterface({ input: stdin, output: stdout })
const ask = (q) => new Promise((r) => rl.question(q, (a) => r(a.trim())))

function has(command) {
  try {
    execSync(command, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

console.log(`
==========================================================
  Publicar el Victoria Kingdom Launcher en GitHub
==========================================================
`)

const ghReady = has('gh --version') && has('gh auth status')

if (!ghReady) {
  console.log(`Falta la CLI de GitHub, o no has iniciado sesión en ella.

  1. Instálala:   winget install GitHub.cli
  2. Cierra y abre la terminal.
  3. Inicia sesión:  gh auth login
  4. Vuelve a ejecutar este script.

La sesión la haces tú: yo no manejo tus credenciales.
`)
  process.exit(1)
}

const owner = execSync('gh api user --jq .login', { encoding: 'utf8' }).trim()
console.log(`Cuenta de GitHub detectada: ${owner}\n`)

const repo = (await ask('Nombre del repo para el LAUNCHER [victoria-launcher]: ')) || 'victoria-launcher'
const visibility =
  (await ask('¿Público o privado? El autoupdate necesita PÚBLICO [publico/privado] (publico): ')) ||
  'publico'

rl.close()

const isPublic = !visibility.toLowerCase().startsWith('priv')
if (!isPublic) {
  console.log(`
AVISO: en un repo privado el launcher no podrá descargar la actualización sin
autenticarse, así que el autoupdate no funcionará para tus jugadores.
`)
}

// Point the build at the repo before publishing, or the release lands somewhere
// the launcher is not looking.
const configPath = 'electron-builder.yml'
const config = readFileSync(configPath, 'utf8')
  .replace(/(\n\s+owner:\s*).*/, `$1${owner}`)
  .replace(/(\npublish:[\s\S]*?\n\s+repo:\s*).*/, `$1${repo}`)
writeFileSync(configPath, config, 'utf8')
console.log(`\n${configPath} apuntando a ${owner}/${repo}`)

const exists = has(`gh repo view ${owner}/${repo}`)
if (exists) {
  console.log(`El repo ${owner}/${repo} ya existe, lo reutilizo.`)
} else {
  console.log(`Creando ${owner}/${repo}...`)
  execFileSync(
    'gh',
    ['repo', 'create', `${owner}/${repo}`, isPublic ? '--public' : '--private', '--disable-wiki'],
    { stdio: 'inherit' }
  )
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
console.log(`\nCompilando y publicando la versión ${version}...\n`)

// electron-builder reads the token from the environment; gh already holds one.
const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
execSync('npm run release', {
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: token }
})

console.log(`
==========================================================
  Publicado: https://github.com/${owner}/${repo}/releases
==========================================================

A partir de ahora, para sacar una versión nueva del launcher:

  1. Sube "version" en package.json
  2. npm run release

Todos los launchers instalados se actualizan solos.

Falta el modpack, que va en su propio repo:

  node scripts/build-manifest.mjs --repo ${owner}/victoria-modpack --version 1.0.0

Y luego subes manifest.json, los .jar y overrides.zip a una release de ese repo.
`)

if (!existsSync('release')) process.exit(0)
