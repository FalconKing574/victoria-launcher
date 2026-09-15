# Privacidad del launcher de Victoria Kingdom

Qué datos usa el launcher, para qué y a dónde van. Sin letra chica.

## Lo que NO hace

- No tiene telemetría, analíticas ni publicidad.
- No lee tus archivos personales, tu historial ni otros programas.
- No vende ni comparte datos con nadie.

## Lo que sí manda, y a quién

| Dato | A dónde | Para qué |
|---|---|---|
| Tu nombre de cuenta, contraseña (cifrada en el envío) y correo, si creás una cuenta sin Minecraft original | Servidor de cuentas de Victoria Kingdom | Crear y abrir tu cuenta, y mandarte el código de verificación |
| Tu sesión de Microsoft / Minecraft, si entrás con Microsoft | Microsoft y Mojang, y el servidor de cuentas de Victoria para confirmar que la cuenta es tuya | Entrar con tu cuenta original |
| Tu usuario de Discord, cuando lo vinculás | Servidor de cuentas de Victoria Kingdom y Discord | Unirte al Discord de Victoria y darte tus roles |
| Una huella del equipo: un código derivado del identificador de Windows, que no permite saber quién sos ni reconstruir el identificador | Servidor de cuentas de Victoria Kingdom | Que las sanciones del servidor alcancen a quien las recibió |
| La dirección IP con la que te conectás | Servidor de cuentas y servidor de juego | Entrar al juego y aplicar sanciones |
| Pedidos de descarga del modpack, Java, Minecraft y Forge | Cloudflare R2, Mojang, Adoptium, Forge | Instalar y actualizar el juego |

Todos estos datos son necesarios para jugar en Victoria Kingdom. No se usan
para nada más.

## Lo que queda en tu PC

La sesión de Victoria y la de Microsoft se guardan cifradas con el llavero de
Windows, en la carpeta del launcher dentro de `AppData`. Desinstalando el
launcher y borrando esa carpeta no queda nada.

## Contacto

Por cualquier duda sobre tus datos, o para pedir que se borre tu cuenta, abrí
un ticket en el Discord de Victoria Kingdom: https://discord.gg/HFvsGaxc7G
