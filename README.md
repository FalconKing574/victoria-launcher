# Victoria Kingdom Launcher

Launcher oficial del servidor de rol de Minecraft **Victoria Kingdom**
(Minecraft 1.20.1 con Forge 47.4.0).

**Descarga:** [última versión](https://github.com/FalconKing574/victoria-launcher/releases/latest)
(`Victoria Kingdom Setup <versión>.exe`, Windows 10/11 de 64 bits).

## Qué hace

- **Instala todo solo** en una PC vacía: Java 17, Minecraft 1.20.1, Forge
  47.4.0 y el modpack del servidor, que baja de Cloudflare R2 y verifica archivo
  por archivo.
- **Se actualiza solo**, él y el modpack. Si el modpack está atrasado, JUGAR lo
  pone al día antes de abrir el juego.
- **Cuentas de Victoria:**
  - con Minecraft original, entrando con Microsoft;
  - sin Minecraft original, con nombre, contraseña y correo verificado con un
    código.
  La sesión dura 30 días y se guarda cifrada con el llavero de Windows: no hay
  que escribir `/login` adentro del juego.
- **Vincula tu Discord** al de Victoria Kingdom y te da tus roles.
- **Tutorial de primera vez:** normas del servidor, recorrido por el launcher y
  configuración guiada (memoria, shaders según tu placa, mods opcionales,
  prueba de micrófono).
- Shaders (Oculus), mods opcionales, ajustes de memoria y Java, y un diagnóstico
  legible cuando el juego se cierra.

## Seguridad y privacidad

- El instalador no pide permisos de administrador: todo vive en tu `AppData`.
- No hay telemetría. Qué datos se mandan y para qué: [PRIVACIDAD.md](PRIVACIDAD.md).
- Los binarios se compilan en GitHub Actions desde este repositorio y se firman:
  [FIRMA-DE-CODIGO.md](FIRMA-DE-CODIGO.md).

Free code signing provided by [SignPath.io](https://signpath.io), certificate
by [SignPath Foundation](https://signpath.org).

## Desarrollo

```bash
npm install
npm run dev          # launcher en modo desarrollo
npm run typecheck
npm test             # vitest
npm run build && node scripts/preview-renderer.mjs   # interfaz en http://localhost:4310, sin abrir la app
```

Publicar una versión: sube `version` en `package.json`, hace commit y crea el tag
`v<versión>`; el workflow `.github/workflows/publicar.yml` compila, firma y
publica la release. El detalle, las trampas conocidas y cómo publicar el modpack
están en [`docs/mantenimiento/`](docs/mantenimiento/README.md).

```
src/main/        proceso principal: disco, red, lanzar el juego, cuentas
src/preload/     puente tipado (api.d.ts es el contrato)
src/renderer/    interfaz React
scripts/         manifiesto del modpack, firma, latest.yml, vista previa
tests/           vitest
```

## Licencia

El código es libre bajo la [licencia MIT](LICENSE). El nombre, el logo y el arte
de Victoria Kingdom son marca del servidor y no entran en esa licencia: ver
[MARCA.md](MARCA.md).

Minecraft es una marca de Mojang Studios y Microsoft. Este proyecto no está
afiliado a Mojang ni a Microsoft.
