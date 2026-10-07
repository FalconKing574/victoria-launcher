/**
 * Victoria Kingdom — todo lo que se mueve o se carga solo en la web.
 *
 * Sin dependencias ni compilación: Cloudflare Pages sirve este archivo tal
 * cual. Cada parte mira si lo suyo está en la página y, si no, no hace nada, así
 * que el mismo archivo sirve para la portada, la guía y las normas.
 *
 * Con «reducir movimiento» activado en el sistema no hay presentación ni
 * contadores: todo aparece quieto y en su lugar.
 *
 * Lo que se mueve sin parar está hecho con `transform` u `opacity`, que el
 * navegador anima sin recalcular la página. Hubo chispas en un canvas, grano de
 * película, paralaje con el mouse y un brillo que seguía al cursor: se sacaron
 * porque gastaban procesador todo el tiempo (ver docs/mantenimiento/06-web.md).
 */
;(() => {
  'use strict'

  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
  const $ = (selector, raiz = document) => raiz.querySelector(selector)
  const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)]
  const numero = new Intl.NumberFormat('es')

  /** JSON o `null`: un dato que no llega nunca rompe la página. */
  async function pedir(url) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } })
      return r.ok ? await r.json() : null
    } catch {
      return null
    }
  }

  /** La lista que deja `scripts/importar-capturas.mjs`. Se pide una sola vez. */
  let capturasPedidas
  function capturas() {
    capturasPedidas ??= pedir('datos/capturas.json').then((lista) =>
      Array.isArray(lista) ? lista.filter((c) => c && typeof c.archivo === 'string') : []
    )
    return capturasPedidas
  }

  const urlCaptura = (c, chica) => `img/capturas/${c.archivo}${chica ? '-chica' : ''}.jpg`

  /* -----------------------------------------------------------------------
     Aparición al hacer scroll
     ----------------------------------------------------------------------- */

  let observadorRevelar = null

  function observarRevelar(el) {
    if (observadorRevelar) observadorRevelar.observe(el)
    else el.classList.add('visto')
  }

  function revelar() {
    if (!reducido && 'IntersectionObserver' in window) {
      observadorRevelar = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue
            e.target.classList.add('visto')
            observadorRevelar.unobserve(e.target)
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
      )
    }
    $$('.revelar').forEach(observarRevelar)
  }

  /* -----------------------------------------------------------------------
     Números que cuentan hasta su valor
     ----------------------------------------------------------------------- */

  function animarNumero(el, hasta, desde = 0) {
    if (reducido || hasta === desde) {
      el.textContent = numero.format(hasta)
      return
    }
    const inicio = performance.now()
    const duracion = 1500
    const cuadro = (ahora) => {
      const k = Math.min(1, (ahora - inicio) / duracion)
      const suave = 1 - Math.pow(1 - k, 4)
      el.textContent = numero.format(Math.round(desde + (hasta - desde) * suave))
      if (k < 1) requestAnimationFrame(cuadro)
    }
    requestAnimationFrame(cuadro)
  }

  /**
   * Los `data-contar` esperan a verse para contar desde cero; los demás (la
   * cabecera, la tarjeta del servidor) cuentan apenas llega el dato.
   */
  let observadorContar = null

  function prepararContadores() {
    for (const el of $$('[data-jugadores], [data-maximo], [data-mods]')) {
      const fijo = Number(el.textContent.replace(/\D/g, ''))
      if (el.textContent.trim() !== '—' && Number.isFinite(fijo)) el.dataset.objetivo = String(fijo)
    }
    const contables = $$('[data-contar]')
    if (reducido || !('IntersectionObserver' in window)) {
      contables.forEach((el) => (el.dataset.visto = '1'))
      return
    }
    observadorContar = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue
          observadorContar.unobserve(e.target)
          e.target.dataset.visto = '1'
          const objetivo = e.target.dataset.objetivo
          if (objetivo != null) animarNumero(e.target, Number(objetivo), 0)
        }
      },
      { threshold: 0.6 }
    )
    contables.forEach((el) => observadorContar.observe(el))
  }

  function ponerNumero(el, valor) {
    if (valor == null || !Number.isFinite(valor)) {
      el.textContent = '—'
      delete el.dataset.objetivo
      return
    }
    const antes = el.dataset.objetivo != null ? Number(el.dataset.objetivo) : 0
    el.dataset.objetivo = String(valor)
    // Todavía no se vio: lo anima el observador cuando aparezca.
    if (el.hasAttribute('data-contar') && !el.dataset.visto) return
    animarNumero(el, valor, antes)
  }

  /* -----------------------------------------------------------------------
     Estado del servidor y datos del modpack
     ----------------------------------------------------------------------- */

  async function estadoServidor() {
    if (!$('[data-servidor], [data-jugadores]')) return
    const e = await pedir('/api/estado')
    const arriba = Boolean(e && e.enLinea)
    const estado = !e ? 'desconocido' : arriba ? 'arriba' : 'abajo'

    for (const z of $$('[data-servidor]')) z.dataset.estado = estado
    for (const el of $$('[data-jugadores]')) ponerNumero(el, arriba ? e.jugadores ?? 0 : null)
    for (const el of $$('[data-maximo]')) ponerNumero(el, arriba ? e.maximo : null)
    for (const el of $$('[data-estado-texto]')) {
      el.textContent = arriba ? 'En línea' : estado === 'abajo' ? 'No responde' : 'Sin datos'
    }
    for (const el of $$('[data-en-linea-texto]')) {
      el.innerHTML = estado === 'abajo' ? 'servidor<br />sin respuesta' : 'jugadores<br />en línea'
    }
  }

  async function modpack() {
    if (!$('[data-mods], [data-forge], [data-minecraft]')) return
    const m = await pedir('/api/modpack')
    // Sin datos quedan los que vienen escritos en el HTML.
    if (!m || m.error) return
    if (Number.isFinite(m.mods)) for (const el of $$('[data-mods]')) ponerNumero(el, m.mods)
    if (m.forge) for (const el of $$('[data-forge]')) el.textContent = m.forge
    if (m.minecraft) for (const el of $$('[data-minecraft]')) el.textContent = m.minecraft
  }

  /* -----------------------------------------------------------------------
     Cabecera, menú del celular y volver arriba
     ----------------------------------------------------------------------- */

  function cabecera() {
    const c = $('.cabecera')
    if (!c) return
    const actualizar = () => c.classList.toggle('con-fondo', scrollY > 24)
    actualizar()
    addEventListener('scroll', actualizar, { passive: true })
  }

  function menu() {
    const boton = $('.boton-menu')
    const panel = $('#menu-movil')
    if (!boton || !panel) return
    const usar = (abrir) => {
      panel.classList.toggle('abierto', abrir)
      panel.inert = !abrir
      boton.setAttribute('aria-expanded', String(abrir))
      boton.setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Abrir el menú')
      $('use', boton).setAttribute('href', `iconos.svg#${abrir ? 'close' : 'menu'}`)
      document.body.classList.toggle('sin-scroll', abrir)
    }
    boton.addEventListener('click', () => usar(!panel.classList.contains('abierto')))
    panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) usar(false)
    })
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('abierto')) {
        usar(false)
        boton.focus()
      }
    })
    matchMedia('(min-width: 1101px)').addEventListener('change', (m) => {
      if (m.matches) usar(false)
    })
  }

  /** Todo lo que depende de la posición del scroll, en un solo cuadro. */
  function alDesplazar() {
    const pasos = $('[data-pasos]')
    const listaPasos = pasos ? $$('.paso', pasos) : []
    const arriba = $('[data-arriba]')
    let pendiente = false

    const actualizar = () => {
      pendiente = false
      const alto = innerHeight
      if (pasos) {
        const r = pasos.getBoundingClientRect()
        const avance = Math.min(1, Math.max(0, (alto * 0.6 - r.top) / r.height))
        pasos.style.setProperty('--avance', avance.toFixed(4))
        for (const p of listaPasos) {
          const marca = $('.paso__numero', p).getBoundingClientRect()
          p.classList.toggle('alcanzado', marca.height > 0 && marca.top + marca.height / 2 < alto * 0.6)
        }
      }
      if (arriba) {
        const max = document.documentElement.scrollHeight - alto
        arriba.style.setProperty('--progreso', (max > 0 ? scrollY / max : 0).toFixed(4))
        arriba.classList.toggle('visible', scrollY > alto * 0.9)
      }
    }
    const pedirCuadro = () => {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(actualizar)
    }
    addEventListener('scroll', pedirCuadro, { passive: true })
    addEventListener('resize', pedirCuadro)
    actualizar()
    arriba?.addEventListener('click', () => scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' }))
  }

  /* -----------------------------------------------------------------------
     Portada: presentación de capturas
     ----------------------------------------------------------------------- */

  async function portada() {
    const raiz = $('[data-portada]')
    if (!raiz) return
    const capa = $('[data-portada-fotos]', raiz)
    const barras = $('[data-portada-barras]', raiz)
    const pie = $('[data-portada-pie]', raiz)
    // Las cuatro primeras de la lista: el orden lo decide importar-capturas.
    const lista = (await capturas()).slice(0, 4)
    if (pie && lista[0]) pie.textContent = lista[0].titulo || 'Victoria Kingdom'
    if (lista.length < 2 || reducido) {
      barras?.remove()
      return
    }

    const DURACION = 7000
    const fotos = [capa.firstElementChild]
    for (let i = 1; i < lista.length; i++) {
      const f = document.createElement('div')
      f.className = 'portada__foto'
      capa.append(f)
      fotos.push(f)
    }
    barras.style.setProperty('--duracion', `${DURACION}ms`)
    const botones = lista.map((c, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'indicadores__barra'
      b.setAttribute('aria-label', `Fondo: ${c.titulo || `captura ${i + 1}`}`)
      b.addEventListener('click', () => ir(i))
      barras.append(b)
      return b
    })

    let actual = 0
    let temporizador
    let visible = true

    const cargar = (i) => {
      const f = fotos[i]
      if (f.dataset.cargada) return
      f.dataset.cargada = '1'
      f.style.backgroundImage = `url('${urlCaptura(lista[i])}')`
    }

    const marcar = () => {
      botones.forEach((b, i) => {
        b.classList.toggle('vista', i < actual)
        b.classList.remove('activa')
      })
      void botones[actual].offsetWidth
      botones[actual].classList.add('activa')
      if (pie) {
        pie.parentElement.style.opacity = '0'
        setTimeout(() => {
          pie.textContent = lista[actual].titulo || 'Victoria Kingdom'
          pie.parentElement.style.opacity = '1'
        }, 300)
      }
    }

    const programar = () => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        if (visible && !document.hidden) ir((actual + 1) % fotos.length)
        else programar()
      }, DURACION)
    }

    function ir(i) {
      if (i === actual) return
      const antes = fotos[actual]
      antes.classList.remove('activa')
      antes.classList.add('saliendo')
      setTimeout(() => antes.classList.remove('saliendo'), 2000)
      actual = i
      const f = fotos[i]
      cargar(i)
      f.classList.remove('saliendo')
      void f.offsetWidth
      f.classList.add('activa')
      cargar((i + 1) % fotos.length)
      marcar()
      programar()
    }

    fotos[0].dataset.cargada = '1'
    cargar(1)
    marcar()
    programar()
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(raiz)
  }

  /* -----------------------------------------------------------------------
     Galería, «video» y visor
     ----------------------------------------------------------------------- */

  /** Qué forma tiene cada casilla de la galería, en una grilla de 4 columnas. */
  const FORMAS = ['grande', '', '', '', '', 'ancha', '', '', 'ancha', 'ancha']

  function crearVisor(lista) {
    const visor = $('#visor')
    if (!visor || !lista.length) return () => {}
    const imagen = $('[data-visor-imagen]', visor)
    const titulo = $('[data-visor-titulo]', visor)
    const contador = $('[data-visor-contador]', visor)
    const tira = $('[data-visor-tira]', visor)
    const cerrarBoton = $('[data-visor-cerrar]', visor)
    const fondo = [$('main'), $('.cabecera'), $('.pie')].filter(Boolean)
    let actual = 0
    let abierto = false
    let focoAnterior = null

    tira.textContent = ''
    const miniaturas = lista.map((c, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('aria-label', c.titulo || `Captura ${i + 1}`)
      const img = document.createElement('img')
      img.src = urlCaptura(c, true)
      img.alt = ''
      img.loading = 'lazy'
      b.append(img)
      b.addEventListener('click', () => mostrar(i))
      tira.append(b)
      return b
    })

    function mostrar(i) {
      actual = (i + lista.length) % lista.length
      const c = lista[actual]
      imagen.classList.remove('lista')
      const nueva = new Image()
      nueva.src = urlCaptura(c)
      const poner = () => {
        if (lista[actual] !== c) return
        imagen.src = nueva.src
        imagen.alt = c.titulo || 'Captura del servidor'
        requestAnimationFrame(() => imagen.classList.add('lista'))
      }
      nueva.decode ? nueva.decode().then(poner, poner) : (nueva.onload = poner)
      titulo.textContent = c.titulo || 'Victoria Kingdom'
      const dos = (n) => String(n).padStart(2, '0')
      contador.textContent = `${dos(actual + 1)} / ${dos(lista.length)}`
      miniaturas.forEach((m, j) => m.classList.toggle('activa', j === actual))
      const m = miniaturas[actual]
      tira.scrollTo({ left: m.offsetLeft - tira.clientWidth / 2 + m.clientWidth / 2, behavior: reducido ? 'auto' : 'smooth' })
      new Image().src = urlCaptura(lista[(actual + 1) % lista.length])
    }

    function abrir(i) {
      focoAnterior = document.activeElement
      visor.inert = false
      fondo.forEach((el) => (el.inert = true))
      visor.classList.add('abierto')
      document.body.classList.add('sin-scroll')
      abierto = true
      mostrar(i)
      cerrarBoton.focus()
    }

    function cerrar() {
      visor.classList.remove('abierto')
      visor.inert = true
      fondo.forEach((el) => (el.inert = false))
      document.body.classList.remove('sin-scroll')
      abierto = false
      focoAnterior?.focus?.()
    }

    cerrarBoton.addEventListener('click', cerrar)
    $('[data-visor-antes]', visor).addEventListener('click', () => mostrar(actual - 1))
    $('[data-visor-despues]', visor).addEventListener('click', () => mostrar(actual + 1))
    visor.addEventListener('click', (e) => {
      if (e.target === visor || e.target.classList.contains('visor__escena')) cerrar()
    })
    addEventListener('keydown', (e) => {
      if (!abierto) return
      if (e.key === 'Escape') cerrar()
      else if (e.key === 'ArrowLeft') mostrar(actual - 1)
      else if (e.key === 'ArrowRight') mostrar(actual + 1)
    })
    // Deslizar con el dedo en el celular.
    let x0 = null
    visor.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true })
    visor.addEventListener('touchend', (e) => {
      if (x0 == null) return
      const dx = e.changedTouches[0].clientX - x0
      if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1))
      x0 = null
    })
    return abrir
  }

  async function galeria() {
    const contenedor = $('[data-galeria]')
    const video = $('.video')
    if (!contenedor && !video) return
    const lista = await capturas()
    if (!lista.length) return
    const abrirVisor = crearVisor(lista)

    if (contenedor) {
      contenedor.textContent = ''
      lista.forEach((c, i) => {
        const forma = FORMAS[i] || ''
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `galeria__item revelar revelar--escala${forma ? ` galeria__item--${forma}` : ''}`
        b.style.setProperty('--retraso', `${(i % 4) * 80}ms`)
        b.setAttribute('aria-label', `Ver en grande: ${c.titulo || `captura ${i + 1}`}`)
        const img = document.createElement('img')
        img.src = urlCaptura(c, true)
        img.srcset = `${urlCaptura(c, true)} 720w, ${urlCaptura(c)} 1920w`
        img.sizes = forma === 'grande' ? '(max-width: 900px) 100vw, 50vw' : '(max-width: 900px) 50vw, 25vw'
        img.alt = ''
        img.loading = 'lazy'
        img.decoding = 'async'
        const pie = document.createElement('span')
        pie.className = 'galeria__pie'
        const texto = document.createElement('span')
        texto.textContent = c.titulo || ''
        pie.append(texto)
        pie.insertAdjacentHTML(
          'beforeend',
          '<span class="galeria__lupa" aria-hidden="true"><svg class="icono"><use href="iconos.svg#expand"/></svg></span>'
        )
        b.append(img, pie)
        b.addEventListener('click', () => abrirVisor(i))
        contenedor.append(b)
        observarRevelar(b)
      })
    }

    if (video) {
      const total = $('[data-total-capturas]', video)
      if (total) total.textContent = `${lista.length} capturas del servidor`
      // Empieza por la quinta para no repetir la portada.
      const orden = [...lista.keys()]
      if (orden.length > 5) orden.push(...orden.splice(0, 4))
      const fotos = [$('[data-video-foto]', video)]
      fotos[0].style.backgroundImage = `url('${urlCaptura(lista[orden[0]])}')`
      let k = 0
      video.addEventListener('click', () => abrirVisor(orden[k]))
      if (reducido || orden.length < 2) return
      let visible = false
      new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(video)
      setInterval(() => {
        if (!visible || document.hidden) return
        const antes = fotos[k % fotos.length]
        k = (k + 1) % orden.length
        let f = fotos[k]
        if (!f) {
          f = document.createElement('span')
          f.className = 'video__foto'
          f.style.backgroundImage = `url('${urlCaptura(lista[orden[k]])}')`
          antes.after(f)
          fotos[k] = f
        }
        antes.classList.remove('activa')
        antes.classList.add('saliendo')
        setTimeout(() => antes.classList.remove('saliendo'), 1600)
        f.classList.remove('saliendo')
        void f.offsetWidth
        f.classList.add('activa')
      }, 4500)
    }
  }

  /* -----------------------------------------------------------------------
     Novedades
     ----------------------------------------------------------------------- */

  async function novedades() {
    const contenedor = $('[data-noticias]')
    if (!contenedor) return
    const lista = await pedir('datos/novedades.json')
    if (!Array.isArray(lista)) return
    contenedor.textContent = ''
    lista.forEach((n, i) => {
      const externo = /^https?:/.test(n.enlace || '')
      const tarjeta = document.createElement(n.enlace ? 'a' : 'article')
      if (n.enlace) {
        tarjeta.href = n.enlace
        if (externo) {
          tarjeta.target = '_blank'
          tarjeta.rel = 'noopener'
        }
      }
      tarjeta.className = 'noticia revelar'
      tarjeta.style.setProperty('--retraso', `${i * 110}ms`)
      if (n.color) tarjeta.style.setProperty('--color', n.color)
      tarjeta.innerHTML =
        '<div class="noticia__imagen"><img alt="" loading="lazy" decoding="async" /><span class="noticia__etiqueta"></span></div>' +
        '<div class="noticia__cuerpo"><h3></h3><p></p></div>'
      $('img', tarjeta).src = n.imagen
      $('.noticia__etiqueta', tarjeta).textContent = n.etiqueta || ''
      $('h3', tarjeta).textContent = n.titulo || ''
      $('p', tarjeta).textContent = n.texto || ''
      if (n.enlace) {
        const mas = document.createElement('span')
        mas.className = 'enlace-flecha'
        mas.textContent = n.textoEnlace || 'Ver más'
        mas.insertAdjacentHTML('beforeend', ' <svg class="icono" aria-hidden="true"><use href="iconos.svg#arrow-right"/></svg>')
        $('.noticia__cuerpo', tarjeta).append(mas)
      }
      contenedor.append(tarjeta)
      observarRevelar(tarjeta)
    })
  }

  /* -----------------------------------------------------------------------
     Guía y normas: índice que sigue la lectura
     ----------------------------------------------------------------------- */

  function espiar() {
    const enlaces = $$('.wiki__enlace[href^="#"]')
    if (!enlaces.length || !('IntersectionObserver' in window)) return
    const porId = new Map(enlaces.map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]))
    const secciones = [...porId.keys()].map((id) => document.getElementById(id)).filter(Boolean)
    const visibles = new Set()
    const marcar = (a) => {
      enlaces.forEach((x) => x.classList.toggle('activo', x === a))
      const lateral = a.closest('.wiki__lateral')
      if (!lateral) return
      const r = a.getBoundingClientRect()
      const l = lateral.getBoundingClientRect()
      if (r.left < l.left || r.right > l.right) lateral.scrollLeft += r.left - l.left - 16
      if (r.top < l.top || r.bottom > l.bottom) lateral.scrollTop += r.top - l.top - 16
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)
        const primera = secciones.find((s) => visibles.has(s))
        if (primera) marcar(porId.get(primera.id))
      },
      { rootMargin: '-110px 0px -55% 0px' }
    )
    secciones.forEach((s) => observador.observe(s))
    // Arriba de todo todavía no se ve ninguna sección: se marca la primera.
    if (!enlaces.some((a) => a.classList.contains('activo'))) marcar(enlaces[0])
  }

  async function normas() {
    const contenedor = $('[data-normas]')
    if (!contenedor) return
    const indice = $('[data-normas-indice]')
    const n = await pedir('/api/normas')
    if (!n || !Array.isArray(n.secciones) || !n.secciones.length) {
      contenedor.innerHTML =
        '<div class="nota nota--aviso"><svg class="icono" aria-hidden="true"><use href="iconos.svg#warning"/></svg>' +
        '<div><p><strong>No se pudieron cargar las normas ahora.</strong></p>' +
        '<p>Prueba de nuevo en un rato. También las ves en el launcher antes de jugar, y en el Discord.</p></div></div>'
      return
    }
    for (const el of $$('[data-normas-titulo]')) el.textContent = n.titulo || 'Normas de Victoria'
    for (const el of $$('[data-normas-version]')) el.textContent = n.version ? `Versión ${n.version}` : '—'
    for (const el of $$('[data-normas-cantidad]')) el.textContent = String(n.secciones.length)
    contenedor.textContent = ''
    n.secciones.forEach((s, i) => {
      const id = `norma-${i + 1}`
      const seccion = document.createElement('section')
      seccion.className = 'norma revelar'
      seccion.id = id
      seccion.innerHTML = `<span class="norma__numero" aria-hidden="true">${i + 1}</span><div><h2></h2></div>`
      $('h2', seccion).textContent = s.titulo || `Norma ${i + 1}`
      const cuerpo = $('div', seccion)
      for (const parrafo of String(s.texto || '').split(/\n+/)) {
        if (!parrafo.trim()) continue
        const p = document.createElement('p')
        p.textContent = parrafo.trim()
        cuerpo.append(p)
      }
      contenedor.append(seccion)
      observarRevelar(seccion)
      if (indice) {
        const li = document.createElement('li')
        li.innerHTML = `<a class="wiki__enlace" href="#${id}"><svg class="icono" aria-hidden="true"><use href="iconos.svg#book"/></svg><span></span></a>`
        $('span', li).textContent = s.titulo || `Norma ${i + 1}`
        indice.append(li)
      }
    })
    espiar()
  }

  /* -----------------------------------------------------------------------
     El aviso al descargar
     ----------------------------------------------------------------------- */

  function avisoDescarga() {
    const tostada = $('[data-tostada]')
    if (!tostada) return
    if (!/Windows/i.test(navigator.userAgent)) {
      $('strong', tostada).textContent = 'El launcher es para Windows'
      $('p', tostada).innerHTML =
        'Ábrelo en una PC con Windows 10 u 11. Si ya estás en una, mira <a href="guia#instalar">cómo instalarlo</a>.'
    }
    let temporizador
    const cerrar = () => {
      tostada.classList.remove('visible')
      clearTimeout(temporizador)
    }
    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-descarga]')) return
      tostada.classList.add('visible')
      clearTimeout(temporizador)
      temporizador = setTimeout(cerrar, 15000)
    })
    $('[data-tostada-cerrar]', tostada)?.addEventListener('click', cerrar)
  }

  /* ----------------------------------------------------------------------- */

  function iniciar() {
    for (const el of $$('[data-anio]')) el.textContent = String(new Date().getFullYear())
    cabecera()
    menu()
    prepararContadores()
    revelar()
    alDesplazar()
    avisoDescarga()
    espiar()

    estadoServidor()
    setInterval(() => {
      if (!document.hidden) estadoServidor()
    }, 60000)
    modpack()
    portada()
    galeria()
    novedades()
    normas()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
