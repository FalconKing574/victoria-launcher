/**
 * Builds the modpack manifest from the CurseForge instance.
 *
 * Every jar in mods/ becomes a required entry with its sha1, so the launcher
 * can tell "same file" from "same name". The optional mods are declared here by
 * hand because they are not installed locally — players opt into them.
 *
 * Publishing an update:
 *   1. node scripts/build-manifest.mjs
 *   2. Create a GitHub Release and upload dist-modpack/manifest.json plus every
 *      jar in dist-modpack/mods/
 *   3. Nothing else. Players pick it up on next launch.
 *
 * Usage:
 *   node scripts/build-manifest.mjs --repo usuario/repo --version 1.1.0
 */
import { createHash } from 'crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]])
    return pairs
  }, [])
)

const INSTANCE =
  args.instance ?? 'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho'
const REPO = args.repo ?? 'TU_USUARIO/TU_REPO'
const VERSION = args.version ?? '1.0.0'
const OUT = 'dist-modpack'

const RELEASE_BASE = `https://github.com/${REPO}/releases/download/v${VERSION}`

/**
 * Required mods that are not installed in the instance yet. Performance mods go
 * here rather than in OPTIONAL — everyone should get them.
 *
 * Nvidium needs an Nvidia GPU and Embeddium (already in the pack). On other
 * GPUs it disables itself, so shipping it to everyone is safe; if it ever
 * misbehaves, move this entry into OPTIONAL and it becomes opt-in instead.
 */
const EXTRA_REQUIRED = [{ filename: 'nvidium-0.5.5.jar' }]

// Optional mods are opt-in: quality of life and looks, never performance.
const OPTIONAL = [
  {
    id: 'xaeros-minimap',
    name: "Xaero's Minimap",
    summary:
      'Minimapa en la esquina con marcadores y cuevas. El pack ya trae el mapa completo, esto añade el minimapa.',
    category: 'calidad-de-vida',
    filename: 'Xaeros_Minimap_25.2.10_Forge_1.20.jar',
    image: 'https://media.forgecdn.net/avatars/thumbnails/168/652/64/64/636588047824059724.png'
  }
]

const modsDir = join(INSTANCE, 'mods')
if (!existsSync(modsDir)) {
  console.error(`No encuentro la carpeta de mods: ${modsDir}`)
  process.exit(1)
}

mkdirSync(join(OUT, 'mods'), { recursive: true })

const jars = readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith('.jar'))
const mods = []

for (const filename of jars) {
  const path = join(modsDir, filename)
  const buffer = readFileSync(path)
  mods.push({
    filename,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(path).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(filename)}`
  })
  cpSync(path, join(OUT, 'mods', filename))
}

// Required mods that live only in dist-modpack/mods, not in the instance.
for (const extra of EXTRA_REQUIRED) {
  const staged = join(OUT, 'mods', extra.filename)
  if (!existsSync(staged)) {
    console.warn(
      `AVISO: falta ${extra.filename} en ${OUT}/mods. ` +
        'Descárgalo y ponlo ahí, o los jugadores no lo recibirán.'
    )
    continue
  }
  if (mods.some((m) => m.filename === extra.filename)) continue
  const buffer = readFileSync(staged)
  mods.push({
    filename: extra.filename,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(staged).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(extra.filename)}`
  })
}

const optional = OPTIONAL.map((mod) => {
  const staged = join(OUT, 'mods', mod.filename)
  if (!existsSync(staged)) {
    console.warn(
      `AVISO: ${mod.filename} no está en ${OUT}/mods. ` +
        'Descárgalo y ponlo ahí antes de publicar, o los jugadores no podrán activarlo.'
    )
    return { ...mod, sha1: '', sizeBytes: 0, url: `${RELEASE_BASE}/${mod.filename}` }
  }
  const buffer = readFileSync(staged)
  return {
    ...mod,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sizeBytes: statSync(staged).size,
    url: `${RELEASE_BASE}/${encodeURIComponent(mod.filename)}`
  }
})

const manifest = {
  packVersion: VERSION,
  minecraft: '1.20.1',
  forge: '47.4.0',
  mods,
  optional
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

const totalMb = (mods.reduce((sum, m) => sum + m.sizeBytes, 0) / 1048576).toFixed(0)

console.log(`
Manifiesto generado: ${OUT}/manifest.json

  Versión del pack : ${VERSION}
  Mods requeridos  : ${mods.length} (${totalMb} MB)
  Mods opcionales  : ${optional.length}
  Repositorio      : ${REPO}

Siguiente paso — crea una release en GitHub con la etiqueta v${VERSION} y sube:
  - ${OUT}/manifest.json
  - todos los .jar de ${OUT}/mods/

Luego apunta el launcher a:
  https://github.com/${REPO}/releases/latest/download/manifest.json
`)
