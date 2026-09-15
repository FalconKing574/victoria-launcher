/**
 * Cambia los bloques `auth` y `normas` del manifiesto publicado, sin tocar nada más.
 *
 * ## Para qué existe
 *
 * Las normas del tutorial y los datos del servidor de cuentas (llave, Discord)
 * viven en el manifiesto para poder cambiarlos sin publicar una versión del
 * launcher. Pero `build-manifest.mjs` rearma los overrides (685 MB para cada
 * jugador) y `update-mods-only.mjs` pide una versión nueva y jars. Para cambiar
 * un texto de las normas no hace falta ninguna de las dos cosas.
 *
 * Este script baja el manifiesto vivo, reemplaza esos dos bloques con
 * `_deploy/auth.json` y `_deploy/normas.json` de VictoriaRP, y lo sube igual.
 * **No cambia `packVersion`**: ningún launcher baja nada por esto; la próxima
 * vez que lean el manifiesto ya ven lo nuevo.
 *
 * ## Uso
 *
 *     node scripts/parchar-manifiesto.mjs            # muestra qué cambiaría
 *     node scripts/parchar-manifiesto.mjs --subir    # lo sube
 *
 * Recordá: `normas.version` tiene que ser igual a `normas-version` de
 * `plugins/VictoriaAuth/config.yml` en el servidor.
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev'
const BUCKET = 'victoria-modpack'
const RAIZ_RP = join(process.env.USERPROFILE ?? process.env.HOME ?? '.', 'Desktop', 'VictoriaRP')
const SUBIR = process.argv.includes('--subir')

function leer(nombre) {
  const ruta = join(RAIZ_RP, '_deploy', nombre)
  if (!existsSync(ruta)) throw new Error(`Falta ${ruta}`)
  const { _comment, ...resto } = JSON.parse(readFileSync(ruta, 'utf8'))
  return resto
}

const vivo = await (await fetch(`${BASE}/manifest.json`, { cache: 'no-store' })).json()
const auth = leer('auth.json')
const normas = leer('normas.json')

if (!auth.host || !auth.puerto || !auth.llave) throw new Error('auth.json incompleto (host, puerto, llave)')
if (!normas.version || !Array.isArray(normas.secciones) || normas.secciones.length === 0) {
  throw new Error('normas.json incompleto (version, secciones)')
}

const nuevo = { ...vivo, auth, normas }
console.log(`Manifiesto vivo: packVersion ${vivo.packVersion} (no cambia)`)
console.log(`  auth:   ${vivo.auth?.host}:${vivo.auth?.puerto} -> ${auth.host}:${auth.puerto}` +
  `, discord ${vivo.auth?.discord ? 'si' : 'no'} -> ${auth.discord ? `si (client ${auth.discord.clientId})` : 'no'}`)
console.log(`  normas: ${vivo.normas ? `version ${vivo.normas.version}` : 'ninguna'} -> version ${normas.version}, ${normas.secciones.length} secciones`)

const OUT = join(process.cwd(), 'dist-modpack')
mkdirSync(OUT, { recursive: true })
const archivo = join(OUT, 'manifest.parchado.json')
writeFileSync(archivo, JSON.stringify(nuevo, null, 2), 'utf8')

if (!SUBIR) {
  console.log(`\nEnsayo: escrito ${archivo}. Para publicarlo, --subir.`)
  process.exit(0)
}

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
execFileSync('npx', ['wrangler', 'r2', 'object', 'put', quote(`${BUCKET}/manifest.json`), '--file', quote(archivo),
  '--content-type', 'application/json', '--remote'], { stdio: 'pipe', shell: true })

const comprobado = await (await fetch(`${BASE}/manifest.json`, { cache: 'no-store' })).json()
const ok = comprobado.packVersion === vivo.packVersion && comprobado.normas?.version === normas.version &&
  comprobado.auth?.llave === auth.llave && comprobado.mods.length === vivo.mods.length
console.log(ok ? '\nPublicado y comprobado contra R2.' : '\n⚠ El manifiesto publicado no coincide. Revisalo YA.')
process.exit(ok ? 0 : 1)
