#!/usr/bin/env node
/**
 * Prepara las capturas del juego que se muestran en la pantalla de cuenta del
 * launcher y en la web (portada y galería).
 *
 * Las capturas de Minecraft (F2) son PNG de 2-5 MB cada una. Meterlas tal cual
 * engordaría el launcher y la web para nada. Así que se pasan a JPEG:
 *
 * - launcher: 1600 px de ancho en `src/renderer/src/assets/capturas/`. Lo toma
 *   la pantalla sola (`components/ArteCapturas.tsx`, con `import.meta.glob`):
 *   no hay que tocar código para cambiarlas. Si la carpeta queda vacía, se ve el
 *   arte de siempre.
 * - web: 1920 px (visor y portada) y 720 px (miniaturas) en
 *   `web/public/img/capturas/`, más `web/public/datos/capturas.json`, que es la
 *   lista que lee la galería. El pie de cada foto sale del NOMBRE del archivo:
 *   «El palacio.png» se ve como «El palacio». Las que tienen el nombre que les
 *   pone Minecraft (2026-10-07_00.53.23.png) quedan sin pie.
 *
 * Uso:
 *
 *     node scripts/importar-capturas.mjs                 # la carpeta screenshots de la instancia
 *     node scripts/importar-capturas.mjs "D:\mis capturas"
 *     node scripts/importar-capturas.mjs a.png b.png c.png
 *
 * Reemplaza las capturas que hubiera antes. De una carpeta toma como mucho
 * MAX, las más nuevas: conviene armar una carpeta sólo con las que se quieran.
 * El orden es el de la galería y el de la pantalla de cuenta; la primera es
 * además la portada de la web.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import sharp from 'sharp'

const INSTANCIA =
  'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho/screenshots'
const DESTINO = 'src/renderer/src/assets/capturas'
const ANCHO = 1600
const WEB = 'web/public/img/capturas'
const WEB_LISTA = 'web/public/datos/capturas.json'
const WEB_ANCHO = 1920
const WEB_MINIATURA = 720
const MAX = 12
const IMAGEN = /\.(png|jpe?g|webp)$/i
/** El nombre que pone Minecraft a las capturas: no sirve de pie de foto. */
const NOMBRE_DE_MINECRAFT = /^\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.\d{2}(_\d+)?$/

function pieDeFoto(archivo) {
  const nombre = basename(archivo, extname(archivo)).trim()
  return NOMBRE_DE_MINECRAFT.test(nombre) ? '' : nombre
}

function elegirArchivos(args) {
  if (args.length > 1) return args
  const carpeta = args[0] ?? INSTANCIA
  if (!existsSync(carpeta)) {
    console.error(`No existe la carpeta ${carpeta}`)
    process.exit(1)
  }
  if (statSync(carpeta).isFile()) return [carpeta]
  const todas = readdirSync(carpeta)
    .filter((nombre) => IMAGEN.test(nombre))
    .map((nombre) => join(carpeta, nombre))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  if (todas.length > MAX) {
    console.log(`Hay ${todas.length} capturas: se usan las ${MAX} más nuevas.`)
  }
  return todas.slice(0, MAX)
}

const archivos = elegirArchivos(process.argv.slice(2))
if (archivos.length === 0) {
  console.error('No hay imágenes para importar.')
  process.exit(1)
}

for (const carpeta of [DESTINO, WEB]) {
  mkdirSync(carpeta, { recursive: true })
  for (const viejo of readdirSync(carpeta)) {
    if (/^captura-\d+(-chica)?\.jpg$/.test(viejo)) rmSync(join(carpeta, viejo))
  }
}

let antes = 0
let despues = 0
let web = 0
const lista = []
for (const [i, archivo] of archivos.entries()) {
  const nombre = `captura-${String(i + 1).padStart(2, '0')}`
  const salida = join(DESTINO, `${nombre}.jpg`)
  antes += statSync(archivo).size
  await sharp(archivo)
    .resize({ width: ANCHO, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(salida)
  despues += statSync(salida).size

  const grande = join(WEB, `${nombre}.jpg`)
  const chica = join(WEB, `${nombre}-chica.jpg`)
  await sharp(archivo)
    .resize({ width: WEB_ANCHO, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(grande)
  await sharp(archivo)
    .resize({ width: WEB_MINIATURA, withoutEnlargement: true })
    .jpeg({ quality: 74, mozjpeg: true })
    .toFile(chica)
  web += statSync(grande).size + statSync(chica).size
  lista.push({ archivo: nombre, titulo: pieDeFoto(archivo) })
  console.log(`  ${basename(archivo)} -> ${nombre}${lista.at(-1).titulo ? ` «${lista.at(-1).titulo}»` : ''}`)
}
mkdirSync(join(WEB_LISTA, '..'), { recursive: true })
writeFileSync(WEB_LISTA, JSON.stringify(lista, null, 2) + '\n')

const mb = (bytes) => (bytes / 1048576).toFixed(1)
console.log(`${archivos.length} capturas: ${mb(antes)} MB -> ${mb(despues)} MB en ${DESTINO}`)
console.log(`             y ${mb(web)} MB en ${WEB} (lista en ${WEB_LISTA})`)
