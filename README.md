# Victoria Kingdom Launcher

Launcher de escritorio para el servidor de Minecraft **Victoria Kingdom**
(1.20.1 con Forge 47.4.0).

No hay nada que configurar. Se instala y funciona.

## Cómo se entra

- **Con cuenta Microsoft**: sesión real de Minecraft. Necesaria para servidores
  en modo premium (`online-mode=true`).
- **Sin cuenta premium**: el jugador escribe su nick y juega. Solo sirve si el
  servidor está en `online-mode=false`.

La sesión de Microsoft se recuerda entre arranques, cifrada con el llavero del
sistema operativo. La siguiente vez entra sola.

## Qué hace

- Instala y lanza Forge 47.4.0 sobre Minecraft 1.20.1.
- Reutiliza la instancia de CurseForge tal cual, así que sus mods, `config/`,
  `saves/` y `resourcepacks/` se aplican sin copiar nada:
  `C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho`
- Detecta Java solo. Prefiere el Java 17 que ya trae CurseForge.
- Permite activar y desactivar mods moviendo los `.jar` entre `mods/` y
  `disabled_mods/`.
- Ajustes de memoria, ruta de Java y música.

## Desarrollo

```bash
npm install
npm run dev
```

Otros comandos:

```bash
npm test          # 19 tests sobre la lógica pura
npm run typecheck
npm run build
npm run dist      # genera release/Victoria Kingdom Setup 1.0.0.exe
```

### Si `npm run dist` falla con "Cannot create symbolic link"

electron-builder descarga un paquete de firma que contiene dos symlinks de
macOS. Crearlos en Windows requiere un privilegio que las cuentas normales no
tienen, así que 7-Zip aborta y tumba el build — aunque esos archivos no sirvan
de nada en Windows.

Se arregla sin permisos de administrador:

```bash
node scripts/fix-wincodesign.mjs
```

Luego vuelve a lanzar `npm run dist`. Solo hace falta una vez por máquina.

## Actualizaciones

Hay dos cosas que se actualizan por separado, y cada una tiene su release.

### El modpack

Cuando cambies mods en la instancia:

```bash
node scripts/build-manifest.mjs --repo TU_USUARIO/TU_REPO --version 1.1.0
```

Crea una release con la etiqueta `v1.1.0` y sube `dist-modpack/manifest.json` y
todos los `.jar` de `dist-modpack/mods/`.

Apunta el launcher al manifest con la variable `VICTORIA_MANIFEST_URL`:

```
https://github.com/TU_USUARIO/TU_REPO/releases/latest/download/manifest.json
```

`latest/download` siempre resuelve a la release más nueva, así que publicar una
release nueva actualiza a todos sin tocar el launcher.

**Jugar queda bloqueado** mientras el modpack esté por detrás: el botón pasa a
decir ACTUALIZAR. Es a propósito — entrar con mods distintos a los del servidor
provoca un rechazo al conectar con un error que nadie sabe leer.

Si el manifest no se puede alcanzar (sin internet, GitHub caído, o todavía no has
publicado nada), **no se bloquea**. Un fallo de red no puede dejar sin jugar a
todo el servidor.

### El launcher

1. Sube el número de versión en `package.json`.
2. `npm run dist`
3. Crea una release en el repo de `publish` (en `electron-builder.yml`) y sube
   **el `.exe` y el `latest.yml`**. Sin el `latest.yml` el autoupdate no ve nada.

Cada launcher busca actualizaciones a los pocos segundos de abrirse. Si hay una,
la descarga sola y la instala al cerrar, así que todo el que abra el launcher
después de tu release acaba en la versión nueva sin hacer nada.

Aviso: el ejecutable no está firmado, así que Windows SmartScreen puede avisar la
primera vez. Firmarlo requiere un certificado de pago.

## Control de acceso

El launcher **no** decide quién puede entrar al servidor, y no debería: alguien
puede abrir el mismo modpack con MultiMC o Prism y conectarse directo a la IP.

Quien controla el acceso es el servidor de Minecraft, con su `whitelist.json`
de vanilla o un plugin equivalente. Ahí es donde hay que añadir y quitar
jugadores.

## Estructura

```
src/main/          proceso principal de Electron
  config.ts        rutas e identificadores de versión
  lib/             java, ajustes, mods, UUID offline, rutas
  ipc/             window, auth (Microsoft), mods, launch
src/preload/       puente contextBridge tipado
src/renderer/      interfaz React
  screens/         Splash, Login, Home, Mods, Settings
  components/      TitleBar, PanoramaBg, Button, GlassCard, ...
tests/             Vitest sobre la lógica pura
```
