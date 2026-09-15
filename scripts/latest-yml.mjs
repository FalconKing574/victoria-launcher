/**
 * Rehace `latest.yml` y el `.blockmap` de un instalador ya firmado.
 *
 * ## Por qué hace falta
 *
 * electron-builder escribe `latest.yml` con el sha512 del instalador SIN firmar.
 * SignPath lo firma después, y la firma cambia los bytes: el actualizador baja
 * el instalador firmado, compara contra el sha512 viejo y lo rechaza por
 * corrupto. Todos los jugadores quedarían sin actualizaciones.
 *
 * Así que después de firmar se recalculan el sha512, el tamaño y el blockmap
 * (las diferencias para bajar sólo lo que cambió) con el mismo `app-builder`
 * que usa electron-builder, y se escribe el `latest.yml` con el mismo formato.
 *
 *     node scripts/latest-yml.mjs --instalador "release/Victoria Kingdom Setup 1.6.0.exe" --salida publicar
 *
 * Deja en `--salida` los tres archivos con los nombres que espera el
 * actualizador (espacios → guiones, como los sube electron-builder).
 */
import { execFileSync } from 'child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { createRequire } from 'module'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, v, i, todos) => (v.startsWith('--') ? [...pares, [v.slice(2), todos[i + 1]]] : pares), [])
)
if (!args.instalador || !args.salida) {
  console.error('Uso: node scripts/latest-yml.mjs --instalador <exe firmado> --salida <carpeta>')
  process.exit(2)
}

const require = createRequire(import.meta.url)
const { appBuilderPath } = require('app-builder-bin')
const version = JSON.parse(readFileSync('package.json', 'utf8')).version

const nombre = basename(args.instalador).replace(/ /g, '-')
if (!nombre.includes(version)) {
  console.error(`El instalador (${nombre}) no es de la versión del package.json (${version}).`)
  process.exit(1)
}

mkdirSync(args.salida, { recursive: true })
const destino = join(args.salida, nombre)
copyFileSync(args.instalador, destino)

const info = JSON.parse(
  execFileSync(appBuilderPath, ['blockmap', '--input', destino, '--output', `${destino}.blockmap`], { encoding: 'utf8' })
)

const yml = [
  `version: ${version}`,
  'files:',
  `  - url: ${nombre}`,
  `    sha512: ${info.sha512}`,
  `    size: ${info.size}`,
  `path: ${nombre}`,
  `sha512: ${info.sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  ''
].join('\n')
writeFileSync(join(args.salida, 'latest.yml'), yml, 'utf8')

console.log(`latest.yml para ${nombre}: ${info.size} bytes, sha512 ${info.sha512.slice(0, 16)}…`)
