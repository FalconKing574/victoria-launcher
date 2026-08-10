/**
 * Comprueba contra el modpack de verdad que se puede sacar un shader suelto de
 * un override sin bajarlo entero.
 *
 * Es la prueba de que «recuperar un shader» funciona en el momento: los tests
 * cubren el troceo del formato, pero no que R2 admita peticiones Range ni que
 * el archivo salga íntegro. Esto sí.
 *
 *   node scripts/probe-remote-zip.mjs
 */
import { createHash } from 'crypto'
import { readFileSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { build } from 'vite'

// El módulo está en TypeScript; se compila al vuelo para no duplicar la lógica.
const bundle = await build({
  logLevel: 'silent',
  build: {
    write: false,
    lib: { entry: 'src/main/lib/remote-zip.ts', formats: ['es'], fileName: 'remote-zip' },
    rollupOptions: { external: ['crypto', 'fs', 'path', 'zlib'] }
  }
})
const code = bundle[0].output[0].code
const modulo = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const MANIFEST = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'
const manifest = await (await fetch(MANIFEST, { cache: 'no-store' })).json()

console.log(`modpack ${manifest.packVersion} — ${manifest.overrides.length} overrides\n`)

let encontrado = null
for (const part of manifest.overrides) {
  process.stdout.write(`leyendo el índice de ${part.name} (${(part.sizeBytes / 1048576).toFixed(0)} MB)... `)
  const entradas = await modulo.listRemoteZip(part.url)
  const shaders = entradas.filter((e) => e.name.startsWith('shaderpacks/') && e.name.endsWith('.zip'))
  console.log(`${entradas.length} entradas, ${shaders.length} shaderpacks`)
  if (shaders.length && !encontrado) encontrado = { part, entrada: shaders[0], shaders }
}

if (!encontrado) {
  console.error('\nNingún override contiene shaderpacks. Nada que probar.')
  process.exit(1)
}

console.log(`\nshaderpacks disponibles en ${encontrado.part.name}:`)
for (const s of encontrado.shaders) {
  console.log(`   ${s.name}  ${(s.size / 1048576).toFixed(2)} MB`)
}

const destino = join(tmpdir(), 'victoria-probe-shader.zip')
rmSync(destino, { force: true })

const t0 = Date.now()
await modulo.extractRemoteEntry(encontrado.part.url, encontrado.entrada, destino)
const ms = Date.now() - t0

const escrito = statSync(destino).size
const datos = readFileSync(destino)
const esZip = datos.readUInt32LE(0) === 0x04034b50

console.log(`\nextraído ${encontrado.entrada.name}`)
console.log(`   bajado del archivo: ${(encontrado.entrada.compressedSize / 1048576).toFixed(2)} MB de ${(encontrado.part.sizeBytes / 1048576).toFixed(0)} MB`)
console.log(`   escrito:            ${escrito} bytes (esperado ${encontrado.entrada.size})`)
console.log(`   ¿es un zip válido?: ${esZip ? 'sí' : 'NO'}`)
console.log(`   sha1:               ${createHash('sha1').update(datos).digest('hex')}`)
console.log(`   tardó:              ${(ms / 1000).toFixed(1)} s`)

rmSync(destino, { force: true })

const ok = escrito === encontrado.entrada.size && esZip
console.log(`\n${ok ? 'FUNCIONA: se recupera un shader sin bajar el override entero.' : 'FALLÓ.'}`)
process.exit(ok ? 0 : 1)
