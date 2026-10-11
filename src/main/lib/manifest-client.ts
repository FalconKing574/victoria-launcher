import type { Manifest, ManifestMod } from './sync-plan'
import { ManifestUnavailable } from './network-error'

const validFile = (v: unknown): v is ManifestMod => {
  if (!v || typeof v !== 'object') return false
  const f = v as ManifestMod
  return typeof f.filename === 'string' && /^[a-f0-9]{40}$/i.test(f.sha1) &&
    Number.isSafeInteger(f.sizeBytes) && f.sizeBytes >= 0 && typeof f.url === 'string' && /^https?:\/\//.test(f.url)
}

export function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Manifest
  return typeof m.packVersion === 'string' && m.packVersion.length > 0 &&
    typeof m.minecraft === 'string' && typeof m.forge === 'string' &&
    Array.isArray(m.mods) && m.mods.every(validFile) && Array.isArray(m.optional) && m.optional.every(validFile)
}

/** Dos intentos acotados. Sólo reutiliza un éxito durante un minuto en memoria. */
export function createManifestClient(options: {
  url: string
  fetchers: Array<typeof fetch>
  now?: () => number
  wait?: (ms: number) => Promise<void>
  timeoutMs?: number
  failure?: (stage: string, error: unknown) => void
}): () => Promise<Manifest> {
  let cached: { at: number; manifest: Manifest } | undefined
  let pending: Promise<Manifest> | undefined
  const now = options.now ?? Date.now
  const wait = options.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  async function load(): Promise<Manifest> {
    let last: unknown
    for (let attempt = 0; attempt < options.fetchers.length; attempt++) {
      try {
        const response = await options.fetchers[attempt](options.url, {
          cache: 'no-store', signal: AbortSignal.timeout(options.timeoutMs ?? 5_000)
        })
        if (!response.ok) {
          const error = Object.assign(new Error('Respuesta del manifiesto'), { code: `HTTP_${response.status}` })
          // 4xx permanentes no se arreglan repitiendo la misma petición.
          if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
            options.failure?.('http', error)
            throw new ManifestUnavailable(error)
          }
          throw error
        }
        const manifest: unknown = await response.json()
        if (!isManifest(manifest)) throw Object.assign(new Error('Manifiesto inválido'), { code: 'INVALID_MANIFEST' })
        cached = { at: now(), manifest }
        return manifest
      } catch (error) {
        if (error instanceof ManifestUnavailable) throw error
        last = error
        options.failure?.(`attempt_${attempt + 1}`, error)
        if (attempt + 1 < options.fetchers.length) await wait(250)
      }
    }
    throw new ManifestUnavailable(last)
  }
  return () => {
    if (!options.url) return Promise.reject(new ManifestUnavailable({ code: 'MISSING_URL' }))
    if (cached && now() >= cached.at && now() - cached.at < 60_000) return Promise.resolve(cached.manifest)
    if (pending) return pending
    pending = load().finally(() => { pending = undefined })
    return pending
  }
}
