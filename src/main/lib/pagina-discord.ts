import logo from '../../renderer/src/assets/logo.png?inline'

/**
 * La página que ve el jugador en el navegador cuando Discord lo devuelve.
 *
 * Es lo último que ve antes de volver al launcher, así que tiene que parecer de
 * Victoria (tricolor, logo, oro) y decir UNA cosa: qué hacer ahora.
 *
 * No dice "Discord vinculado": en este momento sólo llegó la autorización. El
 * vínculo lo termina el launcher con el servidor unos segundos después, y puede
 * fallar (Discord ya usado por otra cuenta, por ejemplo). Prometer algo que
 * todavía no pasó es peor que no decirlo.
 *
 * El logo va adentro en base64: la página la sirve una escucha de un solo uso
 * que se cierra al contestar, así que no puede pedir nada más después.
 */

export type EstadoPagina = 'ok' | 'cancelado' | 'ajeno' | 'error'

const TEXTOS: Record<EstadoPagina, { titulo: string; texto: string; paso: string }> = {
  ok: {
    titulo: '¡Listo! Volvé al launcher',
    texto: 'Discord nos dio el permiso. El launcher termina de vincular tu cuenta en unos segundos.',
    paso: 'Te espera el siguiente paso: las normas de Victoria.'
  },
  cancelado: {
    titulo: 'No se vinculó',
    texto: 'Cancelaste la autorización en Discord.',
    paso: 'Volvé al launcher y tocá «Vincular Discord» para intentarlo de nuevo.'
  },
  ajeno: {
    titulo: 'Este enlace no es del launcher',
    texto: 'La autorización no coincide con la que pidió tu launcher, así que no se usó.',
    paso: 'Volvé al launcher y tocá «Vincular Discord» desde ahí.'
  },
  error: {
    titulo: 'Discord no devolvió la autorización',
    texto: 'Algo salió mal del lado de Discord.',
    paso: 'Volvé al launcher y probá de nuevo en un momento.'
  }
}

const SELLOS: Record<'ok' | 'mal', string> = {
  ok: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  mal: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5c6c" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
}

export function paginaDiscord(estado: EstadoPagina): string {
  const t = TEXTOS[estado]
  const bien = estado === 'ok'
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Victoria Kingdom · Discord</title>
<style>
  :root { --rojo:#CE2233; --azul:#2A3786; --oro:#F2A71B; --fondo:#0b0b10; --panel:#14141d; --texto:#f4f4f7; --tenue:#a1a1b5; }
  * { box-sizing:border-box; }
  html, body { margin:0; min-height:100%; }
  body {
    font-family:"Segoe UI", system-ui, -apple-system, sans-serif; color:var(--texto);
    background:radial-gradient(900px 520px at 50% -8%, rgba(42,55,134,.42), transparent 62%), var(--fondo);
    display:grid; place-items:center; min-height:100vh; padding:32px 20px;
  }
  .bandera { position:fixed; inset:0 0 auto 0; height:6px;
    background:linear-gradient(90deg, var(--rojo) 0 33.34%, #fff 33.34% 66.67%, var(--azul) 66.67% 100%); }
  .tarjeta { width:min(460px, 100%); background:var(--panel); border:1px solid rgba(255,255,255,.08);
    border-radius:18px; padding:30px 30px 26px; text-align:center; box-shadow:0 30px 80px rgba(0,0,0,.55);
    animation:entra .35s ease-out both; }
  @keyframes entra { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .logo { display:block; width:230px; max-width:78%; margin:0 auto 20px; image-rendering:pixelated; }
  .sello { width:62px; height:62px; margin:0 auto 16px; border-radius:50%; display:grid; place-items:center;
    background:${bien ? 'rgba(61,220,132,.12)' : 'rgba(255,92,108,.12)'};
    border:2px solid ${bien ? 'rgba(61,220,132,.7)' : 'rgba(255,92,108,.7)'}; }
  h1 { margin:0 0 8px; font-size:22px; letter-spacing:-.2px; }
  p { margin:0; color:var(--tenue); font-size:14.5px; line-height:1.6; }
  .paso { margin-top:22px; padding:12px 14px; border-radius:12px; font-size:14px; line-height:1.5; color:var(--texto);
    background:rgba(242,167,27,.08); border:1px solid rgba(242,167,27,.28); }
  .paso b { color:var(--oro); }
  .pie { margin-top:18px; font-size:12px; color:#6b6b80; }
</style>
</head>
<body>
  <div class="bandera"></div>
  <main class="tarjeta">
    <img class="logo" src="${logo}" alt="Victoria Kingdom">
    <div class="sello">${bien ? SELLOS.ok : SELLOS.mal}</div>
    <h1>${t.titulo}</h1>
    <p>${t.texto}</p>
    <div class="paso"><b>→</b> ${t.paso}</div>
    <p class="pie">Ya podés cerrar esta pestaña.</p>
  </main>
</body>
</html>`
}
