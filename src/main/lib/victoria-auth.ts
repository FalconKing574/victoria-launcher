import { createPublicKey, publicEncrypt, constants } from 'crypto'

/**
 * El vale de Victoria: autenticar una vez acá y entrar al juego sin `/login`.
 *
 * El servidor corre en `online-mode=false` para que puedan entrar los no
 * premium, así que Minecraft no verifica a nadie y la identidad la sostiene
 * AuthMe con una contraseña. Hasta ahora eso significaba autenticarse dos veces:
 * una acá —que para un no premium no autenticaba nada— y otra escribiendo
 * `/login` adentro del juego.
 *
 * ```
 * launcher  --GET  /v1/desafio-->  plugin VictoriaAuth
 *           --POST /v1/vale----->  (sobre cifrado: desafío, usuario, contraseña)
 *           <-------- vale (60 s, un uso, atado a la IP) --------
 *           --lanza Minecraft con VICTORIA_VALE en el entorno-->
 * ```
 *
 * ## Por qué HTTP y no HTTPS
 *
 * Porque no hay dominio, y un certificado autofirmado habría que fabricarlo en
 * el servidor. En vez de eso el sobre va cifrado **hacia la llave pública del
 * servidor**: nadie que mire el cable lee la contraseña, y un servidor falso
 * puesto en el medio no puede abrirlo.
 *
 * **No es TLS y no hay que decir que lo es**: no autentica al servidor más allá
 * de que tenga la llave, no da secreto hacia adelante y no protege la respuesta.
 * Lo que protege el otro extremo es que el vale dure un minuto, se use una sola
 * vez y esté atado a la IP.
 *
 * ## La llave sale del manifiesto
 *
 * No está escrita acá a propósito. Si estuviera, rotarla —porque se filtró,
 * porque el servidor la regeneró, porque se migró de host— obligaría a publicar
 * una versión nueva del launcher y a esperar a que le llegue a todos, mientras
 * el que todavía no actualizó cifra hacia una llave que ya no existe. En el
 * manifiesto es una línea, y el próximo arranque de cada launcher ya la tiene.
 */

/** Lo que el manifiesto dice del servidor de autenticación. */
export interface AuthManifest {
  /** Dónde escucha el plugin. Normalmente la misma IP del servidor. */
  host: string
  /** El puerto de la allocation, que no es el del juego. */
  puerto: number
  /** La llave pública del servidor, DER/SPKI en base64. */
  llave: string
}

/** Cuánto se espera al servidor de autenticación antes de rendirse. */
const ESPERA_MS = 6000

/**
 * Pide un vale. Devuelve null si no se pudo, y eso NO es un error que mostrar.
 *
 * Null quiere decir «este atajo no aplicó»: no hay servidor de autenticación
 * configurado, está caído, o la contraseña no era. El juego arranca igual y
 * AuthMe le pide `/login` adentro, que es el camino de siempre.
 *
 * La excepción es la contraseña equivocada, que sí conviene decirla acá — pero
 * el servidor **no distingue** entre «contraseña mala» y «usuario que no
 * existe», a propósito, así que lo más honesto que se puede decir es que no se
 * pudo verificar.
 */
export async function pedirVale(
  auth: AuthManifest,
  usuario: string,
  contrasena: string
): Promise<string | null> {
  if (!auth?.host || !auth?.puerto || !auth?.llave) return null
  if (!usuario || !contrasena) return null

  const base = `http://${auth.host}:${auth.puerto}/v1`
  try {
    const desafio = await conTiempo(fetch(`${base}/desafio`, { cache: 'no-store' }))
    if (!desafio.ok) return null
    const { desafio: reto } = (await desafio.json()) as { desafio?: string }
    if (!reto) return null

    const sobre = cerrar(auth.llave, `${reto}\n${usuario}\n${contrasena}`)
    const respuesta = await conTiempo(
      fetch(`${base}/vale`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: sobre
      })
    )
    if (!respuesta.ok) return null
    const { vale } = (await respuesta.json()) as { vale?: string }
    return vale ?? null
  } catch {
    // Sin internet, servidor caído, DNS: el juego arranca igual.
    return null
  }
}

/**
 * Cierra el sobre con RSA-OAEP hacia la llave del servidor.
 *
 * 🔴 `oaepHash: 'sha256'` no es decoración: es la mitad de un contrato.
 *
 * Node usa el mismo hash para el resumen y para la máscara (MGF1), así que con
 * esta línea el sobre queda en SHA-256 y SHA-256. **Java no hace lo mismo**:
 * su `OAEPWithSHA-256AndMGF1Padding` dice SHA-256 dos veces pero usa SHA-256
 * para el resumen y **SHA-1 para la máscara**.
 *
 * O sea que el nombre del algoritmo coincide de los dos lados, todo compila, y
 * el descifrado falla siempre sin decir por qué. Del otro lado está atado con un
 * `OAEPParameterSpec` explícito — ver `Llaves.abrir` en el plugin. Si algún día
 * se toca uno de los dos, hay que tocar el otro.
 */
function cerrar(llaveBase64: string, texto: string): string {
  const llave = createPublicKey({
    key: Buffer.from(llaveBase64, 'base64'),
    format: 'der',
    type: 'spki'
  })
  const cifrado = publicEncrypt(
    {
      key: llave,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(texto, 'utf8')
  )
  return cifrado.toString('base64')
}

/**
 * Le pone tiempo límite a un fetch.
 *
 * Sin esto, un servidor de autenticación que acepta la conexión y no contesta
 * deja al jugador mirando «Iniciando…» para siempre — y lo peor es que el juego
 * habría arrancado bien sin el vale.
 */
async function conTiempo<T>(promesa: Promise<T>): Promise<T> {
  let reloj: NodeJS.Timeout
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error('El servidor de sesión no contestó.')), ESPERA_MS)
  })
  try {
    return await Promise.race([promesa, limite])
  } finally {
    clearTimeout(reloj!)
  }
}
