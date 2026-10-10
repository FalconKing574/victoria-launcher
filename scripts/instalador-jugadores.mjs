#!/usr/bin/env node
/**
 * Pone el instalador de una versión donde lo bajan los jugadores.
 *
 * Los jugadores bajan siempre `Victoria-Kingdom-Setup.exe`:
 *
 * - la web y el Discord, de la release `instalador` (una prerelease, para que
 *   el actualizador no la tome como la última; ver GitHubProvider de
 *   electron-updater, que pregunta por /releases/latest):
 *   https://github.com/FalconKing574/victoria-launcher/releases/download/instalador/Victoria-Kingdom-Setup.exe
 * - el botón «Descargar» que apunta a /releases/latest, de la release de la
 *   versión.
 *
 * Este script sube a los dos lugares una copia del instalador que la versión
 * ya publicó (`Victoria-Kingdom-actualizacion-<versión>.exe`, el que baja el
 * actualizador), con ese nombre. Así quien instala de cero empieza en la
 * versión actual.
 *
 * Hasta el 10-10-2026 se repartía siempre el mismo instalador, el de la 1.6.1,
 * para no perder la reputación de SmartScreen, que va atada al archivo. Quedó
 * tan viejo que daba problemas al abrir, y Microsoft confirmó que sin firma
 * cada archivo junta su reputación de cero igual. Con la firma de SignPath la
 * reputación pasa al certificado y deja de importar. Ver
 * docs/mantenimiento/05-firma-de-codigo.md.
 *
 * Uso, después de publicar (necesita `gh` con sesión):
 *
 *     node scripts/instalador-jugadores.mjs          # la versión de package.json
 *     node scripts/instalador-jugadores.mjs v1.8.2   # otra ya publicada
 */
import { execFileSync } from 'child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const REPO = 'FalconKing574/victoria-launcher'
const RELEASE_JUGADORES = 'instalador'
const NOMBRE = 'Victoria-Kingdom-Setup.exe'
/** Para no repetir el aviso si el script corre dos veces sobre la misma release. */
const MARCA = '<!-- instalador-jugadores -->'
/** El aviso que dejaba el script anterior; se reemplaza por el nuevo. */
const MARCA_VIEJA = '<!-- instalador-fijo -->'

const tag = process.argv[2] ?? `v${JSON.parse(readFileSync('package.json', 'utf8')).version}`
if (tag === RELEASE_JUGADORES || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`Uso: node scripts/instalador-jugadores.mjs [v<versión>] (no «${tag}»).`)
  process.exit(1)
}
const version = tag.slice(1)
const ACTUALIZACION = `Victoria-Kingdom-actualizacion-${version}.exe`

function gh(...args) {
  return execFileSync('gh', [...args, '--repo', REPO], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

function digest(release, nombre) {
  return gh('release', 'view', release, '--json', 'assets', '--jq', `.assets[] | select(.name == "${nombre}") | .digest`).trim()
}

const tmp = mkdtempSync(join(tmpdir(), 'instalador-jugadores-'))
try {
  gh('release', 'download', tag, '--pattern', ACTUALIZACION, '--dir', tmp, '--clobber')
  const copia = join(tmp, NOMBRE)
  copyFileSync(join(tmp, ACTUALIZACION), copia)

  gh('release', 'upload', tag, copia, '--clobber')
  gh('release', 'upload', RELEASE_JUGADORES, copia, '--clobber')

  // El aviso de la release de la versión: cuál de los dos .exe bajar.
  const cuerpo = gh('release', 'view', tag, '--json', 'body', '--jq', '.body')
  if (!cuerpo.includes(MARCA)) {
    const sinViejo = cuerpo
      .split('\n')
      .filter((linea) => !linea.includes(MARCA_VIEJA) && !linea.includes('descargá **Victoria-Kingdom-Setup.exe**'))
      .filter((linea) => !linea.startsWith('El otro `.exe` de esta lista'))
      .join('\n')
      .trim()
    const aviso = [
      MARCA,
      `## ⬇️ Para instalar, descarga **${NOMBRE}**`,
      '',
      'El otro `.exe` de esta lista es el mismo instalador: lo usa el launcher para actualizarse solo.',
      ''
    ].join('\n')
    const notas = join(tmp, 'notas.md')
    writeFileSync(notas, `${aviso}\n${sinViejo}\n`)
    gh('release', 'edit', tag, '--notes-file', notas)
  }

  // La release de la web y el Discord dice qué versión entrega.
  const notasJugadores = join(tmp, 'notas-jugadores.md')
  writeFileSync(
    notasJugadores,
    [
      `Instalador del launcher de Victoria Kingdom, versión **${version}**.`,
      '',
      `Se reemplaza solo con cada versión nueva. Enlace permanente: https://github.com/${REPO}/releases/download/${RELEASE_JUGADORES}/${NOMBRE}`,
      ''
    ].join('\n')
  )
  gh('release', 'edit', RELEASE_JUGADORES, '--notes-file', notasJugadores)

  // Lo publicado, no el archivo local: los tres tienen que ser el mismo.
  const original = digest(tag, ACTUALIZACION)
  const enVersion = digest(tag, NOMBRE)
  const enJugadores = digest(RELEASE_JUGADORES, NOMBRE)
  if (!original || original !== enVersion || original !== enJugadores) {
    console.error(
      `No coinciden: ${ACTUALIZACION} ${original || 'no está'}, ${NOMBRE} en ${tag} ${enVersion || 'no está'}, en ${RELEASE_JUGADORES} ${enJugadores || 'no está'}.`
    )
    process.exit(1)
  }
  console.log(`${NOMBRE} es ahora la ${version} en ${tag} y en ${RELEASE_JUGADORES} (${original}).`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
