import { createPublicKey } from 'crypto'
import type { AuthManifest } from './cuentas-api'
import { ManifestUnavailable } from './network-error'

interface StoredAuth { url: string; savedAt: number; auth: AuthManifest | null }

export function validAuth(value: unknown): value is AuthManifest {
  if (!value || typeof value !== 'object') return false
  const a = value as AuthManifest
  if (typeof a.host !== 'string' || !/^[A-Za-z0-9.-]+$/.test(a.host) ||
    !Number.isInteger(a.puerto) || a.puerto < 1 || a.puerto > 65535 || typeof a.llave !== 'string') return false
  if (a.discord && (!/^\d{10,25}$/.test(a.discord.clientId) || !Number.isInteger(a.discord.puerto) || a.discord.puerto < 1 || a.discord.puerto > 65535)) return false
  try {
    const key = createPublicKey({ key: Buffer.from(a.llave, 'base64'), format: 'der', type: 'spki' })
    return key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048
  } catch { return false }
}

/** El respaldo sólo contiene dirección y llave PÚBLICA. Siempre se consulta al servidor. */
export function createAuthConfig(options: {
  url: string
  loadManifest: () => Promise<{ auth?: unknown }>
  read: () => unknown
  write: (value: StoredAuth) => void
  bootstrap?: AuthManifest
  now?: () => number
  failure?: (stage: string, error?: unknown) => void
}): () => Promise<AuthManifest | null> {
  const now = options.now ?? Date.now
  let memory: StoredAuth | undefined
  let pending: Promise<AuthManifest | null> | undefined
  let fallback: { until: number; auth: AuthManifest | null } | undefined
  function cached(): StoredAuth | undefined {
    try {
      const value = memory ?? options.read() as StoredAuth
      if (value && value.url === options.url && (value.auth === null || validAuth(value.auth)) && Number.isFinite(value.savedAt) &&
        now() >= value.savedAt && now() - value.savedAt < 7 * 24 * 60 * 60_000) return value
    } catch { /* Un caché incompleto no bloquea ni reemplaza datos válidos de red. */ }
    return undefined
  }
  async function load(): Promise<AuthManifest | null> {
    let manifest: { auth?: unknown }
    try { manifest = await options.loadManifest() } catch (error) {
      // Un manifiesto que sí llegó y revoca/cambia auth no admite respaldo.
      if (!(error instanceof ManifestUnavailable)) throw error
      const saved = cached()
      if (saved) {
        options.failure?.('cached_fallback', error)
        fallback = { until: now() + 30_000, auth: saved.auth }
        return saved.auth
      }
      if (validAuth(options.bootstrap)) {
        options.failure?.('bundled_fallback', error)
        fallback = { until: now() + 30_000, auth: options.bootstrap }
        return options.bootstrap
      }
      throw error
    }
    const configuration = manifest.auth ?? null
    if (configuration !== null && !validAuth(configuration)) throw new Error('La configuración de cuentas de Victoria no es válida. Contactá con soporte.')
    const next = { url: options.url, savedAt: now(), auth: configuration }
    memory = next
    fallback = undefined
    try { options.write(next) } catch (error) { options.failure?.('cache_write', error) }
    return next.auth
  }
  return () => {
    const saved = cached()
    if (saved && now() - saved.savedAt < 5 * 60_000) return Promise.resolve(saved.auth)
    if (fallback && now() < fallback.until && now() >= fallback.until - 30_000) return Promise.resolve(fallback.auth)
    if (pending) return pending
    pending = load().finally(() => { pending = undefined })
    return pending
  }
}
