/**
 * Shrinks the panorama skybox so the renderer stops carrying ~100 MB of bitmap.
 *
 * The six faces ship from FancyMenu at 2048x2048 PNG (~26 MB on disk, ~16.8 MB
 * of decoded RGBA each). They are only ever shown blurred behind a dark veil at
 * roughly 1180 px, so that resolution buys nothing and costs a lot: six large
 * textures plus a full-screen backdrop-filter over an animating 3D cube is the
 * heaviest thing in the app by far, and the most likely cause of a renderer
 * out-of-memory crash on startup.
 *
 * So: downscale to 1024, bake the blur in (it was always applied at runtime),
 * and store as JPEG — a skybox has no transparency to preserve.
 *
 *   node scripts/optimize-panorama.mjs
 */
import { readdirSync, statSync, renameSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

const DIR = 'src/renderer/src/assets/panorama'
const ORIGINALS = join(DIR, 'original')
const SIZE = 1024
const BLUR = 6

if (!existsSync(DIR)) {
  console.error(`No panorama folder at ${DIR}`)
  process.exit(1)
}

// Keep the untouched PNGs so the source of truth is never lost.
mkdirSync(ORIGINALS, { recursive: true })

let before = 0
let after = 0

for (let i = 0; i < 6; i++) {
  const png = join(DIR, `panorama_${i}.png`)
  const stashed = join(ORIGINALS, `panorama_${i}.png`)
  const jpg = join(DIR, `panorama_${i}.jpg`)

  const source = existsSync(png) ? png : stashed
  if (!existsSync(source)) {
    console.error(`Missing face ${i} — expected ${png} or ${stashed}`)
    process.exit(1)
  }

  before += statSync(source).size

  await sharp(source)
    .resize(SIZE, SIZE, { fit: 'cover' })
    .blur(BLUR)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(jpg)

  after += statSync(jpg).size

  if (existsSync(png)) renameSync(png, stashed)
}

const mb = (bytes) => (bytes / 1048576).toFixed(1)
console.log(`Panorama: ${mb(before)} MB -> ${mb(after)} MB across 6 faces.`)
console.log(`Decoded in memory: ~${mb(6 * 2048 * 2048 * 4)} MB -> ~${mb(6 * SIZE * SIZE * 4)} MB.`)
console.log(`Originals kept in ${ORIGINALS}/`)
