# Para agentes de IA

Launcher del servidor de Minecraft **Victoria Kingdom** (1.20.1, Forge 47.4.0).
Electron + React + TypeScript.

**Antes de tocar nada, lee [`docs/mantenimiento/`](docs/mantenimiento/README.md).**
Ahí está cómo actualizar el modpack y el launcher, cómo está montado el
proyecto, y una lista de fallos que ya llegaron a los jugadores y no conviene
repetir.

Atajos:

- Actualizar mods, configs o shaders → [`01-actualizar-modpack.md`](docs/mantenimiento/01-actualizar-modpack.md)
- Publicar una versión del launcher → [`02-actualizar-launcher.md`](docs/mantenimiento/02-actualizar-launcher.md)
- Qué hay dónde → [`03-arquitectura.md`](docs/mantenimiento/03-arquitectura.md)
- **Trampas conocidas** → [`04-trampas.md`](docs/mantenimiento/04-trampas.md)

Reglas que no dependen de la tarea:

- Habla en español con el usuario.
- Nunca lances sus aplicaciones GUI para probar algo.
- No crees cuentas ni introduzcas contraseñas ni tokens; pídeselos.
- `npm run typecheck` y `npm test` tienen que pasar antes de publicar.
- Verifica lo que publicas mirando el resultado real (manifiesto vivo, contenido
  del .zip, release no borrador), no el archivo fuente.
