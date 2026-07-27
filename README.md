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
