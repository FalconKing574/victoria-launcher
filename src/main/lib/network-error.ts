/** Sólo códigos; las excepciones de OAuth pueden contener URLs y tokens. */
export function networkCodes(error: unknown): string[] {
  const codes = new Set<string>()
  const seen = new Set<unknown>()
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object' || seen.has(value) || seen.size > 12) return
    seen.add(value)
    const e = value as { code?: unknown; name?: unknown; cause?: unknown; errors?: unknown[] }
    for (const field of [e.code, e.name]) {
      if (typeof field === 'string' && /^[A-Z][A-Za-z0-9_]{1,70}$/.test(field)) codes.add(field)
    }
    visit(e.cause)
    if (Array.isArray(e.errors)) e.errors.forEach(visit)
  }
  visit(error)
  return [...codes]
}

export function isNetworkError(error: unknown): boolean {
  const codes = networkCodes(error)
  if (codes.some((c) => /^(EAI_|ENOTFOUND|ECONN|ETIMEDOUT|ENET|EHOST|UND_ERR_|ERR_(CERT|TLS)|CERT_|DEPTH_|UNABLE_|SELF_SIGNED|TimeoutError|AbortError)/.test(c))) return true
  const message = error instanceof Error ? error.message : String(error)
  return /fetch failed|request to .* failed|net::ERR_/i.test(message)
}

export class ManifestUnavailable extends Error {
  constructor(cause: unknown) {
    super('No se pudo conectar con las actualizaciones de Victoria. Volvé a intentar. Si continúa, compartí el archivo conexion-launcher.log con soporte.', { cause })
    this.name = 'ManifestUnavailable'
  }
}
