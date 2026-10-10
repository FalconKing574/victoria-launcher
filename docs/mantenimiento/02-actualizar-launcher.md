# Actualizar el launcher

El launcher es la aplicación de escritorio. Se publica en GitHub Releases y se
actualiza sola: comprueba al arrancar, descarga e instala en silencio, y se
vuelve a abrir.

## Requisitos

```bash
gh auth status
```

Si no hay sesión, **no la crees tú** — pídesela al usuario. Cualquier comando
que publique necesita el token:

```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
export GH_TOKEN=$(gh auth token)
```

## 1. Comprueba en qué versión está

```bash
gh release list --repo FalconKing574/victoria-launcher --limit 3
node -p "require('./package.json').version"
```

## 2. Haz el cambio y compruébalo

```bash
npm run typecheck
npm test
```

Los dos tienen que pasar limpios antes de publicar. Si publicas con
`publicar.yml`, corre también `npm test` con `VICTORIA_MANIFEST_URL` puesta, como
la pone el workflow (ver «Un test que pasa en tu PC y falla en GitHub» en
[`04-trampas.md`](04-trampas.md)). Los tests son de lógica pura
(sin Electron): planificador de sync, UUID offline, ajustes, versión de Java,
propiedades de shaders.

Si añades lógica que se pueda probar sin Electron, ponla en `src/main/lib/` y
escríbele un test en `tests/`. Lo que importe Electron no se puede testear ahí.

## 3. Sube la versión

```bash
npm version 1.3.2 --no-git-tag-version
```

Semver: parche para arreglos, menor para funciones nuevas.

## 4. Publica

```bash
rm -rf release
VICTORIA_MANIFEST_URL="https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json" npm run release
```

**La variable no es opcional.** Se compila dentro del binario (`src/main/config.ts`).
Sin ella el launcher sale sin URL de modpack y no descarga nada: una app
empaquetada no tiene `.env` ni shell de donde leerla.

`npm run release` termina con `scripts/instalador-jugadores.mjs`, que pone el
instalador de la versión nueva donde lo bajan los jugadores (ver el paso 6).
Necesita `gh` en el PATH. `publicar.yml` hace lo mismo en su último paso.

## 5. Verifica — no te saltes esto

```bash
gh release view v1.3.2 --repo FalconKing574/victoria-launcher --json isDraft,assets --jq '{draft:.isDraft,assets:[.assets[].name]}'
```

Comprueba:
- [ ] `draft: false` — **un borrador es invisible para el actualizador**
- [ ] están los cuatro: `latest.yml`, `Victoria-Kingdom-actualizacion-<versión>.exe`,
      su `.blockmap` y `Victoria-Kingdom-Setup.exe` (el fijo)

`latest.yml` es el archivo que el actualizador consulta. Sin él nadie se entera
de que hay versión nueva.

Y confirma a qué repo apunta el binario ya empaquetado, no el archivo de config:

```bash
cat release/win-unpacked/resources/app-update.yml
```

Tiene que decir `owner: FalconKing574`. Si dice otra cosa, mira
[`04-trampas.md`](04-trampas.md).

Si publicaste con `publicar.yml` no hay carpeta: el paso «El instalador lleva
app-update.yml» lo comprueba dentro del instalador final y corta antes de
publicar. Que ese paso esté en verde en la corrida, y si no existe, **no
publiques**: sin ese archivo quien se actualice no recibe nunca más otra
versión (pasó con la 1.8.0).

## 6. El instalador que se reparte es siempre la última versión

Los jugadores bajan `Victoria-Kingdom-Setup.exe`: la web y el Discord, de la
release `instalador` (prerelease, para que el actualizador no la tome como la
última), y el botón que apunta a `/releases/latest`, de la release de la
versión. Al publicar, `scripts/instalador-jugadores.mjs` sube a los dos lugares
una copia del instalador de esa versión (`Victoria-Kingdom-actualizacion-<versión>.exe`)
y comprueba que los tres archivos publicados son el mismo. No hay que hacer
nada a mano.

Link permanente para la web, el Discord o donde sea (no cambia nunca):
`https://github.com/FalconKing574/victoria-launcher/releases/download/instalador/Victoria-Kingdom-Setup.exe`

**Comprueba** después de publicar: la release `instalador` dice en sus notas la
versión que entrega, y su `Victoria-Kingdom-Setup.exe` tiene el mismo `digest`
que el `Victoria-Kingdom-actualizacion-<versión>.exe` de la versión nueva.

**Por qué ya no es un instalador fijo.** Del 27-09 al 10-10-2026 se repartió
siempre el de la 1.6.1, porque SmartScreen ata la reputación al archivo y uno
nuevo por versión vuelve a mostrar «Windows protegió tu PC». Salió mal:

- quien instalaba de cero arrancaba en una versión de semanas atrás, con su
  propio arranque y su propio actualizador, y tenía que actualizarse antes de
  poder usar nada. El 10-10 el dueño lo vio quedarse en el logo al abrir;
- Microsoft contestó (09-10) que sin firma cada versión junta su reputación de
  cero igual, así que el fijo tampoco iba a quitar el aviso.

El aviso de SmartScreen lo quita la firma (SignPath, ver
[`05-firma-de-codigo.md`](05-firma-de-codigo.md)): con firma la reputación es del
certificado y pasa de una versión a la otra.

El `.exe` de cada versión se sigue llamando `Victoria-Kingdom-actualizacion-<versión>.exe`
(`electron-builder.yml` → `nsis.artifactName`): es el que nombra `latest.yml`, y
la copia con el nombre de siempre es la que se les dice a los jugadores.

`LEEME.txt` son las instrucciones para los jugadores. Si has cambiado algo que
les afecta (mods opcionales, shaders, avisos del antivirus), actualízalo.

## Cómo llega la actualización

Rehecho el 06-10-2026 (1.8.0). Antes buscaba a los 4 segundos, en segundo
plano, y al terminar de bajar cerraba la ventana en medio de lo que el jugador
estuviera haciendo y le volvía a mostrar el asistente del instalador. Eso era
el «retrocede y vuelve a la etapa de instalación» — ver
[`04-trampas.md`](04-trampas.md).

`src/main/ipc/updater.ts` + `src/renderer/src/screens/Splash.tsx`:

1. **Busca en cuanto abre**, y la pantalla de carga espera la respuesta (como
   mucho 8 s; sin conexión entra igual). Reglas en `lib/arranque.ts`.
2. **Si hay versión nueva, se actualiza desde la pantalla de carga**: barra de
   descarga, «Instalando…», el launcher se cierra y el instalador lo vuelve a
   abrir. Sin asistente (`quitAndInstall(true, true)`). Si tarda, a los 6 s sale
   «Entrar sin esperar».
3. **Si la encuentra con el launcher ya en uso**, no corta nada: se instala al
   cerrarlo (`autoInstallOnAppQuit`, en silencio) o con «Reiniciar ahora» del
   aviso de Jugar. Nunca durante una descarga del modpack ni un arranque de
   Minecraft.
4. **Si el instalador no llega a correr** (casi siempre el antivirus), no
   entra en un ciclo: cada intento se anota en `actualizacion-launcher.json`
   y, si al volver a abrir la versión no cambió, el intento falló. Después de
   2 fallos con la misma versión deja de instalarla sola y Jugar/Ajustes
   explican qué hacer, con el enlace al instalador completo. Lógica en
   `lib/actualizacion.ts`, con tests.

**El instalador también se pone en silencio solo** cuando lo abren con
`--updated` (`build/installer.nsh`). Eso es lo que cubre a los launchers
viejos, incluido el 1.6.1 del instalador fijo: su código abre el instalador sin
`/S`, pero el instalador que abren es el de la versión nueva. Comprobado con
Wine: el de la 1.7.1 se queda en la página «¿Para quién instalar?»; el nuevo
termina solo en ~11 s y reabre el launcher.

Consecuencia práctica: **un cambio en el código del updater no llega por el
updater viejo** — quien está en una versión anterior se actualiza con el
comportamiento antiguo. Lo que sí llega siempre es lo de `build/installer.nsh`,
porque corre dentro del instalador nuevo.

## Dónde se configura qué

| Qué | Archivo |
|---|---|
| Versión de Minecraft y Forge | `src/main/config.ts` |
| URL del manifiesto | variable de entorno al compilar |
| Opcionales activados por defecto | `src/main/ipc/sync.ts` → `DEFAULT_OPTIONAL` |
| Enlace de Discord | `src/renderer/src/components/SideNav.tsx` |
| Repo de actualizaciones | `electron-builder.yml` → `publish` |
| RAM recomendada, flags de la JVM | `src/main/lib/settings-core.ts` |
| Color de acento (hoy rojo Victoria `#d7263d`) | `src/renderer/src/theme/tokens.css` → `--acento*` |
| Degradado de los botones y verde de JUGAR | `src/renderer/src/theme/tokens.css` → `--boton-principal`, `--boton-jugar` |
| Capturas de fondo de la pantalla de cuenta (y galería de la web) | `src/renderer/src/assets/capturas/`, con `node scripts/importar-capturas.mjs` |
| Imágenes de las tarjetas de Novedades (launcher y web) | `node scripts/tarjetas-novedades.mjs servidor.png comunidad.png modpack.png` |
| Servidor del «En línea · N jugadores» | `src/main/config.ts` → `SERVIDOR_MINECRAFT` |
