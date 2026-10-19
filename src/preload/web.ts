/**
 * La web de Victoria, en un solo lugar para el launcher.
 *
 * La usan el proceso principal (las novedades de Jugar se leen de la web) y la
 * interfaz (los enlaces de ayuda), como `tuning.ts`. Si la web cambia de
 * dirección, se cambia acá; el resto de las direcciones de la web está en
 * web/README.md.
 */
export const WEB = 'https://victoriakingdom.com'

/** Las novedades: el mismo archivo que pinta la portada de la web. */
export const NOVEDADES_JSON = `${WEB}/datos/novedades.json`

export const ENLACES_WEB = {
  guia: `${WEB}/guia`,
  preguntas: `${WEB}/#preguntas`,
  normas: `${WEB}/normas`,
  novedades: `${WEB}/novedades`,
  privacidad: `${WEB}/privacidad`,
  wiki: 'https://wiki.victoriakingdom.com/wiki'
} as const
