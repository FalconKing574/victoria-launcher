# La web

La web pública de Victoria Kingdom: portada, guía de instalación y normas. Está
en Cloudflare Pages, **gratis**, y tiene el mismo aspecto que el launcher (rojo
Victoria, Outfit, botones en mayúsculas, JUGAR en verde).

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
  public/                lo que se sirve tal cual
    index.html           portada
    guia.html            instalar, cuenta, SmartScreen, antivirus, problemas
    normas.html          las normas, leídas del manifiesto
    404.html             «Esta calle no existe en Victoria»
    estilos.css          todo el estilo; los colores en :root, los del launcher
    app.js               lo que se mueve o se carga solo (sin compilar)
    iconos.svg           los íconos, los mismos trazos que el launcher
    datos/novedades.json las tarjetas de Novedades
    datos/capturas.json  la galería (la escribe importar-capturas.mjs)
    img/  fonts/  _headers  robots.txt
  functions/api/         funciones de Cloudflare
    estado.js            /api/estado: ping al servidor de Minecraft, caché 30 s
    modpack.js           /api/modpack: cuántos mods, Minecraft, Forge
    normas.js            /api/normas: las normas del manifiesto
  lib/                   código de las funciones, con tests
    ping.ts              tests/web-ping.test.ts
    manifiesto.js        tests/web-api.test.js
```

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

La primera vez (lo hace el dueño: una IA no debe pedir ni escribir la
contraseña de Cloudflare):

```bash
npx wrangler login                                                 # abre el navegador
npx wrangler pages project create victoriakingdom --production-branch main
```

Después, cada vez:

```bash
npm run web:publicar
```

Publica `web/public` y `web/functions` en producción (`--branch main`, aunque
estés en otra rama de git). Queda en https://victoriakingdom.pages.dev.

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
| Novedades | `web/public/datos/novedades.json`: `etiqueta`, `color` (sólo tiñe el texto de la etiqueta), `imagen`, `titulo`, `texto` y, opcional, `enlace` y `textoEnlace` |
| Capturas de la galería y de la portada | `node scripts/importar-capturas.mjs …` (ver `src/renderer/src/assets/capturas/LEEME.md`). El orden manda: las 4 primeras rotan en la portada, la 5.ª abre el «video», la 1.ª es la imagen al compartir. Los pies de foto también se pueden corregir a mano en `datos/capturas.json` |
| Imágenes de las tarjetas de Novedades | `node scripts/tarjetas-novedades.mjs servidor.png comunidad.png modpack.png` |
| Capturas del launcher en los pasos | `web/public/img/launcher/` (sacadas de la vista previa del renderer, sin la barra de título) |
| Normas | en el manifiesto, como siempre: la web las toma sola |
| Mods, Minecraft, Forge | salen del manifiesto solos. El HTML trae valores de respaldo (117, 1.20.1, 47.4.0) para cuando la función falla: actualízalos si cambian mucho |
| IP o puerto del servidor | `web/functions/api/estado.js` **y** `src/main/config.ts` del launcher |
| Enlace de descarga y de Discord | repetidos en las cuatro páginas: busca `releases/download/instalador` y `discord.gg/` |
| Cabecera, menú del celular y pie | repetidos en las cuatro páginas (index, guia, normas, 404): un cambio va en las cuatro |
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
- **`404.html` usa rutas absolutas** (`/estilos.css`): se sirve en cualquier
  dirección que no exista, también en `/algo/otra-cosa`.
- **Los íconos (`<use href="iconos.svg#…">`) llevan los atributos de trazo en
  cada `<symbol>`**: lo que clona `<use>` hereda del `<use>`, no del `<g>` donde
  estaba el símbolo.
