/**
 * Las reglas de las pantallas de cuenta, aparte de React para poder probarlas.
 *
 * Cada `falta…` devuelve lo que el botón tiene que decir mientras no se puede
 * enviar, o `null` cuando está todo. Es la idea del launcher de Majestic: en vez
 * de un botón apagado que no explica nada, el propio botón dice qué falta
 * («Repetí la contraseña», «Escribí el código de 6 números»).
 *
 * Son reglas de forma para ahorrar un viaje: las que valen son las del servidor
 * de cuentas, y su `mensaje` se muestra tal cual si dice otra cosa.
 */

export const NOMBRE = /^[A-Za-z0-9_]{3,16}$/
export const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
export const LARGO_MINIMO_CONTRASENA = 8
export const LARGO_CODIGO = 6

export function faltaNombre(nombre: string): string | null {
  if (!nombre) return 'Escribí tu nombre en el juego'
  if (nombre.length < 3 || nombre.length > 16) return 'El nombre va de 3 a 16 caracteres'
  if (!NOMBRE.test(nombre)) return 'El nombre: sólo letras, números y _'
  return null
}

export function faltaCorreo(correo: string): string | null {
  const limpio = correo.trim()
  if (!limpio) return 'Escribí tu correo'
  if (!CORREO.test(limpio)) return 'Ese correo no parece válido'
  return null
}

export function faltaContrasenas(contrasena: string, repetida: string): string | null {
  if (!contrasena) return 'Elegí una contraseña'
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña: mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`
  }
  if (!repetida) return 'Repetí la contraseña'
  if (repetida !== contrasena) return 'Las contraseñas no coinciden'
  return null
}

export function faltaRegistro(datos: {
  nombre: string
  contrasena: string
  repetida: string
  correo: string
}): string | null {
  return (
    faltaNombre(datos.nombre) ??
    faltaContrasenas(datos.contrasena, datos.repetida) ??
    faltaCorreo(datos.correo)
  )
}

export function faltaEntrar(datos: { nombre: string; contrasena: string }): string | null {
  if (!datos.nombre) return 'Escribí tu nombre'
  if (!datos.contrasena) return 'Escribí tu contraseña'
  return null
}

export function faltaCodigo(codigo: string): string | null {
  return codigo.length === LARGO_CODIGO ? null : `Escribí el código de ${LARGO_CODIGO} números`
}

/**
 * Lo que queda de lo que el jugador escribió o pegó en el código: sólo los
 * números, y como mucho seis. Un «123 456» o «123-456» copiado del correo
 * tiene que entrar igual.
 */
export function limpiarCodigo(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, LARGO_CODIGO)
}

/**
 * Las etapas de un jugador nuevo, de la cuenta al recorrido. Las muestran la
 * pantalla de cuenta y la de pasos con la misma barra, así se ve cuánto falta
 * desde el principio. El que entra con Microsoft no confirma correo.
 */
export function etapasIngreso(tipo: 'PREMIUM' | 'NO_PREMIUM'): string[] {
  return tipo === 'PREMIUM'
    ? ['Tu cuenta', 'Discord', 'Normas', 'Recorrido']
    : ['Tu cuenta', 'Tu correo', 'Discord', 'Normas', 'Recorrido']
}
