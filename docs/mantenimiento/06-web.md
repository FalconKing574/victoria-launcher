# La web

La web pública de Victoria Kingdom: portada, guía de instalación, normas,
novedades y privacidad, más la wiki (ver `web/README.md`). Está en Cloudflare
Pages, **gratis**, y tiene el mismo aspecto que el launcher (rojo Victoria,
Outfit, botones en mayúsculas, JUGAR en verde).

La portada sigue el modelo de la de GrandRP (contador «en línea» arriba, título
enorme sobre las capturas, «Cómo empezar a jugar» en pasos, galería) y la guía
el de la wiki de Majestic (categorías a la izquierda, artículo, ficha a la
derecha). Pedido del dueño el 07-10-2026. Al costado del título hubo una tarjeta
con el estado del servidor y no le gustó: el contador de la cabecera y las
cifras de más abajo ya lo dicen.

## Qué hay dónde

```
web/
  wrangler.toml          nombre del proyecto en Cloudflare: victoriakingdom
  generar-paginas.mjs    cabecera, pie y novedades de cada página (ver abajo)
  generar-wiki.mjs       la wiki y los sitemaps (web/README.md)
  public/                lo que se sirve tal cual
    index.html           portada: sistemas, tu historia, pasos, galería,
                         novedades y preguntas frecuentes
    guia.html            instalar, cuenta, SmartScreen, antivirus, problemas,
                         contraseña, registros, desinstalar
    normas.html          las normas (leídas del manifiesto) y las sanciones
    novedades.html       todas las novedades, con filtro y fecha
    privacidad.html      qué datos usan el launcher y la web (PRIVACIDAD.md)
    404.html             «Esta calle no existe en Victoria»
    estilos.css          todo el estilo; los colores en :root, los del launcher
    app.js               lo que se mueve o se carga solo (sin compilar)
    iconos.svg           los íconos, los mismos trazos que el launcher
    datos/novedades.json las novedades: las leen la web Y el launcher
    datos/capturas.json  la galería (la escribe importar-capturas.mjs)
    site.webmanifest     nombre e íconos al guardar la web en el celular
    img/  fonts/  _headers  robots.txt  sitemap*.xml  wiki/
  functions/
    _middleware.js       dominios, redirecciones y robots.txt (web/README.md)
    api/estado.js        /api/estado: ping al servidor de Minecraft, caché 30 s
    api/modpack.js       /api/modpack: cuántos mods, Minecraft, Forge, versión
    api/normas.js        /api/normas: las normas del manifiesto
    api/launcher.js      /api/launcher: la última versión publicada en GitHub
    api/discord.js       /api/discord: miembros y conectados del Discord
  lib/                   código de las funciones, con tests
    ping.ts              tests/web-ping.test.ts
    manifiesto.js        tests/web-api.test.js
    discord.js           tests/web-api.test.js
```

### Lo que se repite en las páginas lo escribe un script

La cabecera con el menú del celular, el pie (con el aviso de descarga y el
botón de volver arriba) y las novedades están escritos una sola vez, en
`web/generar-paginas.mjs`. En cada página van entre marcadores:

```html
<!-- comun:cabecera -->
…lo escribe el script: no editar a mano…
<!-- /comun:cabecera -->
```

Después de cambiar el menú, el pie o `datos/novedades.json`:

```bash
node web/generar-paginas.mjs
```

`tests/web-paginas.test.js` falla si una página quedó distinta de lo que
escribiría el script, si un enlace interno lleva a una sección que no existe,
si falta un ícono o una imagen, o si un enlace a la wiki no es un artículo.

Sin frameworks ni paso de compilación: HTML, CSS y un `app.js`. Lo que cambia
solo (jugadores en línea, cantidad de mods, normas) se pide a las funciones; si
alguna falla, queda lo escrito en el HTML o un aviso, **nunca un número
inventado**.

## Verla en tu PC

```bash
npm run web:ver
```

Abre http://localhost:8788. Es el mismo servidor que usa Cloudflare, funciones
incluidas.

## Publicarla

Gratis, en Cloudflare Pages conectado al repo de GitHub: cada cambio que llega a
`main` se publica solo, sin comandos. Lo configura el dueño con su cuenta de
Cloudflare (la misma del bucket R2); una IA no debe pedir ni escribir esa
contraseña.

1. La web tiene que estar en `main`, que es la rama que publica Cloudflare.
   Pasar cambios a `main` no publica el launcher: eso sólo lo hace un tag `v*`
   (`.github/workflows/publicar.yml`).
2. En dash.cloudflare.com: Workers & Pages → Create → **pestaña Pages** (si no
   aparece, el enlace de abajo «Looking to deploy Pages? Get started») → Import
   an existing Git repository → elegir `FalconKing574/victoria-launcher`.

   Ojo: la pantalla de Create abre por defecto en **Workers**, y por ahí sale un
   Worker (dirección `…/workers/services/view/…` en el panel), no un proyecto de
   Pages. El Worker no sirve con esta web: publica mal y queda con la dirección
   `<nombre>.<subdominio-de-la-cuenta>.workers.dev`. Pasó el 07-10-2026; se borra
   en el Worker → Settings → Delete.
3. Configuración del proyecto:

   | Campo | Valor |
   |---|---|
   | Project name | `victoriakingdom` (el mismo `name` de `web/wrangler.toml`) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | vacío (si obliga a poner algo: `exit 0`) |
   | Build output directory | `public` |
   | Root directory (en Advanced) | `web` |

4. Save and Deploy. En un minuto queda en https://victoriakingdom.pages.dev.

Después, cada push a `main` la vuelve a publicar (el plan gratis da 500
publicaciones por mes). Los cambios de la web se preparan en una rama y el
agente abre él mismo el PR a `main` (el dueño lo autorizó el 07-10-2026); el
dueño lo fusiona y Cloudflare publica. Las demás ramas generan una vista previa con su propia
dirección; si no hace falta, se apaga en Settings → Builds → Branch control.

**No mezclar los dos caminos:** un proyecto creado desde la consola (abajo) no
se puede conectar a GitHub después; habría que crear otro, con otra dirección.

### Desde la consola (alternativa)

Sin conectar GitHub, desde la PC del dueño:

```bash
npx wrangler login                                                 # abre el navegador
npx wrangler pages project create victoriakingdom --production-branch main
npm run web:publicar                                               # cada vez que cambie algo
```

`web:publicar` sube `web/public` y `web/functions` a producción (`--branch main`,
aunque estés en otra rama de git).

**Verifica lo publicado**, no el archivo local:

```bash
curl https://victoriakingdom.pages.dev/api/estado    # {"enLinea":true,...} con el servidor prendido
curl https://victoriakingdom.pages.dev/api/modpack   # la cantidad de mods del manifiesto vivo
curl https://victoriakingdom.pages.dev/api/normas    # las normas
```

Y abre la portada: el contador de arriba tiene que mostrar los jugadores.

### Si la dirección no es victoriakingdom.pages.dev

Si el nombre está tomado, Cloudflare da otro. Hay que cambiar la dirección en
las etiquetas `og:image` de `index.html`, `guia.html` y `normas.html` (busca
`victoriakingdom.pages.dev`): es la imagen que se ve al pegar el enlace en
Discord o WhatsApp, y tiene que ir completa.

Un dominio propio (`victoriakingdom.com`) se conecta en el panel de Cloudflare →
Workers & Pages → el proyecto → Custom domains. Cuesta lo que cueste el dominio
(unos 10 USD al año); la web sigue siendo gratis.

### Lo que da el plan gratis

Los archivos (HTML, imágenes) no tienen límite de visitas. Las funciones tienen
100.000 pedidos por día: cada visita usa uno o dos, más uno por minuto mientras
la portada está abierta. Sobra para un servidor como este.

## Cambiar el contenido

| Qué | Dónde |
|---|---|
| Novedades | `web/public/datos/novedades.json`: `id` (minúsculas y guiones, es el ancla), `fecha` (`AAAA-MM-DD`), `etiqueta`, `color` (sólo tiñe el texto de la etiqueta), `imagen`, `titulo`, `texto` y, opcionales, `detalle` (lista), `enlace` y `textoEnlace`. Después, `node web/generar-paginas.mjs`. **El launcher lee el mismo archivo** para la pantalla Jugar (las tres más nuevas): lo que se publique ahí lo ve todo el mundo al abrirlo |
| Preguntas frecuentes | Los `<details class="pregunta">` de `index.html`. El JSON-LD (FAQPage) lo escribe `generar-paginas.mjs` con el mismo texto: no se edita a mano |
| Sistemas y «Tu historia» | `index.html`, secciones `#sistemas` e `#historia`. El detalle de cada sistema está en la wiki, así que cada panel enlaza a su artículo |
| Sanciones | `normas.html`, sección `#sanciones`: la escalera la decide VictoriaAuth (`sanciones.escalera` de su config). Si cambia allá, cambia acá |
| Privacidad | `privacidad.html` repite `PRIVACIDAD.md` (lo muestra el instalador) más lo de la web: si cambia uno, cambia el otro |
| Capturas de la galería y de la portada | `node scripts/importar-capturas.mjs …` (ver `src/renderer/src/assets/capturas/LEEME.md`). El orden manda: las 4 primeras rotan en la portada, la 5.ª abre el «video», la 1.ª es la imagen al compartir. Los pies de foto también se pueden corregir a mano en `datos/capturas.json` |
| Imágenes de las tarjetas de Novedades | `node scripts/tarjetas-novedades.mjs servidor.png comunidad.png modpack.png` |
| Capturas del launcher en los pasos | `web/public/img/launcher/` (sacadas de la vista previa del renderer, sin la barra de título) |
| Normas | en el manifiesto, como siempre: la web las toma sola |
| Mods, Minecraft, Forge | salen del manifiesto solos. El HTML trae valores de respaldo (117, 1.20.1, 47.4.0) para cuando la función falla: actualízalos si cambian mucho |
| IP o puerto del servidor | `web/functions/api/estado.js` **y** `src/main/config.ts` del launcher |
| Enlace de descarga y de Discord | `DESCARGA` y `DISCORD` en `web/generar-paginas.mjs`, y además en los botones de cada página: busca `releases/download/instalador` y `discord.gg/`. El test avisa si alguno quedó distinto. La invitación del contador del Discord está en `web/lib/discord.js` |
| Cabecera, menú del celular y pie | `MENU`, `MENU_MOVIL` y `PIE` en `web/generar-paginas.mjs`, y correr el script |
| Una página nueva | Cinco lugares: el HTML con sus marcadores, `PAGINAS` en `generar-paginas.mjs`, el sitemap en `generar-wiki.mjs`, `paginaWeb` en `functions/_middleware.js` (si no, la copia de pages.dev no redirige) y la lista de `tests/web-seo.test.js` |
| Colores | `web/public/estilos.css` → `:root`. Son los del launcher (`theme/tokens.css`): si cambia uno, cambia el otro |

## Textos: Victoria es un país

Victoria es **un país, el Reino de Victoria, no sólo una ciudad** (lo recordó el
dueño el 07-10-2026). En los textos se habla de «Victoria», «el país» o «el
reino»; «ciudad» sólo para un lugar concreto dentro de él. Las normas del
manifiesto ya lo dicen así: «Tu personaje vive en el Reino de Victoria».

La web trata de «tú», como escribe el dueño.

## Animaciones

Todas en CSS (keyframes y transiciones) más `IntersectionObserver` en `app.js`
para que aparezcan al hacer scroll. Lo que hay: el título que sube palabra por
palabra, las capturas de la portada fundiéndose con acercamiento lento, la cinta
que desfila, contadores que cuentan hasta su valor, el conector de los pasos que
se llena de rojo al bajar, la galería con visor (teclado y dedo) y el aviso de
SmartScreen dibujado con un cursor que hace los dos clics.

Con «reducir movimiento» activado en Windows o en el celular, todo queda quieto
y en su lugar: no hay presentación ni contadores.

### Rendimiento

El dueño pidió una web más liviana (07-10-2026) y se sacaron las animaciones que
gastaban procesador todo el tiempo, aunque nadie tocara nada: chispas dibujadas
en un `<canvas>` a 60 cuadros por segundo, grano de película, una marca de agua
gigante que desfilaba, una segunda cinta cruzada, paralaje con el mouse, un
brillo que seguía al cursor, latidos hechos con `box-shadow`, palabras de fondo
que se corrían con el scroll y el desenfoque (`backdrop-filter`) de la
cabecera. Con la portada quieta, el navegador pasó de trabajar 178 ms por
segundo a 13 en escritorio, y de 184 a 7 en celular. Bajando por toda la página,
alrededor de un 40 % menos.

Reglas para lo que se agregue:

- Lo que se mueve sin parar, sólo con `transform` u `opacity`: el navegador lo
  anima sin recalcular la página. Nunca `width`, `height`, `max-height`, `top` o
  `box-shadow` en bucle.
- Nada de `backdrop-filter` encima de algo que se mueve.
- Nada de dibujar en un `<canvas>` en cada cuadro.
- Para comparar, la medición es la de `Performance.getMetrics` de Chrome con la
  portada quieta 6 s (`TaskDuration`).

## Trampas

- **Un número que no llega no se inventa.** Jugadores, plazas, mods, la versión
  del launcher y del modpack y la gente del Discord salen de `/api/...`. Si
  alguna falla, queda el guion o el valor escrito en el HTML, y la línea del
  Discord directamente no aparece. Cualquier cifra nueva sigue la misma regla.
- **Las pestañas de Sistemas sin JavaScript.** Sin JS no hay pestañas: se ven los
  seis paneles seguidos, cada uno con su etiqueta. Por eso las pestañas y la
  etiqueta se muestran o esconden con `.js` en el CSS, no con `hidden` en el HTML.

- **El ping colgaba la página.** Con la máquina del servidor apagada o la red
  cortada, abrir la conexión no falla: se queda esperando (más de 40 s en la
  prueba). El límite de 4 s de `consultarEstado` cubre todo, conexión incluida,
  y tiene test.
- **La fecha de `compatibility_date`** de `wrangler.toml` no puede ser más nueva
  que la que soporta el wrangler instalado: `web:ver` no arranca.
- **Nada puede ser más ancho que la pantalla.** Las palabras gigantes de fondo y
  la cinta girada lo son: van recortadas (`.seccion { overflow-x: clip }`,
  `.cintas { overflow: hidden }`). Sin eso, en el celular la página se arrastraba
  de costado.
- **Quedó un `victoria-launcher` viejo sin borrar** en Cloudflare (07-10-2026):
  el Worker o el proyecto de Pages del primer intento. Si aparece una
  publicación fallida o una copia de la web en `victoria-launcher.pages.dev`,
  es eso; la web de verdad es el proyecto `victoriakingdom`.
- **`404.html` usa rutas absolutas** (`/estilos.css`): se sirve en cualquier
  dirección que no exista, también en `/algo/otra-cosa`.
- **Los íconos (`<use href="iconos.svg#…">`) llevan los atributos de trazo en
  cada `<symbol>`**: lo que clona `<use>` hereda del `<use>`, no del `<g>` donde
  estaba el símbolo.
