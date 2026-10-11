# Conexión de cuentas desde 1.8.3

El aviso literal `fetch failed` se podía producir DESPUÉS del acceso con
Microsoft: `cuentas.ts` volvía a descargar el manifiesto para cada operación y
dejaba pasar el error de Node sin identificar el servicio. Tener el modpack
instalado no evitaba esa descarga.

`manifest-runtime.ts` prueba primero `net.fetch` de Electron, que utiliza la red
del sistema, y después el `fetch` de Node. Son dos intentos, como máximo 5 s
cada uno y 250 ms entre ellos. La señal también corta la lectura del cuerpo.
Se comparten descargas simultáneas y se reutiliza un éxito durante un minuto.
No se sincroniza el modpack con manifiestos viejos guardados en disco.

`auth-config.ts` separa los datos PÚBLICOS del servidor de cuentas del resto
del modpack. Los datos válidos se guardan en `cuentas-config.json`, asociados
a la URL del manifiesto. Se reutilizan por 5 minutos y se aceptan como respaldo
de red por hasta 7 días. Nunca contienen una cuenta, contraseña ni token.
Tras utilizar un respaldo se comparte durante 30 segundos, sin renovar su fecha
en disco; después se vuelve a intentar la distribución para detectar cambios.

Si no existe caché y falla la distribución, la configuración pública de
`src/main/data/auth-respaldo.json` permite llegar a VictoriaAuth. Así también
se recupera quien actualiza desde una versión que nunca guardó configuración.
**El respaldo sólo está habilitado para la URL oficial de producción.** No
redirige cuentas de otros manifiestos a producción. Un manifiesto nuevo válido
tiene prioridad; si quita `auth`, se recuerda ese resultado. Si cambia la llave,
se utiliza la nueva. El servidor siempre autoriza login, sanciones y vale de
entrada; un fallo de distribución ya no omite el vale antes de lanzar el juego.

## Al rotar la llave o cambiar de servidor

Actualizar el manifiesto sigue siendo obligatorio. Actualizar también
`auth-respaldo.json` con la dirección y llave públicas nuevas y publicar el
launcher: una copia antigua sólo se usa si no llega el manifiesto y el servidor
rechazará un sobre cifrado hacia una llave que ya no tenga. No introducir nunca
la llave privada en el launcher. El respaldo inicial se contrastó con el
manifiesto vivo del 11-10-2026 y la huella pública SHA-256
`1adc86605a1d8559961eed023351a9649a40852e455c483807e03b456a605073`.

## Si un jugador vuelve a tener problemas

Pedir `%APPDATA%\victoria-launcher\conexion-launcher.log` (y `.1` si hubo
rotación). Registra momento, versión, servicio, etapa y códigos internos de
red. Nunca escribe el texto de la excepción, URLs, cuerpos ni credenciales.
Se limita a ~512 KB por archivo y un respaldo. No se envía automáticamente.

Los fallos de red al renovar Microsoft conservan el refresh token para otro
intento; un rechazo de sesión sí lo elimina. No asumir que dos capturas del
mismo aviso prueben una caída mundial: las pruebas de DNS, proxy o certificados
deben hacerse en las PC afectadas.

La distribución todavía utiliza `r2.dev`. Migrarla a un dominio de producción
es una mejora separada; este arreglo no depende de comprar o configurar uno.
