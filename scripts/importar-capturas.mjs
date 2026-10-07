#!/usr/bin/env node
/**
 * Prepara las capturas del juego que se muestran en la pantalla de cuenta.
 *
 * Las capturas de Minecraft (F2) son PNG de 2-5 MB cada una. Meterlas tal cual
 * engordaría el launcher para nada: se ven de fondo, a lo sumo a pantalla
 * completa. Así que se pasan a JPEG de 1600 px de ancho, ~250 KB cada una.
 *
 * Lo que queda en `src/renderer/src/assets/capturas/` lo toma la pantalla sola
 * (`components/ArteCapturas.tsx`, con `import.meta.glob`): no hay que tocar
 * código para cambiarlas. Si la carpeta queda vacía, se ve el arte de siempre.
 *
 * Uso:
 *
 *     node scripts/importar-capturas.mjs                 # la carpeta screenshots de la instancia
 *     node scripts/importar-capturas.mjs "D:\mis capturas"
 *     node scripts/importar-capturas.mjs a.png b.png c.png
 *
 * Reemplaza las capturas que hubiera antes. De una carpeta toma como mucho
 * MAX, las más nuevas: conviene armar una carpeta sólo con las que se quieran.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { basename, join } from 'path'
import sharp from 'sharp'

const INSTANCIA =
  'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho/screenshots'
const DESTINO = 'src/renderer/src/assets/capturas'
const ANCHO = 1600
const MAX = 12
const IMAGEN = /\.(png|jpe?g|webp)$/i

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

mkdirSync(DESTINO, { recursive: true })
for (const viejo of readdirSync(DESTINO)) {
  if (/^captura-\d+\.jpg$/.test(viejo)) rmSync(join(DESTINO, viejo))
}

let antes = 0
let despues = 0
for (const [i, archivo] of archivos.entries()) {
  const salida = join(DESTINO, `captura-${String(i + 1).padStart(2, '0')}.jpg`)
  antes += statSync(archivo).size
  await sharp(archivo)
    .resize({ width: ANCHO, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(salida)
  despues += statSync(salida).size
  console.log(`  ${basename(archivo)} -> ${basename(salida)}`)
}

const mb = (bytes) => (bytes / 1048576).toFixed(1)
console.log(`${archivos.length} capturas: ${mb(antes)} MB -> ${mb(despues)} MB en ${DESTINO}`)
