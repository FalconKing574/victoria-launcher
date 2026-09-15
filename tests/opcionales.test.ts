import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Las tres listas de mods opcionales, que tienen que estar de acuerdo.
 *
 * <h2>Qué protege</h2>
 *
 * Un mod opcional vive escrito en tres lugares distintos, y los tres se editan a
 * mano:
 *
 *  1. `scripts/build-manifest.mjs` → `OPTIONAL`, que es lo que se publica.
 *  2. `src/main/ipc/sync.ts` → `DEFAULT_OPTIONAL`, los que vienen encendidos en
 *     una instalación nueva.
 *  3. `src/renderer/src/screens/Modpack.tsx` → `LOCAL_ICONS`, la imagen que se
 *     ve en la pantalla.
 *
 * Mover un mod de opcional a requerido obliga a tocar los tres, y eso ya pasó
 * con `xaeros-world-map`. Lo que se olvida no rompe nada ruidosamente:
 *
 *  - un `DEFAULT_OPTIONAL` que nombra un id que ya no existe queda encendiendo
 *    un mod fantasma;
 *  - un `LOCAL_ICONS` de más empaqueta una imagen que nadie usa;
 *  - uno de menos deja el ícono colgando de que el CDN responda.
 *
 * Se leen los tres archivos como texto a propósito: importarlos traería
 * `electron` y los assets de imagen, que es mucha maquinaria para comparar tres
 * listas de strings.
 */

const raiz = join(__dirname, '..')
const leer = (rel: string): string => readFileSync(join(raiz, rel), 'utf8')

/** Los ids de `OPTIONAL`, que es la lista que manda. */
function idsPublicados(): string[] {
  const texto = leer('scripts/build-manifest.mjs')
  const bloque = texto.slice(texto.indexOf('const OPTIONAL'))
  return [...bloque.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
}

/** Los que vienen encendidos en una instalación nueva. */
function idsEncendidosPorDefecto(): string[] {
  const m = leer('src/main/ipc/sync.ts').match(/DEFAULT_OPTIONAL\s*=\s*\[([^\]]*)\]/s)
  if (!m) return []
  return [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1])
}

/** Los que tienen imagen propia en la pantalla Modpack. */
function idsConIconoLocal(): string[] {
  const texto = leer('src/renderer/src/screens/Modpack.tsx')
  const m = texto.match(/LOCAL_ICONS:\s*Record<string,\s*string>\s*=\s*\{([^}]*)\}/s)
  if (!m) return []
  return [...m[1].matchAll(/(?:'([a-z0-9-]+)'|^\s*([a-z0-9-]+)\s*:)/gm)]
    .map((x) => x[1] ?? x[2])
    .filter(Boolean) as string[]
}

describe('mods opcionales', () => {
  it('hay al menos uno publicado', () => {
    // Si esto falla, el que se rompió es el parseo de arriba y no el launcher.
    expect(idsPublicados().length).toBeGreaterThan(0)
  })

  it('los que vienen encendidos existen como opcionales', () => {
    // Un id que ya no está en OPTIONAL queda encendiendo un mod fantasma: el
    // estado lo lista, la pantalla no lo muestra y nadie entiende por qué.
    const publicados = idsPublicados()
    for (const id of idsEncendidosPorDefecto()) {
      expect(publicados, `DEFAULT_OPTIONAL nombra "${id}", que ya no es opcional`).toContain(id)
    }
  })

  it('no sobra ningún ícono local', () => {
    // Un ícono de más empaqueta una imagen que nadie va a ver.
    const publicados = idsPublicados()
    for (const id of idsConIconoLocal()) {
      expect(publicados, `LOCAL_ICONS tiene "${id}", que ya no es opcional`).toContain(id)
    }
  })

  it('todos los opcionales tienen ícono local', () => {
    // Sin él, la pantalla cae a la imagen del CDN: se ve sólo si hay red, que
    // es justo lo que un launcher no debería dar por sentado.
    const conIcono = idsConIconoLocal()
    for (const id of idsPublicados()) {
      expect(conIcono, `el opcional "${id}" no tiene ícono local`).toContain(id)
    }
  })

  it('no hay ids repetidos en ninguna de las tres', () => {
    for (const [nombre, lista] of [
      ['OPTIONAL', idsPublicados()],
      ['DEFAULT_OPTIONAL', idsEncendidosPorDefecto()],
      ['LOCAL_ICONS', idsConIconoLocal()]
    ] as Array<[string, string[]]>) {
      expect(new Set(lista).size, `${nombre} tiene ids repetidos`).toBe(lista.length)
    }
  })
})
