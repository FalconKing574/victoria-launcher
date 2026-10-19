/**
 * Las novedades de la pantalla Jugar, las mismas de la web.
 *
 * Antes estaban escritas a mano en Home.tsx y otra vez en la web, y cada una
 * contaba algo distinto. Ahora salen de `datos/novedades.json` de la web
 * (web/public/datos/novedades.json en este repo): se escriben una vez y se ven
 * en los dos lados. Lo puro está acá, con tests; la descarga, en
 * ipc/novedades.ts. Si no hay red, Jugar muestra las que trae el launcher.
 */

export interface Novedad {
  id: string
  /** AAAA-MM-DD */
  fecha: string
  etiqueta: string
  /** Sólo tiñe el texto de la etiqueta. `null` si no viene o no es un color. */
  color: string | null
  /** Dirección completa, siempre de la web: no se cargan imágenes de otro lado. */
  imagen: string
  titulo: string
  texto: string
  /** La novedad entera, en la página de novedades de la web. */
  enlace: string
}

const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/**
 * Lo que llegó de la web, ya revisado: las `maximo` más nuevas. Una novedad mal
 * escrita se salta, no tira abajo las demás; si no queda ninguna, `null`, y la
 * pantalla usa las suyas.
 */
export function leerNovedades(datos: unknown, web: string, maximo = 3): Novedad[] | null {
  if (!Array.isArray(datos)) return null
  const origen = new URL(web).origin
  const lista: Novedad[] = []
  for (const n of datos as Array<Record<string, unknown>>) {
    if (!n || typeof n !== 'object') continue
    const { id, fecha, etiqueta, imagen, titulo, texto: cuerpo, color } = n
    if (!texto(id) || !/^[a-z0-9-]+$/.test(id)) continue
    if (!texto(fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue
    if (!texto(etiqueta) || !texto(titulo) || !texto(cuerpo) || !texto(imagen)) continue
    let url: URL
    try {
      url = new URL(imagen, `${origen}/`)
    } catch {
      continue
    }
    if (url.origin !== origen) continue
    lista.push({
      id,
      fecha,
      etiqueta: etiqueta.trim(),
      color: typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color) ? color : null,
      imagen: url.href,
      titulo: titulo.trim(),
      texto: cuerpo.trim(),
      enlace: `${origen}/novedades#${id}`
    })
  }
  lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return lista.length ? lista.slice(0, maximo) : null
}
