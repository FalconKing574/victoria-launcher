/**
 * El manifiesto del modpack, el mismo que lee el launcher. De ahí salen las
 * normas (`/api/normas`) y los números del modpack (`/api/modpack`), así que
 * la web nunca dice algo distinto de lo que instala el launcher.
 *
 * Se pide desde las funciones y no desde el navegador porque el bucket de R2
 * no manda cabeceras CORS: el navegador no dejaría leerlo desde otra dirección.
 */
export const MANIFIESTO = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'

/** Cloudflare lo guarda 5 minutos: una visita no le pega a R2 cada vez. */
export async function leerManifiesto() {
  const r = await fetch(MANIFIESTO, { cf: { cacheTtl: 300, cacheEverything: true } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function json(cuerpo, segundos, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}`
    }
  })
}
