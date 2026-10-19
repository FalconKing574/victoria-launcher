/**
 * Las partes que se repiten en las páginas de la web, escritas una sola vez.
 *
 *   node web/generar-paginas.mjs
 *
 * En cada página reescribe lo que está entre `<!-- comun:NOMBRE -->` y
 * `<!-- /comun:NOMBRE -->`: la cabecera con el menú del celular, el pie, y las
 * novedades, que salen de public/datos/novedades.json (las tres últimas en la
 * portada; todas, con su índice, en novedades.html). El resto de cada página no
 * se toca. Antes, la cabecera y el pie estaban copiados a mano en cada página y
 * un cambio había que hacerlo en todas.
 *
 * tests/web-paginas.test.js falla si una página quedó distinta de lo que
 * escribiría este script: después de editar novedades.json, el menú o el pie,
 * hay que correrlo.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PUBLICO = fileURLToPath(new URL('./public/', import.meta.url))

export const DESCARGA = 'https://github.com/FalconKing574/victoria-launcher/releases/download/instalador/Victoria-Kingdom-Setup.exe'
export const DISCORD = 'https://discord.gg/HFvsGaxc7G'
export const WIKI = 'https://wiki.victoriakingdom.com'
export const CODIGO = 'https://github.com/FalconKing574/victoria-launcher'

/**
 * Qué página es cada archivo. `raiz` es como empiezan sus enlaces: la 404 se
 * sirve en cualquier dirección que no exista, también en `/algo/otra-cosa`,
 * así que usa rutas absolutas.
 */
export const PAGINAS = {
  'index.html': { id: 'inicio', raiz: '' },
  'guia.html': { id: 'guia', raiz: '' },
  'normas.html': { id: 'normas', raiz: '' },
  'novedades.html': { id: 'novedades', raiz: '' },
  'privacidad.html': { id: 'privacidad', raiz: '' },
  '404.html': { id: null, raiz: '/' }
}

/** Arriba, en la cabecera. El menú del celular suma las preguntas frecuentes. */
const MENU = [
  ['Sistemas', '#sistemas'],
  ['Cómo empezar', '#empezar'],
  ['El país', '#pais'],
  ['Novedades', 'novedades'],
  ['Guía', 'guia'],
  ['Wiki', WIKI],
  ['Normas', 'normas']
]
const MENU_MOVIL = [...MENU.slice(0, 4), ['Preguntas', '#preguntas'], ...MENU.slice(4)]

const PIE = [
  [
    'Jugar',
    [
      ['Descargar el launcher', DESCARGA],
      ['Cómo empezar', '#empezar'],
      ['Guía de instalación', 'guia'],
      ['Requisitos', 'guia#requisitos'],
      ['Preguntas frecuentes', '#preguntas']
    ]
  ],
  [
    'Comunidad',
    [
      ['Discord', DISCORD],
      ['Wiki', WIKI],
      ['Normas', 'normas'],
      ['Novedades', 'novedades'],
      ['Capturas', '#pais']
    ]
  ],
  [
    'Ayuda',
    [
      ['Windows protegió su PC', 'guia#smartscreen'],
      ['El antivirus lo bloquea', 'guia#antivirus'],
      ['Olvidé mi contraseña', 'guia#contrasena'],
      ['El juego se cierra', 'guia#registros'],
      ['No puedo entrar', 'guia#conectar']
    ]
  ]
]

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * El href de un destino visto desde una página. `#x` es una sección de la
 * portada; `guia#x`, una sección de otra página (o de la misma, y entonces
 * queda `#x`, como estaba escrito a mano).
 */
export function enlace(destino, archivo) {
  if (/^https?:/.test(destino)) return destino
  const { id, raiz } = PAGINAS[archivo]
  const [pagina, ancla] = destino.startsWith('#') ? ['', destino.slice(1)] : destino.split('#')
  const propia = pagina === '' ? id === 'inicio' : pagina === id
  if (propia && ancla) return `#${ancla}`
  if (raiz) return `/${pagina}${ancla ? `#${ancla}` : ''}`
  return `${pagina || './'}${ancla ? `#${ancla}` : ''}`
}

const externo = (destino) => (/^https?:/.test(destino) && destino !== DESCARGA ? ' target="_blank" rel="noopener"' : '')
const descarga = (destino) => (destino === DESCARGA ? ' data-descarga' : '')
const icono = (nombre, archivo, clase = 'icono') =>
  `<svg class="${clase}" aria-hidden="true"><use href="${PAGINAS[archivo].raiz}iconos.svg#${nombre}" /></svg>`

function cabecera(archivo) {
  const { id, raiz } = PAGINAS[archivo]
  const actual = (destino) => (destino === id ? ' aria-current="page"' : '')
  const nav = MENU.map(([texto, destino]) => `          <a href="${enlace(destino, archivo)}"${actual(destino)}>${texto}</a>`)
  const movil = MENU_MOVIL.map(
    ([texto, destino], i) =>
      `      <a class="menu-movil__enlace" style="--i: ${i}" href="${enlace(destino, archivo)}"${actual(destino)}>${texto} ${icono('arrow-right', archivo)}</a>`
  )
  return `<header class="cabecera">
      <div class="contenedor cabecera__interior">
        <a class="marca" href="${raiz || './'}" aria-label="Victoria Kingdom, inicio">
          <img src="${raiz}img/logo.png" alt="Victoria Kingdom" width="1013" height="255" />
        </a>
        <nav class="nav" aria-label="Principal">
${nav.join('\n')}
        </nav>
        <div class="cabecera__acciones">
          <div class="en-linea" data-servidor data-estado="cargando" title="Jugadores conectados ahora">
            <span class="punto"></span>
            <span class="en-linea__numero" data-jugadores>—</span>
            <span class="en-linea__texto" data-en-linea-texto>jugadores<br />en línea</span>
          </div>
          <a class="boton boton--principal" href="${DESCARGA}" data-descarga aria-label="Descargar el launcher">
            ${icono('download', archivo)}
            <span>Descargar</span>
          </a>
          <button class="boton-menu" type="button" aria-expanded="false" aria-controls="menu-movil" aria-label="Abrir el menú">
            ${icono('menu', archivo)}
          </button>
        </div>
      </div>
    </header>

    <div class="menu-movil" id="menu-movil" inert>
${movil.join('\n')}
      <div class="menu-movil__acciones">
        <a class="boton boton--principal boton--grande" href="${DESCARGA}" data-descarga>
          ${icono('download', archivo)}Descargar launcher
        </a>
        <a class="boton boton--discord boton--grande" href="${DISCORD}" target="_blank" rel="noopener">
          ${icono('discord', archivo)}Unirse al Discord
        </a>
      </div>
    </div>`
}

/** El pie, el aviso que sale al descargar y el botón de volver arriba. */
function pie(archivo) {
  const { raiz } = PAGINAS[archivo]
  const columnas = PIE.map(
    ([titulo, enlaces]) => `          <div>
            <h4>${titulo}</h4>
            <ul>
${enlaces
  .map(([texto, destino]) => `              <li><a href="${enlace(destino, archivo)}"${externo(destino)}${descarga(destino)}>${texto}</a></li>`)
  .join('\n')}
            </ul>
          </div>`
  )
  return `<footer class="pie">
      <div class="contenedor">
        <div class="pie__grilla">
          <div class="pie__marca">
            <img src="${raiz}img/logo.png" alt="Victoria Kingdom" width="1013" height="255" loading="lazy" />
            <p>Servidor de rol de Minecraft Java 1.20.1, con launcher propio que instala todo solo.</p>
            <div class="pie__redes">
              <a href="${DISCORD}" target="_blank" rel="noopener" aria-label="Discord de Victoria Kingdom">
                ${icono('discord', archivo)}
              </a>
              <a href="${WIKI}" aria-label="Wiki de Victoria Kingdom">
                ${icono('book', archivo)}
              </a>
              <a href="${CODIGO}" target="_blank" rel="noopener" aria-label="Código del launcher en GitHub">
                ${icono('github', archivo)}
              </a>
            </div>
          </div>
${columnas.join('\n')}
        </div>
        <div class="pie__base">
          <span>© <span data-anio>2026</span> Victoria Kingdom</span>
          <span class="pie__legal">
            <a href="${enlace('privacidad', archivo)}">Privacidad</a>
            <a href="${CODIGO}" target="_blank" rel="noopener">Código abierto</a>
          </span>
          <span>No es un producto oficial de Minecraft. No está aprobado por Mojang ni Microsoft ni asociado con ellos.</span>
        </div>
      </div>
    </footer>

    <div class="tostada" role="status" aria-live="polite" data-tostada>
      <span class="tostada__icono">${icono('download', archivo)}</span>
      <div>
        <strong>Bajando el instalador…</strong>
        <p>
          Si aparece «Windows protegió su PC», toca <b>Más información</b> y luego <b>Ejecutar de todas formas</b>.
          <a href="${enlace('guia#smartscreen', archivo)}">Ver cómo</a>
        </p>
      </div>
      <button class="tostada__cerrar" type="button" aria-label="Cerrar el aviso" data-tostada-cerrar>
        ${icono('close', archivo)}
      </button>
    </div>

    <button class="arriba" type="button" aria-label="Volver arriba" data-arriba>
      <svg class="arriba__anillo" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /></svg>
      ${icono('arrow-up', archivo)}
    </button>`
}

/* ---------------------------------------------------------------------------
   Novedades
   --------------------------------------------------------------------------- */

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const MES = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fecha = (iso) => FECHA.format(new Date(`${iso}T12:00:00Z`))
const mes = (iso) => {
  const texto = MES.format(new Date(`${iso}T12:00:00Z`))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Lo mismo que lee el launcher (src/main/lib/novedades.ts): sin un campo
 * obligatorio, o con una fecha que no es AAAA-MM-DD, la novedad no se publica y
 * el script se corta diciendo cuál es.
 */
export function leerNovedades(texto = readFileSync(`${PUBLICO}datos/novedades.json`, 'utf8')) {
  const lista = JSON.parse(texto)
  if (!Array.isArray(lista) || !lista.length) throw new Error('novedades.json tiene que ser una lista con algo adentro')
  const ids = new Set()
  for (const [i, n] of lista.entries()) {
    for (const campo of ['id', 'fecha', 'etiqueta', 'imagen', 'titulo', 'texto']) {
      if (typeof n?.[campo] !== 'string' || !n[campo].trim()) throw new Error(`La novedad ${i + 1} no tiene «${campo}»`)
    }
    if (!/^[a-z0-9-]+$/.test(n.id)) throw new Error(`El id «${n.id}» sólo puede tener minúsculas, números y guiones`)
    if (ids.has(n.id)) throw new Error(`El id «${n.id}» está repetido`)
    ids.add(n.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.fecha) || Number.isNaN(Date.parse(n.fecha))) throw new Error(`«${n.id}»: la fecha va como AAAA-MM-DD`)
    if (n.detalle != null && (!Array.isArray(n.detalle) || n.detalle.some((d) => typeof d !== 'string'))) {
      throw new Error(`«${n.id}»: «detalle» es una lista de textos`)
    }
  }
  // La más nueva primero, aunque en el archivo estén en otro orden.
  return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

const estiloColor = (n) => (n.color ? `; --color: ${esc(n.color)}` : '')

/** Las tarjetas de la portada: llevan a la novedad entera. */
function novedadesPortada(lista, archivo) {
  return lista
    .slice(0, 3)
    .map(
      (n, i) => `<a class="noticia revelar" href="${enlace(`novedades#${n.id}`, archivo)}" style="--retraso: ${i * 110}ms${estiloColor(n)}">
              <div class="noticia__imagen">
                <img src="${esc(n.imagen)}" alt="" loading="lazy" decoding="async" />
                <span class="noticia__etiqueta">${esc(n.etiqueta)}</span>
              </div>
              <div class="noticia__cuerpo">
                <time class="noticia__fecha" datetime="${n.fecha}">${fecha(n.fecha)}</time>
                <h3>${esc(n.titulo)}</h3>
                <p>${esc(n.texto)}</p>
                <span class="enlace-flecha">Leer la novedad ${icono('arrow-right', archivo)}</span>
              </div>
            </a>`
    )
    .join('\n            ')
}

function novedadesLista(lista, archivo) {
  return lista
    .map((n) => {
      const detalle = n.detalle?.length
        ? `\n                <ul class="entrada__detalle">\n${n.detalle.map((d) => `                  <li>${esc(d)}</li>`).join('\n')}\n                </ul>`
        : ''
      const mas = n.enlace
        ? `\n                <a class="enlace-flecha" href="${esc(n.enlace)}"${externo(n.enlace)}>${esc(n.textoEnlace || 'Ver más')} ${icono('arrow-right', archivo)}</a>`
        : ''
      return `<article class="entrada revelar" id="${n.id}" data-etiqueta="${esc(n.etiqueta)}" style="--retraso: 0ms${estiloColor(n)}">
              <div class="entrada__imagen"><img src="${esc(n.imagen)}" alt="" loading="lazy" decoding="async" /></div>
              <div class="entrada__cuerpo">
                <p class="entrada__meta"><span class="entrada__etiqueta">${esc(n.etiqueta)}</span><time datetime="${n.fecha}">${fecha(n.fecha)}</time></p>
                <h2>${esc(n.titulo)}</h2>
                <p class="entrada__texto">${esc(n.texto)}</p>${detalle}${mas}
              </div>
            </article>`
    })
    .join('\n            ')
}

/** El índice de la izquierda, agrupado por mes, como las categorías de la guía. */
function novedadesIndice(lista, archivo) {
  const grupos = new Map()
  for (const n of lista) {
    const clave = n.fecha.slice(0, 7)
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(n)
  }
  return [...grupos.values()]
    .map(
      (ns) => `<div class="wiki__grupo">
            <p class="wiki__grupo-titulo">${mes(ns[0].fecha)}</p>
            <ul>
${ns
  .map(
    (n) =>
      `              <li><a class="wiki__enlace" href="#${n.id}" data-etiqueta="${esc(n.etiqueta)}">${icono('newspaper', archivo)}<span>${esc(n.titulo)}</span></a></li>`
  )
  .join('\n')}
            </ul>
          </div>`
    )
    .join('\n          ')
}

/* ---------------------------------------------------------------------------
   Preguntas frecuentes: el JSON-LD (FAQPage) sale de lo que se ve en la
   portada, así no puede decir algo distinto
   --------------------------------------------------------------------------- */

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
const textoPlano = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTIDADES[e])
    .replace(/\s+/g, ' ')
    .trim()

export function preguntas(html) {
  return [...html.matchAll(/<details class="pregunta[^"]*"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(
    ([, pregunta, respuesta]) => ({ pregunta: textoPlano(pregunta), respuesta: textoPlano(respuesta) })
  )
}

function conPreguntas(html) {
  const lista = preguntas(html)
  return html.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/s, (todo, abre, json, cierra) => {
    const datos = JSON.parse(json)
    const nodo = datos['@graph']?.find((n) => n['@type'] === 'FAQPage')
    if (!nodo) return todo
    nodo.mainEntity = lista.map(({ pregunta, respuesta }) => ({
      '@type': 'Question',
      name: pregunta,
      acceptedAnswer: { '@type': 'Answer', text: respuesta }
    }))
    return abre + JSON.stringify(datos).replace(/</g, '\\u003c') + cierra
  })
}

/* ---------------------------------------------------------------------------
   Escribir las páginas
   --------------------------------------------------------------------------- */

/** Las partes de cada página, ya escritas. */
export function partes(archivo, novedades = leerNovedades()) {
  const p = { cabecera: cabecera(archivo) }
  if (archivo !== '404.html') p.pie = pie(archivo)
  if (archivo === 'index.html') p['novedades-portada'] = novedadesPortada(novedades, archivo)
  if (archivo === 'novedades.html') {
    p['novedades-lista'] = novedadesLista(novedades, archivo)
    p['novedades-indice'] = novedadesIndice(novedades, archivo)
  }
  return p
}

/** La página con sus partes puestas. Falta un marcador → error, no una página a medias. */
export function armar(html, archivo, novedades) {
  let salida = html
  for (const [nombre, contenido] of Object.entries(partes(archivo, novedades))) {
    const patron = new RegExp(`(<!-- comun:${nombre} -->)[\\s\\S]*?(<!-- /comun:${nombre} -->)`)
    if (!patron.test(salida)) throw new Error(`${archivo} no tiene el marcador <!-- comun:${nombre} -->`)
    salida = salida.replace(patron, (_, abre, cierra) => `${abre}\n    ${contenido}\n    ${cierra}`)
  }
  return archivo === 'index.html' ? conPreguntas(salida) : salida
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const novedades = leerNovedades()
  for (const archivo of Object.keys(PAGINAS)) {
    const ruta = PUBLICO + archivo
    const antes = readFileSync(ruta, 'utf8')
    const despues = armar(antes, archivo, novedades)
    if (despues !== antes) writeFileSync(ruta, despues)
    console.log(`${despues === antes ? 'igual  ' : 'escrita'} ${archivo}`)
  }
  console.log(`${novedades.length} novedades; la última, «${novedades[0].titulo}» (${novedades[0].fecha}).`)
}
