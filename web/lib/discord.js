/**
 * Cuánta gente hay en el Discord de Victoria, para la portada.
 *
 * Es lo mismo que muestra Discord al pegar una invitación: la API pública de
 * invitaciones, con `with_counts`, devuelve los miembros y los conectados sin
 * token ni bot. Si cambia la invitación, se cambia acá y en las páginas
 * (`DISCORD` en web/generar-paginas.mjs).
 */
export const INVITACION = 'HFvsGaxc7G'
export const URL_INVITACION = `https://discord.com/api/v10/invites/${INVITACION}?with_counts=true`

/** Las dos cifras, o un error: una respuesta sin ellas no se convierte en un cero. */
export function resumirInvitacion(datos) {
  const miembros = datos?.approximate_member_count
  const conectados = datos?.approximate_presence_count
  if (!Number.isSafeInteger(miembros) || miembros < 1 || !Number.isSafeInteger(conectados) || conectados < 0) {
    throw new Error('La invitación no trae las cifras del servidor.')
  }
  return { miembros, conectados: Math.min(conectados, miembros) }
}
