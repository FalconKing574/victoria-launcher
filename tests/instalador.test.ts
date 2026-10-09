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
 * 3. Que SignPath encuentre lo que tiene que firmar. Busca cada archivo por
 *    nombre y por producto (`.signpath/*.xml`); si no coinciden con lo que arma
 *    electron-builder, la firma se corta sin firmar nada. Pasó: el instalador
 *    cambió de nombre y la configuración siguió buscando el viejo.
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

describe('firma con SignPath', () => {
  const yml = leer('electron-builder.yml')
  const producto = yml.match(/^productName:\s*(.+?)\s*$/m)?.[1]
  const version = JSON.parse(leer('package.json')).version as string

  /** Los `<pe-file>` de una configuración: el nombre (con `*`) y el producto. */
  const archivos = (xml: string): { path: string; producto: string }[] =>
    [...leer(xml).matchAll(/<pe-file path="([^"]+)" product-name="([^"]+)"/g)].map((m) => ({
      path: m[1],
      producto: m[2]
    }))
  const coincide = (patron: string, nombre: string): boolean =>
    new RegExp(`^${patron.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(
      nombre
    )

  it('el instalador se llama como lo busca SignPath', () => {
    const plantilla = yml.match(/^\s+artifactName:\s*(\S+)\s*$/m)?.[1]
    const instalador = plantilla!.replace('${version}', version).replace('${ext}', 'exe')
    const [entrada] = archivos('.signpath/instalador.xml')
    expect(coincide(entrada.path, instalador)).toBe(true)
    expect(entrada.producto).toBe(producto)
  })

  it('el launcher y el desinstalador se llaman como los busca SignPath', () => {
    const entradas = archivos('.signpath/ejecutables.xml')
    // Los nombres reales, como salen en el registro del workflow.
    expect(entradas.some((e) => coincide(e.path, `${producto}.exe`))).toBe(true)
    expect(entradas.some((e) => coincide(e.path, '__uninstaller-nsis-victoria-launcher.exe'))).toBe(true)
    for (const e of entradas) expect(e.producto).toBe(producto)
  })
})
