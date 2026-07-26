import { cpSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const SRC = 'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho/config/fancymenu'
const DEST = 'src/renderer/src/assets'

if (!existsSync(SRC)) {
  console.error(`FancyMenu folder not found: ${SRC}`)
  process.exit(1)
}

mkdirSync(join(DEST, 'panorama'), { recursive: true })
mkdirSync(join(DEST, 'slideshow'), { recursive: true })

const files = [
  ['assets/logo.png', 'logo.png'],
  ['assets/victoria.png', 'victoria.png'],
  ['assets/news-background.png', 'news-background.png'],
  ['assets/ost.ogg', 'ost.ogg']
]
for (const [from, to] of files) cpSync(join(SRC, from), join(DEST, to))

for (let i = 0; i < 6; i++) {
  cpSync(
    join(SRC, `panoramas/farfania_pan_1/panorama/panorama_${i}.png`),
    join(DEST, `panorama/panorama_${i}.png`)
  )
}
for (let i = 1; i <= 7; i++) {
  cpSync(join(SRC, `slideshows/carga/images/image_${i}.png`), join(DEST, `slideshow/image_${i}.png`))
}

console.log('Assets copied.')
