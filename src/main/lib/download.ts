import { createHash } from 'crypto'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'fs'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { Readable, Transform } from 'stream'

export interface DownloadOptions {
  /** Hex digest the finished file must match. */
  expected: string
  /** Digest algorithm the manifest published. */
  algo: 'sha1' | 'sha256'
  /** What to call this file when something goes wrong. */
  label: string
  /** Reports bytes as they arrive; total is 0 when the server sends no length. */
  onProgress?: (received: number, total: number) => void
}

/**
 * Downloads a file, verifying its hash as the bytes stream past rather than by
 * reading the finished file back.
 *
 * Re-opening was a real failure: a player hit
 *   ENOENT: no such file or directory, open '...\overrides-1.zip.part'
 * because something removed the freshly written archive before it could be
 * hashed — an antivirus quarantining a 260 MB archive that just appeared in
 * AppData is the usual culprit. Hashing inline removes that window entirely,
 * and avoids pulling a quarter-gigabyte through memory to do it.
 */
export async function downloadVerified(
  url: string,
  target: string,
  { expected, algo, label, onProgress }: DownloadOptions
): Promise<void> {
  const dir = dirname(target)
  // Created here, not once up front: if anything removes the folder mid-run,
  // the next file recreates it instead of failing.
  mkdirSync(dir, { recursive: true })

  const partial = `${target}.part`
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar ${label} (HTTP ${response.status}).`)
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  let received = 0

  const hash = createHash(algo)
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      received += chunk.length
      onProgress?.(received, total)
      callback(null, chunk)
    }
  })

  try {
    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(partial))
  } catch (error) {
    rmSync(partial, { force: true })
    throw new Error(`Falló la descarga de ${label}: ${(error as Error).message}`)
  }

  const actual = hash.digest('hex')
  if (actual !== expected) {
    rmSync(partial, { force: true })
    throw new Error(`${label} se descargó corrupto. Inténtalo de nuevo.`)
  }

  if (!existsSync(partial)) {
    throw new Error(
      `${label} desapareció justo después de descargarse.\n\n` +
        'Casi siempre es el antivirus poniéndolo en cuarentena. Añade esta carpeta ' +
        `a las excepciones y reinténtalo:\n${dir}`
    )
  }

  rmSync(target, { force: true })
  renameSync(partial, target)
}
