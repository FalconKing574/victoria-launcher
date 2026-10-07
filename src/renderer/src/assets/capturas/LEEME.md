# Capturas de la pantalla de cuenta

Las imágenes de esta carpeta van rotando de fondo en la pantalla de entrar y
crear cuenta (`components/ArteCapturas.tsx`). Se toman solas: no hay que tocar
código. Si no hay ninguna, se ve el arte fijo (`assets/victoria.png`).

No las copies a mano: las capturas del juego pesan 2-5 MB cada una. Usá el
script, que las pasa a JPEG de 1600 px (~250 KB) y reemplaza las anteriores:

```bash
node scripts/importar-capturas.mjs                  # la carpeta screenshots de la instancia
node scripts/importar-capturas.mjs "D:\mis capturas"
node scripts/importar-capturas.mjs a.png b.png c.png
```

Como mucho 12. Conviene armar una carpeta sólo con las que se quieran mostrar.

## También van a la web

El mismo script deja copias en `web/public/img/capturas/` (1920 px y
miniaturas de 720 px) y la lista `web/public/datos/capturas.json`, que es lo
que muestra la galería de la web. La primera captura es además la portada.

El pie de cada foto sale del nombre del archivo: renombrá «2026-10-07_00.53.23.png»
a «El palacio.png» antes de importarla. Con el nombre de Minecraft queda sin pie.

## Tarjetas de Novedades (pantalla Jugar y web)

Elegidas por el dueño el 07-10-2026:

| Tarjeta | Captura |
|---|---|
| Servidor | el palacio de día (fachada con columnas, cielo azul) |
| Comunidad | la plaza con los árboles y las banderas de Victoria |
| Modpack | la sastrería (trajes y reloj de pie) |

Se recortan con otro script, que las deja en `assets/news/` y en la web:

```bash
node scripts/tarjetas-novedades.mjs servidor.png comunidad.png modpack.png
```
