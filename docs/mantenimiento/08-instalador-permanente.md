# Instalador permanente

`Victoria-Kingdom-Setup.exe` ahora es un bootstrap pequeño de .NET Framework,
incluido en Windows 10/11, que consulta la release estable más reciente del
repositorio oficial en GitHub. Si no responde, usa `/api/launcher?actual=1`
de la web. Ambas consultas evitan la caché durante la instalación.
Al pulsar Instalar descarga `Victoria-Kingdom-actualizacion-<versión>.exe`,
valida URL oficial, tamaño y SHA256, vuelve a consultar la versión y abre el
asistente original. No tiene una versión antigua incrustada. Si no puede
verificar la publicación, informa el error y permite reintentar.

Una copia de este nuevo instalador descargada hoy buscará también versiones
futuras. **Los instaladores completos descargados antes de este cambio no pueden
modificarse a distancia**: hay que reemplazarlos una vez por el nuevo Setup.
El launcher ya instalado conserva su actualización automática habitual.

Fuentes: `build/bootstrap/Instalador.cs`; compilación:
`node scripts/compilar-instalador.mjs`. Las autopruebas no abren ventanas.
`release/bootstrap/verificar-instalador.exe --verificar-descarga` comprueba los
metadatos públicos, descarga y verifica el SHA256 sin instalar ni lanzar nada.

Publicación: `node scripts/instalador-jugadores.mjs v1.8.3` sube el bootstrap
a la release de la versión y a `instalador`, y verifica los digests públicos.
El workflow lo compila automáticamente. Con firma activa usa el archivo ya
firmado mediante `BOOTSTRAP_FILE`, sin recompilarlo después de firmar.

Antes de activar SignPath hay que actualizar su Artifact Configuration
`instalador` con `.signpath/instalador.xml`, que incluye los dos instaladores.
El workflow comprueba ambas firmas. `latest.yml` sigue apuntando al instalador
completo: nunca debe apuntar al bootstrap.

La web conserva el enlace permanente y explica que la instalación necesita
Internet. Su endpoint solo acepta publicaciones estables, URL del repositorio
oficial y un SHA256 válido. La consulta normal usa caché de hasta 60 segundos;
la consulta del instalador con `actual=1` no usa ni almacena caché.
