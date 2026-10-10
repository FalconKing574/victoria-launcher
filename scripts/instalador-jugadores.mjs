#!/usr/bin/env node
/**
 * Pone el instalador fijo en la release de una versión.
 *
 * «Windows protegió tu PC» es SmartScreen avisando que un archivo sin firma
 * todavía no tiene reputación, y la reputación va atada al hash del archivo. Si
 * el instalador que bajan los jugadores cambiara en cada versión, cada uno
 * arrancaría de cero y el aviso no se iría nunca.
 *
 * Por eso el instalador que se reparte es SIEMPRE el mismo archivo: vive en la
 * release `instalador` (una prerelease, para que el actualizador no la tome como
 * la última; ver GitHubProvider de electron-updater, que pregunta por
 * /releases/latest) y es el que se mandó a revisar a Microsoft. El launcher se
 * actualiza solo apenas se abre, así que instalar uno viejo no importa.
 *
 * Cada versión nueva sigue llevando su propio instalador, que es el que baja el
 * actualizador (latest.yml lo nombra) y que por eso se llama
 * `Victoria-Kingdom-actualizacion-<versión>.exe`: que no parezca el que hay que
 * bajar. Este script le suma una copia del fijo con el nombre que se les dice a
 * los jugadores. Así el botón «Descargar» del Discord, que apunta a
 * /releases/latest, entrega el archivo con reputación sin tocar el Discord.
 *
 * Uso, después de `npm run release` (necesita `gh` con sesión):
 *
 *     node scripts/instalador-fijo.mjs          # la versión de package.json
 *     node scripts/instalador-fijo.mjs v1.6.1   # otra ya publicada
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const REPO = 'FalconKing574/victoria-launcher'
const RELEASE_FIJA = 'instalador'
const FIJO = 'Victoria-Kingdom-Setup.exe'
/** Para no repetir el aviso si el script corre dos veces sobre la misma release. */
const MARCA = '<!-- instalador-fijo -->'

const tag = process.argv[2] ?? `v${JSON.parse(readFileSync('package.json', 'utf8')).version}`
if (tag === RELEASE_FIJA) {
  console.error('La release fija no se toca con este script: se reemplaza a mano (ver docs/mantenimiento/05).')
  process.exit(1)
}

function gh(...args) {
  return execFileSync('gh', [...args, '--repo', REPO], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

function digestDelFijo(release) {
  const salida = gh('release', 'view', release, '--json', 'assets', '--jq', `.assets[] | select(.name == "${FIJO}") | .digest`)
  return salida.trim()
}

const tmp = mkdtempSync(join(tmpdir(), 'instalador-fijo-'))
try {
  gh('release', 'download', RELEASE_FIJA, '--pattern', FIJO, '--dir', tmp, '--clobber')
  gh('release', 'upload', tag, join(tmp, FIJO), '--clobber')

  const cuerpo = gh('release', 'view', tag, '--json', 'body', '--jq', '.body')
  if (!cuerpo.includes(MARCA)) {
    const aviso = [
      MARCA,
      `## ⬇️ Para instalar, descargá **${FIJO}**`,
      '',
      'El otro `.exe` de esta lista es el que usa el launcher para actualizarse solo: no hace falta bajarlo.',
      ''
    ].join('\n')
    const notas = join(tmp, 'notas.md')
    writeFileSync(notas, `${aviso}\n${cuerpo.trim()}\n`)
    gh('release', 'edit', tag, '--notes-file', notas)
  }

  const original = digestDelFijo(RELEASE_FIJA)
  const copia = digestDelFijo(tag)
  if (!original || original !== copia) {
    console.error(`La copia en ${tag} (${copia || 'no está'}) no es igual a la fija (${original || 'no está'}).`)
    process.exit(1)
  }
  console.log(`${tag}: ${FIJO} puesto (${copia}).`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
