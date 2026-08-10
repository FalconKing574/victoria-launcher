/**
 * Serves the built renderer with a fake `window.api`, so the UI can be looked at
 * without launching the Electron app.
 *
 * The launcher is a desktop app the user runs themselves; opening it to check a
 * layout takes over their screen. This serves out/renderer over http instead and
 * answers every IPC call with plausible data, which is enough to see every
 * screen. It is a development tool and is not part of the build.
 *
 *   npm run build && node scripts/preview-renderer.mjs
 *
 * Miralo en una pestaña VISIBLE. Si la pestaña está oculta o en segundo plano,
 * el navegador congela requestAnimationFrame y limita los temporizadores a ~1/s;
 * framer-motion no termina la animación de salida del splash, AnimatePresence
 * no monta la app y se queda en el logo para siempre. No es un fallo del
 * launcher y no se puede sortear desde aquí: hay que tener la pestaña delante.
 *
 * Los datos del stub están copiados del manifiesto vivo a propósito, URLs de
 * imagen rotas incluidas: si la vista previa enseña algo mejor de lo que ve un
 * jugador, no sirve para comprobar nada.
 */
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { dirname, extname, join, normalize, resolve } from 'path'
import { fileURLToPath } from 'url'

// Resolved from this file, not the working directory: the preview is launched
// from wherever the editor happens to be, and a relative path silently 404s.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'renderer')
const PORT = Number(process.env.PORT ?? 4310)

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No hay build en ${ROOT}. Ejecuta "npm run build" primero.`)
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2'
}

/** Every channel the preload exposes, answered with something believable. */
const STUB = `<script>
  // En una pestaña que no está delante, Chrome congela requestAnimationFrame.
  // framer-motion se queda a medias, AnimatePresence nunca termina la salida
  // del splash y la vista previa se queda en el logo. Un temporizador de
  // respaldo la desatasca. Los temporizadores tambien van limitados a ~1/s en
  // segundo plano, asi que 1200ms es el valor que de verdad se cumple.
  const rafNativo = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => {
    let hecho = false
    const lanzar = (t) => { if (!hecho) { hecho = true; cb(t === undefined ? performance.now() : t) } }
    const id = rafNativo(lanzar)
    setTimeout(lanzar, 1200)
    return id
  }

  const noop = () => () => {}
  const enabledOptional = new Set(['distant-horizons', 'xaeros-world-map'])
  const settings = {
    maxMemoryMb: 8192, minMemoryMb: 2048, javaPath: null,
    musicEnabled: false, closeOnLaunch: false, optimizedJvm: true,
    offlineUsername: 'Aldeano'
  }
  const manifest = {
    packVersion: '1.4.0', minecraft: '1.20.1', forge: '47.4.0',
    mods: Array.from({ length: 117 }, (_, i) => ({ filename: 'mod' + i + '.jar', sizeBytes: 3.6e6 })),
    // Copiado del manifiesto vivo, incluidas las URLs de imagen rotas que
    // publica hoy: si la vista previa las arregla y el launcher real no, la
    // vista previa no sirve para nada.
    optional: [
      { id: 'distant-horizons', name: 'Distant Horizons', category: 'visual', filename: 'DistantHorizons-3.2.0-b-1.20.1-fabric-forge.jar', sizeBytes: 29561297, image: 'https://media.forgecdn.net/avatars/thumbnails/508/677/64/64/637868261444007926.png', summary: 'Renderiza el terreno lejano en baja resolución, así que ves muchísimo más lejos sin hundir los FPS. Viene activado.' },
      { id: 'xaeros-world-map', name: "Xaero's World Map", category: 'calidad-de-vida', filename: 'xaeroworldmap-forge-1.20.1-1.44.2.jar', sizeBytes: 1421224, image: 'https://media.forgecdn.net/avatars/thumbnails/168/651/64/64/636588047698795323.png', summary: 'Mapa completo del mundo que se va rellenando por donde pasas, con marcadores y puntos de interes. Viene activado.' },
      { id: 'forgematica', name: 'Forgematica', category: 'calidad-de-vida', filename: 'Forgematica-0.1.13-mc1.20.1.jar', sizeBytes: 997501, image: 'https://media.forgecdn.net/avatars/thumbnails/1053/44/64/64/638600313224615916.png', summary: 'Carga esquemas y te los proyecta como un plano fantasma para construirlos bloque a bloque. Util para construir, innecesario si solo juegas.' }
    ]
  }
  window.api = {
    window: { minimize: noop, maximize: noop, close: noop, openExternal: async () => {} },
    auth: {
      microsoftLogin: async () => { throw new Error('Vista previa: no hay login real.') },
      microsoftRestore: async () => null,
      microsoftLogout: async () => true
    },
    mods: { list: async () => manifest.mods.map((m) => ({ ...m, name: m.filename, enabled: true })), toggle: async () => [] },
    modpack: {
      sync: async () => ({ upToDate: true, downloaded: 0, removed: 0, keptOwn: [], packVersion: '1.4.0' }),
      check: async () => ({ needsUpdate: false, unavailable: false, toDownload: 0, toRemove: 0, installedVersion: '1.4.0', latestVersion: '1.4.0' }),
      manifest: async () => manifest,
      state: async () => ({ managed: [], enabledOptional: [...enabledOptional], packVersion: '1.4.0', overridesSha1: null, overrideParts: {} }),
      setOptional: async (id, on) => {
        if (on) enabledOptional.add(id)
        else enabledOptional.delete(id)
        return { managed: [], enabledOptional: [...enabledOptional], packVersion: '1.4.0', overridesSha1: null, overrideParts: {} }
      },
      live: async () => ({ running: false, percent: 0, done: 0, total: 0, message: null }),
      onStatus: noop, onProgress: noop, onDone: noop, onError: noop
    },
    // Copiado de la instancia real: Oculus apagado, los dos shaderpacks que hay
    // en disco, y BSL en la lista de quitados SIN papelera (lo borró la versión
    // vieja) — que es justo el caso que hay que poder ver.
    shaders: (() => {
      const packs = [
        { filename: 'ComplementaryReimagined_r5.8.1.zip', name: 'Complementary Reimagined r5.8.1', sizeBytes: 546925 },
        { filename: 'Solas Shader V3.7.zip', name: 'Solas Shader V3.7', sizeBytes: 1241525 }
      ]
      const state = {
        enabled: false,
        selected: 'ComplementaryReimagined_r5.8.1.zip',
        installed: true,
        packs: [...packs],
        removed: [
          // El caso heredado: lo borró la versión vieja, ya no hay archivo.
          { filename: 'BSL_v8.4.zip', name: 'BSL v8.4', sizeBytes: 0, restorable: false },
          // El caso normal a partir de ahora: está en la papelera y vuelve.
          { filename: 'Sildurs Vibrant Shaders.zip', name: 'Sildurs Vibrant Shaders', sizeBytes: 3120044, restorable: true }
        ]
      }
      const snap = () => JSON.parse(JSON.stringify(state))
      return {
        get: async () => snap(),
        setEnabled: async (on) => { state.enabled = on; return snap() },
        select: async (f) => { state.selected = f; return snap() },
        deselect: async () => { state.selected = null; return snap() },
        delete: async (f) => {
          const i = state.packs.findIndex((p) => p.filename === f)
          if (i >= 0) state.removed.push({ ...state.packs.splice(i, 1)[0], restorable: true })
          return snap()
        },
        restore: async (f) => {
          const i = state.removed.findIndex((p) => p.filename === f)
          let recuperado = false
          if (i >= 0) {
            const [p] = state.removed.splice(i, 1)
            // El caso sin copia guardada se baja del pack; aqui se simula que
            // sale bien, que es lo que hace el launcher de verdad.
            state.packs.push({ filename: p.filename, name: p.name, sizeBytes: p.sizeBytes || 1105442 })
            recuperado = true
          }
          return { ...snap(), recuperado }
        }
      }
    })(),
    updater: {
      check: async () => ({ phase: 'none', version: '1.3.1', percent: 0, message: null }),
      state: async () => ({ phase: 'none', version: '1.3.1', percent: 0, message: null }),
      install: async () => false, onState: noop
    },
    settings: { get: async () => settings, save: async (p) => Object.assign(settings, p) },
    launch: {
      start: async () => {}, isRunning: async () => false,
      onProgress: noop, onStatus: noop, onError: noop, onClosed: noop
    }
  }
</script>`

createServer((request, response) => {
  const path = (request.url ?? '/').split('?')[0]
  const relative = normalize(path === '/' ? 'index.html' : path.slice(1)).replace(/^(\.\.[/\\])+/, '')
  const file = join(ROOT, relative)

  if (!existsSync(file)) {
    response.writeHead(404).end('not found')
    return
  }

  if (relative === 'index.html') {
    const html = readFileSync(file, 'utf8').replace('</head>', `${STUB}</head>`)
    response.writeHead(200, { 'content-type': TYPES['.html'] }).end(html)
    return
  }

  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  response.end(readFileSync(file))
}).listen(PORT, () => console.log(`Vista previa del renderer en http://localhost:${PORT}`))
