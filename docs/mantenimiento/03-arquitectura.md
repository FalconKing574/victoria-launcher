# Arquitectura

Lo justo para orientarse antes de tocar código.

## Stack

Electron 43 + React 18 + TypeScript, compilado con `electron-vite`.
`minecraft-launcher-core` (MCLC) instala y lanza el juego, `msmc` hace el login
de Microsoft, `electron-updater` actualiza la app.

Tres procesos, aislados a propósito:

```
src/main/       proceso principal — disco, red, lanzar el juego
src/preload/    puente contextBridge; api.d.ts es el contrato
src/renderer/   React; NO tiene acceso a Node
```

El renderer solo habla con el main por `window.api`, definido en
`src/preload/index.ts` y tipado en `src/preload/api.d.ts`. Para añadir una
función hay que tocar los dos, más el `ipcMain.handle` del main.

## Es independiente de Minecraft y de Forge

No lee `%APPDATA%\.minecraft` ni nada de CurseForge. En un PC sin nada, al pulsar
JUGAR descarga por su cuenta:

1. **Java 17** (Temurin, ~42 MB) si no hay uno válido — `src/main/lib/java-runtime.ts`
2. **El modpack** desde R2 — `src/main/ipc/sync.ts`
3. **Minecraft 1.20.1** (~728 MB) — lo hace MCLC
4. **Forge 47.4.0** — vía ForgeWrapper, sin necesitar `launcher_profiles.json`

Verificado de punta a punta con una carpeta vacía: descarga los 728 MB y el
juego arranca.

La carpeta de CurseForge solo se mira como *candidato* de Java, para ahorrar la
descarga si ya hay un JRE bueno. No es una dependencia.

## Carpetas en el PC del jugador

```
%APPDATA%\victoria-launcher\
  settings.json           ajustes
  ms-token.json           sesión de Microsoft
  crash.log               errores no capturados
  modpack-state.json      qué instaló el launcher (mods, hashes de overrides)
  mod-hashes.json         caché de sha1 por jar — se puede borrar sin consecuencias
  minecraft\shaders-library\  shaders instalados que ahora no se usan
  minecraft\shaders-trash\    shaders que el jugador quitó, recuperables
  minecraft\shaders-removed.json  nombres de los quitados, para que el pack no los devuelva
  minecraft\              root de MCLC: versions, libraries, assets, forge, java
  instance\               gameDirectory: mods, config, saves, resourcepacks, shaderpacks
```

`minecraft\` e `instance\` están separadas a propósito: la primera es la
instalación de Minecraft, la segunda la partida. **`launch.ts` pasa
`cwd: instanceDir()` además de `gameDirectory`** y eso no es opcional — mira
[`04-trampas.md`](04-trampas.md).

Las rutas se calculan en `src/main/lib/paths.ts`, siempre desde
`app.getPath('userData')`. Nunca escribas una ruta absoluta con un nombre de
usuario dentro: ya rompió la instalación de otro jugador con un `EPERM`.

## Cómo funciona el sync del modpack

`src/main/ipc/sync.ts`, con la lógica pura en `src/main/lib/sync-plan.ts`.

Regla central: **el launcher solo borra lo que él instaló.** `modpack-state.json`
guarda la lista `managed`. Un `.jar` que el jugador metió a mano no se toca nunca.

Los overrides (configs, resourcepacks, shaderpacks) se guardan con el hash de
cada parte, así que solo se baja lo que cambió.

`runSync()` deduplica: si ya hay un sync corriendo, el segundo se une en vez de
duplicarlo. El estado vivo se expone por `sync:live` para que la interfaz se
reconstruya al cambiar de pestaña — las pantallas se desmontan, la descarga no.

**`scanLocal()` va cacheado.** Comprobar si el pack está al día necesita el sha1
de cada jar, y son 117 jars / 425 MB. Recalcularlos en cada comprobación —
que ocurre al entrar a Jugar y al entrar a Ajustes — congelaba la ventana. Ahora
`mod-hashes.json` guarda el hash junto al tamaño y la fecha de cada archivo, y
solo se rehashea lo que ha cambiado (`src/main/lib/hash-cache.ts`, con tests).
Si añades otra ruta que necesite hashes, pásala por ahí, no por `readFileSync`.

**El estado se escribe con `writeJsonAtomic`.** `modpack-state.json` es lo único
que distingue un mod del launcher de uno del jugador; si se trunca a medias, el
launcher deja de poder retirar mods para siempre. `src/main/lib/write-atomic.ts`.

## Shaders

**El mod de shaders del pack es Oculus** (`oculus-mc1.20.1-1.8.0.jar`), y viene
siempre instalado. En la interfaz se llama Oculus y solo Oculus: las pantallas
decían «Activar Iris», que es otro mod y no está en el pack. No vuelvas a
escribir Iris en nada que vea el jugador.

La pestaña Shaders no instala ni desinstala nada: escribe
`config/oculus.properties`, que es el mismo archivo que usa la pantalla de
shaders del juego. Es instantáneo y no puede romper la dependencia con Embeddium.

Las dos claves que importan son independientes, y esa es toda la lógica:

```
shaderPack=ComplementaryReimagined_r5.8.1.zip   cuál usaría
enableShaders=false                             si se carga al arrancar
```

**Dejar de usar un shader es apagar `enableShaders` y no tocar `shaderPack`.**
Al volver a encenderlo reaparece el mismo — `shaders:set-enabled` solo adopta el
primero de la lista cuando no hay ninguno recordado. La ficha en uso tiene su
propio botón «Dejar de usar»; antes ponía «En uso» y estaba inerte, así que la
única salida visible era borrar el shader.

### En `shaderpacks/` solo está el que se usa

Lo que no se usa no tiene por qué estar donde Minecraft mira. Hay tres carpetas:

```
instance\shaderpacks\        el que está en uso — cero o uno, nunca más
minecraft\shaders-library\   instalados pero aparcados
minecraft\shaders-trash\     quitados por el jugador, recuperables
```

`applySelection()` es el **único** sitio que mueve archivos entre las dos
primeras, y todo acaba llamando a `syncFilesToConfig()`: elegir, apagar, borrar,
recuperar, abrir el launcher y `pruneDeletedShaders()` después de aplicar los
overrides. Eso último no es opcional — el pack extrae los tres shaderpacks otra
vez en cada actualización, así que sin aparcarlos volverían todos a la carpeta.

La pantalla lista la unión de las dos primeras carpetas, así que mover archivos
no cambia lo que ve el jugador.

**Consecuencia buscada:** el menú de shaders de dentro del juego solo enseña el
que está en uso. Cambiar de shader se hace desde el launcher. Está avisado en la
propia pantalla.

**«Dejar de usar» vacía `shaderPack` y NO toca `enableShaders`.** Llegó a llamar
a `set-enabled(false)`, y eso apagaba Oculus: quitarte un shader te dejaba sin
poder elegir ningún otro. El interruptor maestro sigue siendo cosa aparte.

**Recuperar un shader es inmediato**, incluso sin copia en la papelera. Los
shaderpacks viajan dentro de `overrides-3.zip` (177 MB); `remote-zip.ts` lee el
índice del zip por HTTP `Range` y baja **solo esa entrada** — BSL son 1 MB y
tarda ~1 s. Antes había que esperar a la siguiente actualización del modpack,
que en la práctica es no recuperarlo. Compruébalo contra el pack real con
`node scripts/probe-remote-zip.mjs`.

Ese archivo está excluido de los overrides para que una actualización del pack
no le pise la elección al jugador.

**Quitar un shader es reversible.** Va a `minecraft\shaders-trash\` y su nombre
a `shaders-removed.json`, que es lo que impide que los overrides lo devuelvan.
La sección «Shaders que quitaste» lo trae de vuelta. Antes era un `rmSync`: el
archivo desaparecía y el nombre se quedaba en la lista para siempre, así que no
había ninguna forma de recuperarlo desde el launcher.

## La interfaz no depende de internet

El launcher abre sin red. La tipografía (Outfit) va empaquetada en
`src/renderer/src/assets/fonts`; era un `@import` a Google Fonts, que bloquea el
primer pintado hasta que resuelve. Si añades una fuente o un icono, que sea un
archivo local.

Lo único remoto que queda son los avatares de `mc-heads.net` y las fotos de
relleno de la pantalla Jugar, y las tres fallan a un hueco o a un color, nunca a
un icono roto.

## Ver la interfaz sin abrir la app

```bash
npm run build && node scripts/preview-renderer.mjs
```

Sirve `out/renderer` en `http://localhost:4310` con un `window.api` falso, así
que se pueden mirar todas las pantallas sin lanzar el launcher del usuario.

## Tests

```bash
npm test
```

Casi todo es lógica pura, sin Electron. Por eso los módulos están partidos:
`java.ts` (puro) frente a `java-runtime.ts` (descarga, usa Electron);
`settings-core.ts` frente a `settings.ts`; `sync-plan.ts` y `hash-cache.ts`
frente a `ipc/sync.ts`.

Si escribes algo que valga la pena probar, ponlo del lado puro.

La excepción es `tests/shaders-restore.test.ts`: sustituye `electron` con
`vi.mock` y ejercita quitar/recuperar contra una carpeta temporal de verdad.
El fallo que cubre estaba justo en el movimiento de archivos, así que probarlo
en puro no habría demostrado nada. Sigue corriendo en Node, sin abrir nada.

`npm run typecheck` tiene `noUnusedLocals` activado. Varias reescrituras de las
pantallas dejaron estado que se seguía escribiendo y ya no se leía — incluido un
mensaje de error que nunca llegó a pintarse. Ahora eso rompe la compilación.
