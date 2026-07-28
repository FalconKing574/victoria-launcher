import { mkdirSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

mkdirSync('build', { recursive: true })

// app-icon.png is already square pixel art, so 'cover' keeps it crisp edge to edge.
const square = await sharp('src/renderer/src/assets/app-icon.png')
  .resize(256, 256, { fit: 'cover', kernel: 'nearest' })
  .png()
  .toBuffer()

writeFileSync('build/icon.ico', await pngToIco([square]))
console.log('build/icon.ico written.')
