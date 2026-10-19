import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { armar, DESCARGA, DISCORD, leerNovedades, PAGINAS, preguntas } from '../web/generar-paginas.mjs'
import { articulos } from '../web/wiki-contenido.mjs'

/**
 * Qué protege esto.
 *
 * La cabecera, el pie y las novedades de la web están escritos una sola vez,
 * en web/generar-paginas.mjs, que los copia a cada página. Si alguien edita una
 * copia a mano, o toca novedades.json y no corre el script, la web queda
 * distinta del launcher (que lee el mismo JSON) o una página con otro menú.
 *
 * Y un enlace roto en una página estática no da ningún error: `guia#algo` que
 * no existe deja al jugador arriba de todo, un ícono mal escrito es un hueco y
 * una imagen que no está es un recuadro vacío. Esto los busca todos.
 */

const PUBLICO = new URL('../web/public/', import.meta.url)
const leer = (ruta) => readFileSync(new URL(ruta, PUBLICO), 'utf8')
const existe = (ruta) => existsSync(new URL(ruta.replace(/^\//, ''), PUBLICO))
const archivos = Object.keys(PAGINAS)

describe('Las partes comunes', () => {
  it('cada página está como la deja web/generar-paginas.mjs', () => {
    const novedades = leerNovedades()
    for (const archivo of archivos) {
      const html = leer(archivo)
      expect(armar(html, archivo, novedades), `${archivo} quedó vieja: correr node web/generar-paginas.mjs`).toBe(html)
    }
  })

  it('la descarga y el Discord son los mismos en todas las páginas', () => {
    for (const archivo of archivos) {
      const html = leer(archivo)
      for (const [, href] of html.matchAll(/href="([^"]*releases\/download[^"]*)"/g)) expect(href, archivo).toBe(DESCARGA)
      for (const [, href] of html.matchAll(/href="([^"]*discord\.gg[^"]*)"/g)) expect(href, archivo).toBe(DISCORD)
    }
  })
})

describe('Enlaces, íconos e imágenes', () => {
  const ids = new Map(archivos.map((a) => [a, new Set([...leer(a).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]))
  const iconos = new Set([...leer('iconos.svg').matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]))
  const PAGINA = { '': null, './': 'index.html', '/': 'index.html' }
  const destino = (pagina, archivo) => {
    const limpia = pagina.replace(/^\//, '')
    if (pagina in PAGINA) return PAGINA[pagina] ?? archivo
    return `${limpia}.html`
  }

  it('cada enlace interno lleva a una página y una sección que existen', () => {
    const rotos = []
    for (const archivo of archivos) {
      for (const [, href] of leer(archivo).matchAll(/\shref="([^"]+)"/g)) {
        if (/^https?:/.test(href)) continue
        const [ruta, ancla] = href.split('#')
        if (/\.[a-z0-9]+$/.test(ruta)) {
          // Un archivo: hoja de estilos, ícono, imagen, fuente.
          if (!existe(ruta)) rotos.push(`${archivo}: ${href} no existe`)
          else if (ruta.endsWith('iconos.svg') && !iconos.has(ancla)) rotos.push(`${archivo}: no hay ícono «${ancla}»`)
          continue
        }
        const pagina = destino(ruta, archivo)
        if (!ids.has(pagina)) rotos.push(`${archivo}: ${href} lleva a una página que no existe`)
        else if (ancla && !ids.get(pagina).has(ancla)) rotos.push(`${archivo}: ${href}, «${ancla}» no está en ${pagina}`)
      }
    }
    expect(rotos).toEqual([])
  })

  it('cada imagen que piden las páginas está en la web', () => {
    const faltan = []
    for (const archivo of archivos) {
      const html = leer(archivo)
      const rutas = [
        ...[...html.matchAll(/\ssrc="([^"]+)"/g)].map((m) => m[1]),
        ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])),
        ...[...html.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])
      ]
      for (const ruta of rutas) if (!/^https?:/.test(ruta) && !existe(ruta)) faltan.push(`${archivo}: ${ruta}`)
    }
    expect(faltan).toEqual([])
  })

  it('los enlaces a la wiki llevan a artículos que existen', () => {
    const guias = new Set(articulos.map((a) => a.id))
    const malos = []
    for (const archivo of archivos) {
      for (const [, id] of leer(archivo).matchAll(/https:\/\/wiki\.victoriakingdom\.com\/wiki\/([a-z0-9-]+)/g)) {
        if (!guias.has(id)) malos.push(`${archivo}: /wiki/${id}`)
      }
    }
    expect(malos).toEqual([])
  })
})

describe('Novedades', () => {
  it('el archivo que leen la web y el launcher es válido y sus imágenes existen', () => {
    const lista = leerNovedades()
    expect(lista.length).toBeGreaterThan(2)
    for (const n of lista) expect(existe(n.imagen), n.imagen).toBe(true)
  })

  it('la portada muestra las tres más nuevas y la página, todas', () => {
    const lista = leerNovedades()
    const portada = [...leer('index.html').matchAll(/class="noticia revelar" href="novedades#([^"]+)"/g)].map((m) => m[1])
    expect(portada).toEqual(lista.slice(0, 3).map((n) => n.id))
    const pagina = [...leer('novedades.html').matchAll(/<article class="entrada revelar" id="([^"]+)"/g)].map((m) => m[1])
    expect(pagina).toEqual(lista.map((n) => n.id))
  })

  it('una novedad sin un campo obligatorio corta el script en vez de publicarse a medias', () => {
    const buena = { id: 'algo', fecha: '2026-10-18', etiqueta: 'Launcher', imagen: 'img/icono.png', titulo: 'T', texto: 'X' }
    expect(() => leerNovedades(JSON.stringify([buena]))).not.toThrow()
    expect(() => leerNovedades(JSON.stringify([{ ...buena, titulo: '' }]))).toThrow(/titulo/)
    expect(() => leerNovedades(JSON.stringify([{ ...buena, fecha: '18/10/2026' }]))).toThrow(/AAAA-MM-DD/)
    expect(() => leerNovedades(JSON.stringify([buena, buena]))).toThrow(/repetido/)
  })
})

describe('Preguntas frecuentes', () => {
  it('el JSON-LD dice lo mismo que se ve en la portada', () => {
    const html = leer('index.html')
    const lista = preguntas(html)
    expect(lista.length).toBeGreaterThan(5)
    const datos = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
    const faq = datos['@graph'].find((n) => n['@type'] === 'FAQPage')
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(lista.map((p) => [p.pregunta, p.respuesta]))
    for (const { respuesta } of lista) expect(respuesta).not.toMatch(/[<>]/)
  })
})
