# Actualizar el launcher

El launcher es la aplicación de escritorio. Se publica en GitHub Releases y se
actualiza sola: comprueba al arrancar, descarga, y se reinstala reiniciándose.

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

## 5. Verifica — no te saltes esto

```bash
gh release view v1.3.2 --repo FalconKing574/victoria-launcher --json isDraft,assets --jq '{draft:.isDraft,assets:[.assets[].name]}'
```

Comprueba:
- [ ] `draft: false` — **un borrador es invisible para el actualizador**
- [ ] están los tres: `latest.yml`, el `.exe` y el `.blockmap`

`latest.yml` es el archivo que el actualizador consulta. Sin él nadie se entera
de que hay versión nueva.

Y confirma a qué repo apunta el binario ya empaquetado, no el archivo de config:

```bash
cat release/win-unpacked/resources/app-update.yml
```

Tiene que decir `owner: FalconKing574`. Si dice otra cosa, mira
[`04-trampas.md`](04-trampas.md).

## 6. Actualiza la carpeta de reparto

Para quien instala por primera vez (el auto-update solo sirve a quien ya lo tiene):

```bash
cd "/c/Users/FalconKingman/Desktop"
rm -f "Victoria Kingdom Launcher/Victoria Kingdom Setup 1.3.1.exe"
cp "VictoriaLauncher/release/Victoria Kingdom Setup 1.3.2.exe" "Victoria Kingdom Launcher/"
sed -i 's/Setup 1\.3\.1\.exe/Setup 1.3.2.exe/' "Victoria Kingdom Launcher/LEEME.txt"
```

`LEEME.txt` son las instrucciones para los jugadores. Si has cambiado algo que
les afecta (mods opcionales, shaders, avisos del antivirus), actualízalo.

## Cómo llega la actualización

`src/main/ipc/updater.ts`:

1. Comprueba 4 segundos después de arrancar — en cada apertura.
2. Descarga sola (`autoDownload = true`).
3. Al terminar se reinicia e instala, **salvo** que esté descargando el modpack
   o arrancando Minecraft: cortar eso dejaría medio pack en disco o mataría el
   juego. En ese caso se instala al cerrar (`autoInstallOnAppQuit = true`).

El jugador también lo ve en Ajustes → Launcher, y la pantalla de Jugar avisa si
hay algo pendiente.

Consecuencia práctica: **un cambio en el updater no llega por el updater viejo**.
Quien está en una versión anterior al cambio se actualiza con el comportamiento
antiguo. La versión nueva ya se comporta como toca.

## Dónde se configura qué

| Qué | Archivo |
|---|---|
| Versión de Minecraft y Forge | `src/main/config.ts` |
| URL del manifiesto | variable de entorno al compilar |
| Opcionales activados por defecto | `src/main/ipc/sync.ts` → `DEFAULT_OPTIONAL` |
| Enlace de Discord | `src/renderer/src/components/SideNav.tsx` |
| Repo de actualizaciones | `electron-builder.yml` → `publish` |
| RAM recomendada, flags de la JVM | `src/main/lib/settings-core.ts` |
