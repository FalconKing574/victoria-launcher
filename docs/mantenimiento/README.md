# Mantenimiento de Victoria Kingdom — empieza aquí

Guía para actualizar el modpack y el launcher. Escrita para que cualquier IA (o
persona) pueda hacerlo sin conocer el historial del proyecto.

## Lee esto primero

1. [`01-actualizar-modpack.md`](01-actualizar-modpack.md) — cambiar mods, configs o shaders
2. [`02-actualizar-launcher.md`](02-actualizar-launcher.md) — publicar una versión nueva de la app
3. [`03-arquitectura.md`](03-arquitectura.md) — qué hay dónde y por qué
4. [`04-trampas.md`](04-trampas.md) — **fallos que ya han pasado**. Léelo antes de tocar nada.

## Los dos sistemas son independientes

| | Modpack | Launcher |
|---|---|---|
| Qué es | mods, configs, shaders, resource pack | la aplicación de escritorio |
| Dónde vive | Cloudflare R2 | GitHub Releases |
| Cómo llega | al pulsar JUGAR | se instala sola al arrancar |
| Versión | `packVersion` en el manifiesto | `version` en `package.json` |

Puedes actualizar uno sin el otro. **Solo hay que tocar ambos si cambias el
código que lee el modpack** (por ejemplo, si añades un campo nuevo al manifiesto).

## Datos fijos

```
Repo del launcher    C:\Users\FalconKingman\Desktop\VictoriaLauncher
Instancia fuente     C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho
Carpeta de reparto   C:\Users\FalconKingman\Desktop\Victoria Kingdom Launcher
GitHub               FalconKing574/victoria-launcher
Bucket R2            victoria-modpack
Manifiesto           https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json
Servidor de Minecraft 131.221.32.76:25567
Minecraft / Forge    1.20.1 / 47.4.0
```

La **instancia fuente** es la verdad del modpack. Se edita ahí, no en
`dist-modpack/` (esa carpeta se regenera entera).

## Comprueba el estado antes de empezar

Nunca asumas en qué versión está nada. Míralo:

```bash
node -e "fetch('https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json',{cache:'no-store'}).then(r=>r.json()).then(m=>console.log('modpack vivo:',m.packVersion))"
```

```bash
gh release list --repo FalconKing574/victoria-launcher --limit 3
```

## Regla que no se salta

**Verifica lo que publicas.** Cada guía termina con una comprobación concreta:
leer el manifiesto vivo, mirar dentro del .zip publicado, confirmar que la
release no es borrador. Publicar sin comprobar ya ha dejado a los jugadores sin
actualización más de una vez — está contado en [`04-trampas.md`](04-trampas.md).
- [05-firma-de-codigo.md](05-firma-de-codigo.md) — firma gratis con SignPath Foundation: pedirla, configurarla y juntar reputación para que el antivirus deje de avisar.
