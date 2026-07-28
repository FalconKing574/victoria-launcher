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
import AdmZip from 'adm-zip'
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
 * Required mods that are not installed in the instance yet.
 *
 * The whole performance stack (Embeddium, ModernFix, FerriteCore, EntityCulling,
 * ImmediatelyFast, MemoryLeakFix, Clumps, SmoothBoot) is already in the instance
 * and therefore already required — nobody has to opt into a smoother game.
 */
const EXTRA_REQUIRED = []

/**
 * Mods present in the instance that the pack should NOT ship.
 *
 * Matched as a substring of the filename so version bumps do not silently
 * un-exclude something. Removing an entry here and republishing puts the mod
 * back; the launcher deletes it from players on the next sync because it is
 * one of the files the launcher installed.
 */
const EXCLUDED = ['Essential_']

/**
 * Mods the player chooses. Deliberately a short list: the launcher must not let
 * anyone toggle the pack's required mods, because disabling one desyncs them
 * from the server and produces a connection failure nobody can diagnose.
 *
 * Nvidium is here rather than required because it only works on Nvidia GPUs and
 * needs Embeddium. Moving it into EXTRA_REQUIRED ships it to everyone instead.
 */
const OPTIONAL = [
  {
    id: 'distant-horizons',
    name: 'Distant Horizons',
    summary:
      'Renderiza el terreno lejano en baja resolución, así que ves muchísimo más lejos sin hundir los FPS. Viene activado.',
    category: 'visual',
    filename: 'DistantHorizons-3.2.0-b-1.20.1-fabric-forge.jar',
    image: 'https://media.forgecdn.net/avatars/thumbnails/508/677/64/64/637868261444007926.png'
  },
  {
    id: 'xaeros-minimap',
    name: "Xaero's Minimap",
    summary:
      'Minimapa en la esquina con marcadores y cuevas. El pack ya trae el mapa completo; esto añade el minimapa.',
    category: 'calidad-de-vida',
    filename: 'Xaeros_Minimap_25.2.10_Forge_1.20.jar',
    image: 'https://media.forgecdn.net/avatars/thumbnails/168/652/64/64/636588047824059724.png'
  },
  {
    id: 'nvidium',
    name: 'Nvidium',
    summary:
      'Renderizador para GPUs Nvidia. Sube mucho los FPS, sobre todo con Distant Horizons activo. Requiere Nvidia; en otras tarjetas se desactiva solo.',
    category: 'rendimiento',
    filename: 'nvidium-0.5.5.jar',
    image: 'https://media.forgecdn.net/avatars/thumbnails/857/878/64/64/638301896040706094.png'
  }
]

const modsDir = join(INSTANCE, 'mods')
if (!existsSync(modsDir)) {
  console.error(`No encuentro la carpeta de mods: ${modsDir}`)
  process.exit(1)
}

mkdirSync(join(OUT, 'mods'), { recursive: true })

// A mod that is opt-in must not also be required, or everyone gets it anyway.
const OPTIONAL_FILENAMES = new Set(OPTIONAL.map((m) => m.filename))

const jars = readdirSync(modsDir)
  .filter((f) => f.toLowerCase().endsWith('.jar'))
  .filter((f) => !OPTIONAL_FILENAMES.has(f))
  .filter((f) => {
    const excluded = EXCLUDED.find((pattern) => f.includes(pattern))
    if (excluded) console.log(`Excluido del pack: ${f}`)
    return !excluded
  })
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

// Optional mods that are already in the instance get staged from there.
for (const mod of OPTIONAL) {
  const inInstance = join(modsDir, mod.filename)
  const staged = join(OUT, 'mods', mod.filename)
  if (existsSync(inInstance) && !existsSync(staged)) cpSync(inInstance, staged)
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

// config/, resourcepacks/ and shaderpacks/ as one archive. options.txt is
// deliberately excluded: it holds the player's keybinds and video settings, and
// overwriting it on every update would wipe their setup.
const OVERRIDE_DIRS = ['config', 'resourcepacks', 'shaderpacks', 'resources', 'tacz']

/**
 * Paths inside the override folders that are NOT shipped.
 *
 * resources/videos is 726 MB of tutorial videos that are byte-identical
 * duplicates of the ones in config/fancymenu/assets/videos -- two even under a
 * different name -- and nothing in the menu configuration references that path.
 * The menu reads its videos from config/ and only pulls images and sounds out
 * of resources/, so shipping the folder would double half a gigabyte for
 * nothing. Verified by grepping the FancyMenu customization files.
 */
const OVERRIDE_EXCLUDE = ['resources/videos']

/**
 * Wrangler refuses uploads over 300 MiB and this pack's config folder is
 * 614 MiB, most of it menu videos, so the overrides ship as several archives
 * instead of one. Files are bin-packed by size; each archive stays under the
 * cap and the launcher extracts them in order.
 */
const PART_LIMIT_BYTES = 260 * 1024 * 1024

function walk(dir, base, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    const rel = `${base}/${entry.name}`
    if (entry.isDirectory()) walk(full, rel, out)
    else out.push({ full, rel, size: statSync(full).size })
  }
  return out
}

let overrides
if (args['skip-overrides'] === undefined) {
  console.log('Empaquetando configuración... (puede tardar, son cientos de MB)')

  const files = []
  for (const folder of OVERRIDE_DIRS) {
    const source = join(INSTANCE, folder)
    if (existsSync(source)) files.push(...walk(source, folder))
    else console.warn(`AVISO: no existe ${folder}/ en la instancia, se omite.`)
  }

  const before = files.length
  const kept = files.filter(
    (f) => !OVERRIDE_EXCLUDE.some((prefix) => f.rel.startsWith(`${prefix}/`))
  )
  if (kept.length !== before) {
    const saved = files
      .filter((f) => !kept.includes(f))
      .reduce((sum, f) => sum + f.size, 0)
    console.log(`  Excluidos ${before - kept.length} archivos (${(saved / 1048576).toFixed(0)} MB): ${OVERRIDE_EXCLUDE.join(', ')}`)
  }
  files.length = 0
  files.push(...kept)

  // Largest first so big files claim their own part instead of stranding
  // small ones in a part that then overflows.
  files.sort((a, b) => b.size - a.size)

  const groups = []
  for (const file of files) {
    let target = groups.find((g) => g.size + file.size <= PART_LIMIT_BYTES)
    if (!target) {
      target = { size: 0, files: [] }
      groups.push(target)
    }
    target.files.push(file)
    target.size += file.size
  }

  overrides = []
  groups.forEach((group, i) => {
    const name = `overrides-${i + 1}.zip`
    const path = join(OUT, name)
    const zip = new AdmZip()
    for (const file of group.files) {
      const dirInZip = file.rel.split('/').slice(0, -1).join('/')
      zip.addLocalFile(file.full, dirInZip)
    }
    zip.writeZip(path)
    const buffer = readFileSync(path)
    const bytes = statSync(path).size
    overrides.push({
      name,
      sha1: createHash('sha1').update(buffer).digest('hex'),
      sizeBytes: bytes,
      url: `${RELEASE_BASE}/${name}`
    })
    console.log(`  ${name}: ${(bytes / 1048576).toFixed(0)} MB (${group.files.length} archivos)`)
  })
} else {
  console.log('Saltando overrides (--skip-overrides).')
}

const manifest = {
  packVersion: VERSION,
  minecraft: '1.20.1',
  forge: '47.4.0',
  mods,
  optional,
  ...(overrides ? { overrides } : {})
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
  - ${OUT}/overrides.zip (configs, resourcepacks y shaders)

Luego apunta el launcher a:
  https://github.com/${REPO}/releases/latest/download/manifest.json
`)
