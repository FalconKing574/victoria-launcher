import { createPrivateKey, sign, type KeyObject } from 'crypto'

/**
 * El certificado de jugador de Mojang, para que el servidor de cuentas pueda
 * comprobar a un premium aunque no llegue a Mojang.
 *
 * El hosting del servidor se queda sin salida a internet (el 18-09-2026, casi
 * seis horas) y mientras tanto no puede preguntarle a Mojang de quién es el
 * token: el jugador leía «No se pudo comprobar tu cuenta con Mojang». El
 * launcher sí tiene internet —el jugador acaba de entrar con Microsoft—, así que
 * le pide a Mojang el certificado de jugador (el mismo que usa Minecraft para
 * firmar el chat) y lo manda junto con el token. El plugin comprueba la firma
 * de Mojang con claves que ya tiene guardadas, sin red. Ver
 * `CertificadoMojang.java` en VictoriaAuth.
 *
 * El certificado no es secreto: cada servidor online al que entra el jugador
 * recibe la clave pública y la firma. Por eso además se firma, con la clave
 * PRIVADA —que nunca sale de esta PC—, una prueba atada a este equipo y a este
 * momento. Sin ella, quien juntara certificados ajenos podría entrar a esas
 * cuentas.
 *
 * Si algo de esto falla, se devuelve null y el login sigue como siempre: el
 * certificado es el respaldo, no el camino principal.
 */

const PERFIL = 'https://api.minecraftservices.com/minecraft/profile'
const CERTIFICADO = 'https://api.minecraftservices.com/player/certificates'
const ESPERA_MS = 6_000

/** Lo que devuelve POST /player/certificates (sólo lo que se usa). */
export interface RespuestaCertificado {
  keyPair: { privateKey: string; publicKey: string }
  /** La firma de Mojang sobre uuid + vencimiento + clave. Es la que valida Minecraft 1.20.1. */
  publicKeySignatureV2: string
  expiresAt: string
}

/** Lo que viaja al plugin dentro del pedido `premium`. */
export interface CertificadoPremium {
  uuid: string
  nombre: string
  expira: string
  /** Clave pública del jugador, X.509 en base64. */
  clave: string
  firmaMojang: string
  momento: string
  prueba: string
}

/** Lo firmado por la prueba. Tiene que coincidir con `CertificadoMojang.textoPrueba`. */
export function textoPrueba(uuid: string, momento: string, huella: string): string {
  return `victoria-premium|${uuid.replace(/-/g, '').toLowerCase()}|${momento}|${huella}`
}

/** El base64 de adentro de un PEM, sin encabezados ni saltos de línea. */
export function cuerpoPem(pem: string): string {
  return pem.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/\s+/g, '')
}

/**
 * Mojang rotula la privada como "RSA PRIVATE KEY" pero adentro va PKCS#8, que
 * es como la lee Minecraft. Si algún día cambia a PKCS#1 de verdad, también se
 * entiende.
 */
function clavePrivada(pem: string): KeyObject {
  const der = Buffer.from(cuerpoPem(pem), 'base64')
  try {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  } catch {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs1' })
  }
}

export function armarCertificado(
  r: RespuestaCertificado,
  perfil: { id: string; name: string },
  huella: string,
  ahora: number
): CertificadoPremium {
  const momento = String(ahora)
  const prueba = sign('sha256', Buffer.from(textoPrueba(perfil.id, momento, huella), 'utf8'), clavePrivada(r.keyPair.privateKey))
  return {
    uuid: perfil.id.replace(/-/g, '').toLowerCase(),
    nombre: perfil.name,
    expira: r.expiresAt,
    clave: cuerpoPem(r.keyPair.publicKey),
    firmaMojang: r.publicKeySignatureV2,
    momento,
    prueba: prueba.toString('base64')
  }
}

/** El certificado listo para mandar, o null si no se pudo. Nunca tira. */
export async function pedirCertificado(
  mcToken: string,
  huella: string,
  pedir: typeof fetch = fetch,
  ahora: () => number = Date.now
): Promise<CertificadoPremium | null> {
  try {
    const auth = { Authorization: `Bearer ${mcToken}` }
    const p = await pedir(PERFIL, { method: 'GET', headers: auth, signal: AbortSignal.timeout(ESPERA_MS) })
    if (!p.ok) return null
    const perfil = (await p.json()) as { id?: string; name?: string }
    if (!perfil.id || !perfil.name) return null

    const c = await pedir(CERTIFICADO, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(ESPERA_MS)
    })
    if (!c.ok) return null
    const r = (await c.json()) as RespuestaCertificado
    if (!r.keyPair?.privateKey || !r.keyPair?.publicKey || !r.publicKeySignatureV2 || !r.expiresAt) return null

    return armarCertificado(r, { id: perfil.id, name: perfil.name }, huella, ahora())
  } catch {
    return null
  }
}
