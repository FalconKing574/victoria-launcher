# Trampas

Fallos que ya han pasado en este proyecto. Casi todos llegaron a los jugadores.
Cada uno explica el síntoma, la causa y qué no volver a hacer.

## Publicar

### La release en borrador es invisible

**Síntoma:** publicas, la release se ve en GitHub, nadie recibe nada.
**Causa:** electron-builder publica borradores por defecto, y el actualizador
solo ve releases publicadas.
**Ya está puesto:** `releaseType: release` en `electron-builder.yml`. No lo quites.
**Comprueba:** `draft: false` en la verificación del paso 5.

### `owner` con el usuario de Windows

**Síntoma:** el launcher busca actualizaciones en un repo que no existe.
**Causa:** el `owner` acabó siendo `FalconKingman` (usuario de Windows) en vez de
`FalconKing574` (usuario de GitHub).
**Cómo se detectó:** leyendo `app-update.yml` **dentro del build empaquetado**,
no el archivo de configuración. Haz siempre eso.

```bash
cat release/win-unpacked/resources/app-update.yml
```

### Firma de código

**Síntoma:** `New version X is not signed by the application owner`, y ninguna
actualización se instala.
**Causa:** se añadió `publisherName` para calmar al antivirus, y electron-updater
empezó a exigir firma en algo que no está firmado.
**Ya está puesto:** `verifyUpdateCodeSignature: false`. Ponlo a `true` **solo**
el día que el instalador esté firmado de verdad.

### Publicar sin la URL del manifiesto

**Síntoma:** el launcher se instala y dice que no hay modpack.
**Causa:** `VICTORIA_MANIFEST_URL` se compila dentro del binario. Una app
empaquetada no tiene `.env` ni shell, así que `process.env` está vacío en tiempo
de ejecución.
**Ya está puesto:** el valor por defecto de `electron.vite.config.ts` es el
bucket R2 real. Antes apuntaba a un asset de GitHub que devuelve **404**, así que
olvidar la variable no daba un error: daba un launcher que le decía a todo el
mundo que no había modpack. Sigue pasando la variable si publicas a otro sitio,
pero olvidarla ya no rompe nada.
**Comprueba:** `grep -o "manifest.json" out/main/index.js` después de compilar.

### Un solo archivo que falta deja el modpack sin instalar

**Síntoma:** el launcher repite «hay N archivos por descargar» para siempre y no
actualiza nunca. Pasó de verdad: `victoriarp-1.9.0.jar` estaba en el manifiesto
pero **nunca se subió a R2** y devolvía 404, así que `performSync` reventaba
antes de guardar nada — y como no guarda, al siguiente intento vuelve a empezar.
**Regla:** después de publicar, comprueba que **todo** el manifiesto se descarga:

```bash
node -e "fetch('https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json',{cache:'no-store'}).then(r=>r.json()).then(async m=>{const malos=[];for(const e of [...m.mods,...m.optional,...m.overrides.map(o=>({filename:o.name,url:o.url,sizeBytes:o.sizeBytes}))]){const r=await fetch(e.url,{method:'HEAD'});if(!r.ok||Number(r.headers.get('content-length'))!==e.sizeBytes)malos.push(e.filename+' HTTP '+r.status)}console.log(malos.length?malos:'todo descargable')})"
```

`update-mods-only.mjs --publish` ya lo hace solo al terminar.

### Versión de modpack que no sube

**Síntoma:** publicas cambios, los launchers no descargan nada.
**Causa:** `packVersion` igual o menor que la que ya está viva.
**Regla:** consulta el manifiesto vivo antes de elegir número.

## wrangler / R2

### `wrangler whoami` miente

Devuelve código de salida **0 aunque no haya sesión iniciada**. Comprobar el
código de salida no sirve: hay que leer el texto de la salida.

### Nombres con espacios

`Immersive Vehicles-1.20.1-24.0.0.jar` reventó la subida en el archivo 52 de 118
porque el comando se ejecutaba con `shell: true` y el nombre se partía en dos.
`scripts/publish-modpack-r2.mjs` tiene una función `quote()` — úsala para
cualquier ruta que le pases a wrangler.

### Límite de 300 MiB

wrangler rechaza subidas más grandes. Por eso los overrides van en varias partes
de ≤260 MB. No las unifiques.

### `stdio: 'ignore'` esconde el error de verdad

Un fallo de subida salía como un error genérico inútil. Con `'pipe'` se ve el
mensaje real de wrangler.

## Lanzar el juego

### `cwd` tiene que ser igual a `gameDirectory`

**Síntoma:** el modpack se instala bien pero el juego arranca con el menú vanilla
y sin las configuraciones de los mods.
**Causa:** MCLC arranca Java con `cwd: overrides.cwd || options.root`, y Forge
resuelve `config/` **relativo al directorio de trabajo**, no a `--gameDir`. Sin
pasar `cwd`, las partidas y los resourcepacks iban a la instancia y todas las
configs de mods se leían de `<root>/config`, que estaba vacía.
**Ya está puesto** en `launch.ts`. Si tocas `overrides`, mantén los dos.

### No te fíes del `java` del PATH

En esta máquina `java -version` responde **Java 8**. Minecraft 1.20.1 arranca y
muere con un `UnsupportedClassVersionError` ilegible.
**Ya está puesto:** `ensureJava()` comprueba la versión de verdad ejecutando
`java -version` y descarga Temurin 17 si lo que hay no sirve.

### `client.launch()` puede devolver null

MCLC devuelve `null` sin lanzar excepción cuando no consigue crear el proceso, y
no emite `close`. Si no pones `running = false` ahí, todos los intentos
posteriores fallan con «el juego ya se está iniciando».

## Archivos del jugador

### Los overrides sobrescriben

Se extraen con overwrite. Cualquier archivo que el jugador controle tiene que
estar en `OVERRIDE_EXCLUDE` o se lo pisas en cada actualización.

Ya excluidos: `config/oculus.properties` (elección de shader).
Nunca incluido: `options.txt` (teclas, vídeo, volumen).

Los shaders que el jugador borra se apuntan en `shaders-removed.json` y se
vuelven a quitar después de aplicar los overrides, porque si no reaparecían.

### Borrar un shader era para siempre

**Síntoma:** «borré un shader y ya no vuelve».
**Causa:** dos cosas que juntas no dejaban salida — el archivo se destruía con
`rmSync`, y su nombre se quedaba en `shaders-removed.json`, que hace que cada
actualización del pack lo vuelva a quitar. No había interfaz para deshacerlo.
**Ya está puesto:** ahora se mueve a `minecraft\shaders-trash\` y la pantalla
Shaders tiene «Shaders que quitaste» con un botón Recuperar. Un shaderpack pesa
0,5-2,5 MB, así que guardarlo no cuesta nada.
**Ojo con los antiguos:** los que se borraron con la versión vieja no están en
la papelera. Salen igual en la lista, marcados como que vuelven en la próxima
actualización del pack — recuperarlos solo los saca de `shaders-removed.json`.

### Un shader que no se usa no debe estar en `shaderpacks/`

**Petición:** «cuando no esté en uso, que no esté cargándolo el Minecraft».
**Cómo está resuelto:** en `instance\shaderpacks\` queda **como mucho uno**, el
que está en uso. El resto se aparcan en `minecraft\shaders-library\`. Todo pasa
por `applySelection()` / `syncFilesToConfig()` en `ipc/shaders.ts`.
**No te saltes `pruneDeletedShaders()`:** cada actualización del pack extrae los
tres shaderpacks otra vez dentro de la instancia. Si no se vuelve a aparcar,
la carpeta acaba con todos y se pierde la garantía.
**Efecto secundario asumido:** el menú de shaders del juego solo enseña el que
está en uso. Es la consecuencia directa de lo pedido, y está avisado en la
pantalla («solo el que uses se carga en el juego»).

### La única forma de quitarse un shader era borrarlo

**Síntoma:** «tiene que haber una opción para que deje de estar en uso el shader,
pero sin eliminarlo».
**Causa:** la ficha del shader activo mostraba «En uso» con el botón
deshabilitado. Para jugar sin shaders había que encontrar el interruptor maestro
de arriba o darle a la papelera, que es destructivo y no era lo que se quería.
**Ya está puesto:** ese botón ahora pone «Dejar de usar» y apaga
`enableShaders`. No toca `shaderPack`, así que no se pierde nada.
**No lo cambies a borrar `shaderPack`:** perderías cuál usaba el jugador y al
reencender le tocaría otro shader distinto sin haberlo pedido. Hay un test que
lo fija (`tests/shaders-restore.test.ts`).

### En la interfaz es Oculus, nunca Iris

Las pantallas decían «Activar Iris» y «tienes que activar Iris». El pack no
lleva Iris: lleva **Oculus** (`oculus-mc1.20.1-1.8.0.jar`), que es el que lee
`config/oculus.properties`. Comprobado: no hay ningún jar de Iris ni en la
instancia ni en el manifiesto. No vuelvas a nombrar Iris en texto visible.

### `options.txt` no existe hasta que el juego arranca una vez

`ensureResourcePack()` se rendía si no encontraba el archivo, así que a todo
jugador nuevo se le descargaba el resource pack de Victoria y **nunca se le
activaba**. Ahora lo crea con la línea puesta.

### Rutas absolutas con nombre de usuario

Un `EPERM: operation not permitted, mkdir 'C:\Users\<otro>\curseforge\...'` dejó
a un jugador sin poder jugar. Todo sale de `app.getPath('userData')` vía
`src/main/lib/paths.ts`.

## Descargas

### No vuelvas a abrir un archivo para calcular su hash

**Síntoma:** `ENOENT: no such file or directory, open '...overrides-1.zip.part'`.
**Causa:** el archivo de 260 MB se descargaba y luego se reabría para hashearlo.
En esa ventana el antivirus se lo llevaba a cuarentena.
**Ya está puesto:** `src/main/lib/download.ts` hashea mientras bajan los bytes.
Usa ese módulo para cualquier descarga nueva.

### Descarga a `.part` y renombra

Escribir directo al destino final deja un archivo truncado si se corta la
conexión, y `existsSync` luego lo da por bueno para siempre.

### Un fallo en la última parte de los overrides costaba las tres

**Síntoma:** se corta la conexión aplicando `overrides-3.zip` y el siguiente
intento vuelve a bajar los 697 MB enteros.
**Causa:** los hashes de las partes solo se guardaban al terminar **todas**. Las
dos primeras ya estaban extraídas en disco y nadie se había enterado.
**Ya está puesto:** `applyOverrides` recibe un callback que escribe
`overrideParts` después de cada parte. `packVersion` y `managed` **no** avanzan
ahí: si avanzaran, un sync a medias se daría por completo.

### No bloquees el proceso principal con archivos grandes

El proceso principal es el mismo hilo que dibuja la ventana y responde al IPC.
Dos cosas ya lo congelaban:

- Hashear los 117 jars con `readFileSync` en cada comprobación → ahora es
  `mod-hashes.json` + streams (`hash-cache.ts`).
- Descomprimir 260 MB con `extractAllTo` síncrono → ahora `extractAllToAsync`.

**Regla:** en `src/main`, nada de `readFileSync` sobre archivos del modpack.
Streams o la variante async.

## Interfaz

### Las pantallas se desmontan al cambiar de pestaña

El estado que vive en un componente se pierde. Una descarga en curso parecía
detenida, y volver a pulsar JUGAR lanzaba un segundo sync sobre el primero.
**Regla:** cualquier cosa que sobreviva a un cambio de pestaña se guarda en el
proceso principal y se expone con un snapshot (`sync:live`), no solo con eventos.

### Estado que se escribe y nunca se lee

`Modpack.tsx` guardaba un `error` que ninguna parte del JSX pintaba: si fallaba
activar un mod opcional, el interruptor volvía solo a su sitio y no se decía
nada. Quedaban también un `handleSync` sin botón y dos componentes de resumen
que ya no se montaban, restos de cuando esa pantalla tenía su propio sincronizar.
**Ya está puesto:** `noUnusedLocals` en `tsconfig.json`. Un estado que dejas de
usar ahora rompe `npm run typecheck` en vez de quedarse ahí meses.

### Las imágenes de los mods opcionales apuntaban a un 404

**Síntoma:** en la pestaña Mods, las tres fichas salían con una letra gigante
sobre un cuadro dorado en vez del icono del mod.
**Causa:** los `image` de `OPTIONAL` en `build-manifest.mjs` eran URLs de
`media.forgecdn.net` escritas a mano que devuelven `404 NoSuchKey`. El respaldo
de `RemoteImage` funcionaba perfectamente — lo que fallaba era el dato.
**Ya está puesto:** los tres iconos van empaquetados en
`src/renderer/src/assets/mods/<id>.png` y se eligen por `id` en `LOCAL_ICONS`
(`Modpack.tsx`). El campo `image` del manifiesto sigue siendo la reserva.
**Regla:** si añades un mod opcional, mete su icono en esa carpeta y regístralo.
Si prefieres URL, **comprueba que responde 200 antes de publicar** — un icono
roto no da error en ningún sitio, solo se ve mal.

### Un icono cuadrado no es una portada

Esos iconos son de 128x128 y la banda de la ficha mide 268x104. Con
`objectFit: cover` se ampliaban al cuádruple y se recortaban por arriba y por
abajo. `RemoteImage` acepta `fit="contain"` para esto; `cover` solo para
fotos apaisadas.

### Nombres de archivo reales que no caben

El pie de las fichas de Mods ponía `tamaño · nombre.jar` en un solo `<span>` sin
recortar. Con nombres de verdad —
`DistantHorizons-3.2.0-b-1.20.1-fabric-forge.jar` pide 326 px donde hay 184 —
la línea se partía en tres y empujaba el interruptor. Cualquier texto que venga
del manifiesto o del disco necesita `textOverflow: ellipsis` y `minWidth: 0`.

### Nada de recursos remotos para que la app arranque

La tipografía se pedía a `fonts.googleapis.com` con un `@import`, que bloquea el
primer pintado: sin conexión, la ventana esperaba a que la petición fallase. Está
empaquetada en `src/renderer/src/assets/fonts` (47 KB, una fuente variable).
La música (2.7 MB) tampoco se precarga ya: solo se le pone `src` al `<audio>`
cuando el ajuste está activado, y viene desactivado por defecto.

## Antivirus

El instalador no está firmado, así que salta SmartScreen y algunos antivirus.
No es un fallo del código y no se arregla con elevación de permisos — pedir
administrador empeora la heurística.

Lo único que lo arregla es un certificado de firma. La opción barata es Certum
Open Source (~100-130 € el primer año, el repo tiene que ser público — y lo es).
Mientras tanto: reportar el falso positivo a los motores que lo marquen, y las
instrucciones de exclusión que ya están en `LEEME.txt`.

## Trabajando con el usuario

- **No lances sus aplicaciones GUI** para probar. Depura leyendo el código o con
  la vista previa del renderer.
- **No crees cuentas ni introduzcas contraseñas o tokens.** Si hace falta una
  sesión (`gh`, wrangler), pídesela.
- Habla en español.

## Pendiente

**El servidor de Minecraft no tiene whitelist.** El launcher no controla quién
entra: cualquiera con la IP puede conectarse. Se arregla en el servidor
(`whitelist.json` o un plugin), no aquí.
