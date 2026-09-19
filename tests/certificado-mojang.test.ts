import { describe, it, expect } from 'vitest'
import { createPublicKey, generateKeyPairSync, sign, verify } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  armarCertificado,
  cuerpoPem,
  pedirCertificado,
  textoPrueba,
  type RespuestaCertificado
} from '../src/main/lib/certificado-mojang'

const HUELLA = '3'.repeat(64)
const UUID = '069a79f444e94726a5befca90e38aaf5'

const mojang = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jugador = generateKeyPairSync('rsa', { modulusLength: 2048 })

function pem(tipo: string, der: Buffer): string {
  const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n')
  return `-----BEGIN ${tipo}-----\n${b64}\n-----END ${tipo}-----\n`
}

/**
 * Lo que devuelve POST /player/certificates. Los encabezados dicen "RSA" pero
 * adentro va PKCS#8 y X.509: así los lee Minecraft 1.20.1 (Crypt con
 * PKCS8EncodedKeySpec y X509EncodedKeySpec, comprobado con javap).
 */
function respuestaDeMojang(expira = '2099-01-15T10:20:30.123456Z'): RespuestaCertificado {
  const clave = jugador.publicKey.export({ type: 'spki', format: 'der' })
  const firmado = Buffer.alloc(24 + clave.length)
  firmado.write(UUID, 0, 16, 'hex')
  firmado.writeBigInt64BE(BigInt(Date.parse(expira)), 16)
  clave.copy(firmado, 24)
  return {
    keyPair: {
      privateKey: pem('RSA PRIVATE KEY', jugador.privateKey.export({ type: 'pkcs8', format: 'der' })),
      publicKey: pem('RSA PUBLIC KEY', clave)
    },
    publicKeySignatureV2: sign('sha1', firmado, mojang.privateKey).toString('base64'),
    expiresAt: expira
  }
}

describe('certificado de Mojang', () => {
  it('saca el cuerpo del PEM sin encabezados ni saltos', () => {
    expect(cuerpoPem('-----BEGIN RSA PUBLIC KEY-----\nQUJD\nREVG\n-----END RSA PUBLIC KEY-----\n')).toBe('QUJDREVG')
  })

  it('arma la prueba firmada con la clave privada del certificado', () => {
    const c = armarCertificado(respuestaDeMojang(), { id: UUID, name: 'Notch' }, HUELLA, 1_800_000_000_000)
    expect(c.uuid).toBe(UUID)
    expect(c.nombre).toBe('Notch')
    expect(c.momento).toBe('1800000000000')
    const ok = verify(
      'sha256',
      Buffer.from(textoPrueba(UUID, c.momento, HUELLA), 'utf8'),
      createPublicKey({ key: Buffer.from(c.clave, 'base64'), format: 'der', type: 'spki' }),
      Buffer.from(c.prueba, 'base64')
    )
    expect(ok).toBe(true)
  })

  it('el texto de la prueba es el mismo que arma el plugin', () => {
    expect(textoPrueba('069a79f4-44e9-4726-A5BE-fca90e38aaf5', '12', 'h')).toBe(
      'victoria-premium|069a79f444e94726a5befca90e38aaf5|12|h'
    )
  })

  it('pide perfil y certificado con el token, y no tira si Mojang falla', async () => {
    const pedidos: string[] = []
    const bien = (async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
      pedidos.push(`${init?.method ?? 'GET'} ${url} ${init?.headers?.Authorization}`)
      const cuerpo = url.endsWith('/minecraft/profile') ? { id: UUID, name: 'Notch' } : respuestaDeMojang()
      return new Response(JSON.stringify(cuerpo), { status: 200 })
    }) as unknown as typeof fetch
    const c = await pedirCertificado('tok', HUELLA, bien, () => 5)
    expect(c?.uuid).toBe(UUID)
    expect(pedidos).toEqual([
      'GET https://api.minecraftservices.com/minecraft/profile Bearer tok',
      'POST https://api.minecraftservices.com/player/certificates Bearer tok'
    ])

    const mal = (async () => new Response('', { status: 429 })) as unknown as typeof fetch
    expect(await pedirCertificado('tok', HUELLA, mal)).toBeNull()
    const caido = (async () => {
      throw new Error('sin red')
    }) as unknown as typeof fetch
    expect(await pedirCertificado('tok', HUELLA, caido)).toBeNull()
  })

  // El plugin lo lee en CertificadoVectorTest: prueba que lo que arma Node lo
  // entiende Java, que es lo que un test de un solo lado no puede probar.
  it.runIf(process.env.VICTORIA_VECTOR === '1')('escribe el vector para el plugin', () => {
    const momento = 1_800_000_000_000
    const vector = {
      claveMojang: mojang.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      huella: HUELLA,
      ahora: momento + 1000,
      cert: armarCertificado(respuestaDeMojang(), { id: UUID, name: 'Notch' }, HUELLA, momento)
    }
    const destino = join(__dirname, '..', '..', 'VictoriaRP', 'plugins-src', 'VictoriaAuth', 'test', 'vector-certificado.json')
    writeFileSync(destino, JSON.stringify(vector, null, 2), 'utf8')
  })
})
