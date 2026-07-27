import { mkdirSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

mkdirSync('build', { recursive: true })

// The logo is a wide banner; pad it into a square canvas so it is not distorted.
const square = await sharp('src/renderer/src/assets/logo.png')
  .resize(256, 256, { fit: 'contain', background: { r: 11, g: 11, b: 16, alpha: 1 } })
  .png()
  .toBuffer()

writeFileSync('build/icon.ico', await pngToIco([square]))
console.log('build/icon.ico written.')
