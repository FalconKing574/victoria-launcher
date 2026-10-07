import { json, leerManifiesto } from '../../lib/manifiesto.js'

/**
 * GET /api/normas → las normas del servidor, las mismas que acepta el jugador en
 * el launcher. Salen del manifiesto del modpack, así que se editan en un solo
 * lugar (scripts/build-manifest.mjs del launcher) y la web no se desactualiza.
 */
export async function onRequestGet() {
  try {
    const manifiesto = await leerManifiesto()
    if (!manifiesto.normas?.secciones?.length) throw new Error('sin normas')
    return json(manifiesto.normas, 300)
  } catch {
    return json({ error: 'No se pudieron cargar las normas ahora.' }, 60, 502)
  }
}
