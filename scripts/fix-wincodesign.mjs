/**
 * Prepares electron-builder's winCodeSign cache on Windows accounts that lack
 * the "create symbolic link" privilege.
 *
 * The winCodeSign archive contains two macOS symlinks (darwin/10.12/lib/
 * libcrypto.dylib and libssl.dylib). Extracting them needs a privilege standard
 * Windows accounts do not have, so 7-Zip exits non-zero, electron-builder never
 * renames the temp folder to its final name, and every `npm run dist` fails —
 * even though those two files are useless on Windows.
 *
 * This extracts the same archive ourselves, excluding darwin, straight into the
 * folder electron-builder looks for. Run once per machine, then `npm run dist`.
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const VERSION = '2.6.0'
const CACHE = join(homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const TARGET = join(CACHE, `winCodeSign-${VERSION}`)
const SEVEN_ZIP = join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')

if (process.platform !== 'win32') {
  console.log('Not Windows — nothing to do.')
  process.exit(0)
}

if (existsSync(TARGET)) {
  console.log(`Already prepared: ${TARGET}`)
  process.exit(0)
}

if (!existsSync(SEVEN_ZIP)) {
  console.error(`7za.exe not found at ${SEVEN_ZIP}. Run npm install first.`)
  process.exit(1)
}

if (!existsSync(CACHE)) {
  console.error(
    `No winCodeSign cache at ${CACHE}.\n` +
      'Run `npm run dist` once so electron-builder downloads it, then run this again.'
  )
  process.exit(1)
}

// Failed attempts leave numeric temp folders alongside the .7z downloads.
const archives = readdirSync(CACHE).filter((entry) => entry.endsWith('.7z'))
if (archives.length === 0) {
  console.error(`No .7z archive in ${CACHE}. Run \`npm run dist\` once first.`)
  process.exit(1)
}

const archive = join(CACHE, archives[0])
console.log(`Extracting ${archives[0]} without darwin/...`)

mkdirSync(TARGET, { recursive: true })
execFileSync(SEVEN_ZIP, ['x', '-snld', '-bd', '-y', archive, `-o${TARGET}`, '-x!darwin'], {
  stdio: 'inherit'
})

// Clean up the temp folders the failed runs left behind.
for (const entry of readdirSync(CACHE)) {
  const path = join(CACHE, entry)
  if (/^\d+$/.test(entry) && statSync(path).isDirectory()) {
    rmSync(path, { recursive: true, force: true })
  }
}

console.log(`\nReady: ${TARGET}`)
console.log('Now run: npm run dist')
