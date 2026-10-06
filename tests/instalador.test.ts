import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LAUNCHER_REPO } from '../src/main/config'

/**
 * Qué protege esto.
 *
 * Dos cosas del instalador que, si se rompen, no fallan en ningún sitio: sólo
 * las nota el jugador.
 *
 * 1. Que una actualización no vuelva a mostrar el asistente. El launcher abre el
 *    instalador nuevo con `--updated`, y los launchers viejos (el 1.6.1 del
 *    instalador fijo incluido) lo abren sin `/S`. Lo único que lo pone en
 *    silencio es `build/installer.nsh`. Sin él vuelve el «retrocede a la etapa de
 *    instalación», con la pregunta de para quién instalar y todo.
 * 2. Que el enlace de «Descargar el instalador» apunte al repo donde de verdad
 *    se publica: ya pasó que `owner` acabó siendo el usuario de Windows y no el
 *    de GitHub (docs/mantenimiento/04-trampas.md).
 */

const raiz = join(__dirname, '..')
const leer = (rel: string): string => readFileSync(join(raiz, rel), 'utf8')

describe('instalador', () => {
  const nsh = leer('build/installer.nsh')
    // Fuera los comentarios: lo que cuenta es lo que compila.
    .split('\n')
    .map((linea) => linea.replace(/;.*$/, '').trim())
    .filter(Boolean)
    .join('\n')

  it('con --updated se instala en silencio', () => {
    expect(nsh).toMatch(
      /!macro customInit[\s\S]*?\$\{isUpdated\}[\s\S]*?SetSilent silent[\s\S]*?!macroend/
    )
  })

  it('no pregunta para quién instalar', () => {
    expect(nsh).toMatch(
      /!macro customInstallMode[\s\S]*?StrCpy \$isForceCurrentInstall "1"[\s\S]*?!macroend/
    )
  })

  it('sigue siendo el instalador por usuario y sin pedir administrador', () => {
    // El silencio de arriba cuenta con eso: una instalación por máquina en
    // silencio tendría que pedir elevación, y eso no puede pasar sin ventana.
    const yml = leer('electron-builder.yml')
    expect(yml).toMatch(/^\s+perMachine:\s*false\s*$/m)
    expect(yml).toMatch(/^\s+oneClick:\s*false\s*$/m)
  })
})

describe('LAUNCHER_REPO', () => {
  it('es el mismo repo al que publica electron-builder', () => {
    const yml = leer('electron-builder.yml')
    const publish = yml.slice(yml.indexOf('\npublish:'))
    const owner = publish.match(/^\s+owner:\s*(\S+)\s*$/m)?.[1]
    const repo = publish.match(/^\s+repo:\s*(\S+)\s*$/m)?.[1]
    expect(`${owner}/${repo}`).toBe(LAUNCHER_REPO)
  })
})
