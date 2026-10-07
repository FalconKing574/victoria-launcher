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
