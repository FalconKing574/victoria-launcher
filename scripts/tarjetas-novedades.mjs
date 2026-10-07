#!/usr/bin/env node
/**
 * Las imágenes de las tres tarjetas de Novedades: en la pantalla Jugar del
 * launcher y en la portada de la web, que son las mismas.
 *
 * Se recorta una franja ancha del centro de cada captura (las tarjetas son
 * bajitas) y se guarda a 640 px. Pesan unos 40 KB cada una.
 *
 * Uso, en este orden:
 *
 *     node scripts/tarjetas-novedades.mjs servidor.png comunidad.png modpack.png
 */
import { mkdirSync, statSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

const TARJETAS = ['servidor', 'comunidad', 'modpack']
const DESTINOS = ['src/renderer/src/assets/news', 'web/public/img/novedades']

const archivos = process.argv.slice(2)
if (archivos.length !== TARJETAS.length) {
  console.error(`Hacen falta ${TARJETAS.length} capturas, en orden: ${TARJETAS.join(', ')}.`)
  process.exit(1)
}

for (const destino of DESTINOS) mkdirSync(destino, { recursive: true })
for (const [i, tarjeta] of TARJETAS.entries()) {
  const imagen = await sharp(archivos[i])
    .resize({ width: 640, height: 240, fit: 'cover' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()
  for (const destino of DESTINOS) {
    const salida = join(destino, `${tarjeta}.jpg`)
    await sharp(imagen).toFile(salida)
    console.log(`  ${tarjeta}: ${salida} (${Math.round(statSync(salida).size / 1024)} KB)`)
  }
}
