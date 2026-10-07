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

Los dos tienen que pasar limpios antes de publicar. Los tests son de lógica pura
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

`npm run release` termina con `scripts/instalador-fijo.mjs`, que copia el
instalador fijo a la release nueva (ver el paso 6). Necesita `gh` en el PATH.

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

## 6. El instalador que se reparte NO cambia

Desde el 27-09-2026 a los jugadores se les da siempre el mismo archivo:
`Victoria-Kingdom-Setup.exe` (launcher 1.6.1, SHA-256 `f3853e7b…3ea3e5`), que
vive en la release `instalador` (prerelease, para que el actualizador no la tome
como la última) y en `Desktop/Victoria Kingdom Launcher/`. **No lo reemplaces al
publicar.** El launcher se actualiza solo al abrirse, así que instalar uno viejo
no importa.

Por qué: «Windows protegió tu PC» es SmartScreen avisando que un archivo sin
firma no tiene reputación, y la reputación va atada al hash. Un instalador nuevo
por versión arranca de cero cada vez; el fijo es el que se mandó a revisar a
Microsoft. Por eso el `.exe` de cada versión se llama
`Victoria-Kingdom-actualizacion-<versión>.exe` (`electron-builder.yml` →
`nsis.artifactName`): que nadie lo baje por error de la página de la release.

Link permanente para el Discord o donde sea:
`https://github.com/FalconKing574/victoria-launcher/releases/download/instalador/Victoria-Kingdom-Setup.exe`

Cuándo sí se cambia el fijo (a mano, y se vuelve a mandar a Microsoft, ver
[`05-firma-de-codigo.md`](05-firma-de-codigo.md)):
- si el instalador viejo deja de poder instalar algo que funcione (por ejemplo,
  un updater tan viejo que ya no sabe actualizarse);
- con la primera versión firmada, que trae su propia reputación.

Lo que cuesta mantener el 1.6.1: quien lo instala pasa por **una** actualización
con el código viejo (busca en segundo plano y cierra la ventana cuando termina
de bajar; desde la 1.8.0 al menos sin asistente y reabriéndose solo), y su
asistente todavía pregunta «¿Para quién instalar?». Un fijo de la 1.8.0 o
posterior se salta las dos cosas: la primera apertura ya trae la pantalla de
carga nueva, y el asistente es Licencia → Carpeta → Instalar.

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
| Capturas de fondo de la pantalla de cuenta | `src/renderer/src/assets/capturas/`, con `node scripts/importar-capturas.mjs` |
| Servidor del «En línea · N jugadores» | `src/main/config.ts` → `SERVIDOR_MINECRAFT` |
