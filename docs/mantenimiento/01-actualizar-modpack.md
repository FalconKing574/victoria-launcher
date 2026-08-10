# Actualizar el modpack

El modpack son los mods, las configuraciones, los shaders y el resource pack.
Vive en Cloudflare R2 y llega a los jugadores cuando pulsan JUGAR.

## 1. Mira en qué versión está

```bash
node -e "fetch('https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json',{cache:'no-store'}).then(r=>r.json()).then(m=>console.log(m.packVersion))"
```

La versión nueva tiene que ser **mayor**. Si publicas con la misma o una menor,
los launchers creen que están al día y no descargan nada.

## 2. Edita la instancia fuente

```
C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho
```

| Qué quieres cambiar | Dónde |
|---|---|
| Añadir/quitar un mod | `mods/` |
| Configuración de un mod | `config/` |
| Menú del servidor (FancyMenu) | `config/fancymenu/customization/` |
| Shaders | `shaderpacks/` |
| Resource packs | `resourcepacks/` |
| Armas TaCZ | `tacz/` |

Se puede abrir esa instancia en CurseForge para probar los cambios antes de
publicar. Es el mismo pack que reciben los jugadores.

## 3. Si tocas los mods opcionales

Dos archivos, y hay que tocar los dos:

**`scripts/build-manifest.mjs` → `OPTIONAL`** — qué mods son opcionales:

```js
{
  id: 'forgematica',                          // identificador estable
  name: 'Forgematica',
  summary: 'Lo que ve el jugador en la tarjeta.',
  category: 'rendimiento' | 'calidad-de-vida' | 'visual',
  filename: 'Forgematica-0.1.13-mc1.20.1.jar', // EXACTO, tal cual en mods/
  image: 'https://...'
}
```

> El `.jar` **tiene que existir** en el `mods/` de la instancia. Si no, el
> manifiesto lo publica con `sha1: ''` y el jugador lo ve en la lista pero no
> puede instalarlo. Ya pasó con Xaero's Minimap y Nvidium.

**`src/main/ipc/sync.ts` → `DEFAULT_OPTIONAL`** — cuáles vienen activados:

```ts
const DEFAULT_OPTIONAL = ['distant-horizons', 'xaeros-world-map']
```

Solo afecta a instalaciones nuevas. A quien ya juega no le cambia nada.

Cambiar `DEFAULT_OPTIONAL` es código del launcher → hay que publicar también una
versión nueva del launcher ([`02-actualizar-launcher.md`](02-actualizar-launcher.md)).

## 3.5. Si SOLO cambian versiones de mods, no uses build-manifest

Es el caso más habitual: actualizas mods en CurseForge y nada más.

```bash
node scripts/update-mods-only.mjs --version 1.6.1            # enseña qué haría
node scripts/update-mods-only.mjs --version 1.6.1 --publish  # sube
```

Parte del manifiesto **vivo** y solo sustituye las entradas cuya versión cambió.
Los `overrides-*.zip` no se tocan.

**Por qué importa:** `build-manifest.mjs` regenera los tres zips, y un zip no
sale byte a byte igual dos veces. Sus sha1 cambiarían aunque el contenido sea
idéntico, y el launcher —que compara por hash— le haría bajar **697 MB a cada
jugador** por una actualización de 49 MB de jars.

El script **aborta** si aparece un mod nuevo o desaparece uno: eso ya no es una
subida de versiones y toca `build-manifest.mjs`.

### Cuidado con las builds de NeoForge

Este pack es **Forge 47.4.0**. Varios mods publican dos archivos casi iguales,
`..._FORGE_...` y `..._NEOFORGE_...`, y CurseForge puede darte el que no es al
actualizar. El de NeoForge lleva dentro `modId="neoforge"`, que Forge no
proporciona: lo trata como dependencia obligatoria ausente y **el juego no
arranca**. Ya pasó con `EnhancedVisuals_NEOFORGE_v1.8.30`.

`EXCLUDED` lleva `NEOFORGE` como red de seguridad, pero comprueba lo que instalas:

```bash
unzip -p "ruta/al/mod.jar" META-INF/mods.toml | grep -E 'modId|loaderVersion'
```

## 4. Genera el manifiesto (solo si añades o quitas mods, o tocas configs)

```bash
node scripts/build-manifest.mjs --version 1.0.7 --repo FalconKing574/victoria-launcher
```

Regenera `dist-modpack/` entera. Si has quitado mods, borra la carpeta antes
para que no queden `.jar` viejos:

```bash
rm -rf dist-modpack
```

Lee la salida. Avisa de mods opcionales sin `.jar` y de cuánto excluye.

## 5. Publica en R2

```bash
node scripts/publish-modpack-r2.mjs
```

Necesita sesión de wrangler. Si falla, mira [`04-trampas.md`](04-trampas.md) —
`wrangler whoami` devuelve éxito aunque no haya sesión.

## 6. Verifica — no te saltes esto

```bash
node -e "fetch('https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json',{cache:'no-store'}).then(r=>r.json()).then(m=>{console.log('packVersion',m.packVersion);console.log('requeridos',m.mods.length);m.optional.forEach(o=>console.log(' ',o.id,o.sha1?'ok':'SIN HASH'));})"
```

Comprueba:
- [ ] `packVersion` es el nuevo
- [ ] ningún opcional dice `SIN HASH`
- [ ] el número de mods requeridos es el que esperas

Si has cambiado configs, mira **dentro del zip publicado**, no solo el archivo
fuente:

```bash
unzip -p dist-modpack/overrides-3.zip "config/fancymenu/options.txt" | grep modpack_mode
```

## Qué se envía y qué no

`scripts/build-manifest.mjs`:

```js
const OVERRIDE_DIRS = ['config', 'resourcepacks', 'shaderpacks', 'resources', 'tacz']

const OVERRIDE_EXCLUDE = [
  'resources/videos',            // 726 MB duplicados de config/fancymenu/assets/videos
  'config/oculus.properties'     // lo gestiona la pestaña Shaders del launcher
]

const EXCLUDED = ['Essential_']  // mods que no se envían, por subcadena del nombre
```

**Nunca metas en los overrides un archivo que el jugador controla.** Se extraen
sobrescribiendo, así que le borrarías sus ajustes en cada actualización. Por eso
`options.txt` (teclas, vídeo, volumen) no viaja nunca dentro del pack: el
launcher solo le añade la línea del resource pack de Victoria.

## Por qué son varios .zip

wrangler rechaza subidas de más de 300 MiB y las configs pesan ~684 MB, así que
el generador las reparte en partes de ≤260 MB. El launcher guarda el hash de
**cada parte** y solo baja las que cambiaron: un cambio de config cuesta 164 MB,
no 684 MB. No juntes las partes en un solo archivo.
