import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes
} from 'crypto'

/**
 * El sobre de la versión 2 del servidor de cuentas de Victoria.
 *
 * RSA sólo envuelve una clave AES de 32 bytes; todo lo demás va en AES-256-GCM.
 * Hizo falta porque RSA-3072 con OAEP-SHA256 cifra como mucho 318 bytes, y el
 * token de Minecraft de un premium no entra.
 *
 * La misma clave AES cierra la respuesta (con otro nonce): ahora vuelve un token
 * de sesión de 30 días, y eso no puede viajar en claro.
 *
 * El formato es un contrato con `Sobre.java` del plugin VictoriaAuth:
 *
 * - pedido:    `{"k": b64(RSA-OAEP(clave)), "n": b64(nonce 12), "c": b64(GCM || tag 16)}`
 * - respuesta: `{"n": ..., "c": ...}` con la misma clave
 *
 * 🔴 `oaepHash: 'sha256'` no es decoración: Java usa SHA-1 para la máscara si no
 * se le dice, y del otro lado está atado con un `OAEPParameterSpec` explícito.
 * `tests/sobre.test.ts` escribe un vector que el plugin abre en `SobreVectorTest`.
 */

export interface PedidoCerrado {
  texto: string
  /** Hace falta para abrir la respuesta. No sale nunca del proceso main. */
  clave: Buffer
}

export function cerrarPedido(
  llaveBase64: string,
  cuerpo: unknown,
  clave: Buffer = randomBytes(32)
): PedidoCerrado {
  const llave = createPublicKey({
    key: Buffer.from(llaveBase64, 'base64'),
    format: 'der',
    type: 'spki'
  })
  const k = publicEncrypt(
    { key: llave, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    clave
  )
  const { n, c } = JSON.parse(cerrarConClave(clave, cuerpo)) as { n: string; c: string }
  return { texto: JSON.stringify({ k: k.toString('base64'), n, c }), clave }
}

export function cerrarConClave(clave: Buffer, cuerpo: unknown): string {
  const nonce = randomBytes(12)
  const cifrador = createCipheriv('aes-256-gcm', clave, nonce)
  const claro = Buffer.from(JSON.stringify(cuerpo), 'utf8')
  const c = Buffer.concat([cifrador.update(claro), cifrador.final(), cifrador.getAuthTag()])
  return JSON.stringify({ n: nonce.toString('base64'), c: c.toString('base64') })
}

/** Tira si la respuesta fue tocada o no es de esta clave. */
export function abrirRespuesta<T>(clave: Buffer, texto: string): T {
  const { n, c } = JSON.parse(texto) as { n: string; c: string }
  const todo = Buffer.from(c, 'base64')
  const descifrador = createDecipheriv('aes-256-gcm', clave, Buffer.from(n, 'base64'))
  descifrador.setAuthTag(todo.subarray(todo.length - 16))
  const claro = Buffer.concat([
    descifrador.update(todo.subarray(0, todo.length - 16)),
    descifrador.final()
  ])
  return JSON.parse(claro.toString('utf8')) as T
}
