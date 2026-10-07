import { json, leerManifiesto } from '../../lib/manifiesto.js'

/**
 * GET /api/modpack → cuántos mods instala el launcher y con qué versiones.
 *
 * Es lo que muestran las cifras de la portada: contadas del manifiesto vivo, no
 * escritas a mano, para que no queden viejas cuando se suman mods.
 */
export async function onRequestGet() {
  try {
    const m = await leerManifiesto()
    if (!Array.isArray(m.mods)) throw new Error('sin mods')
    return json(
      {
        version: m.packVersion ?? null,
        minecraft: m.minecraft ?? null,
        forge: m.forge ?? null,
        mods: m.mods.length,
        opcionales: Array.isArray(m.optional) ? m.optional.length : 0
      },
      300
    )
  } catch {
    return json({ error: 'No se pudo leer el modpack ahora.' }, 60, 502)
  }
}
