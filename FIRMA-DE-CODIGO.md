# Política de firma de código

Free code signing provided by [SignPath.io](https://signpath.io), certificate
by [SignPath Foundation](https://signpath.org).

Firma de código gratuita provista por SignPath.io, certificado de SignPath
Foundation.

## Qué se firma

Cada versión publicada del launcher de Victoria Kingdom en
[GitHub Releases](https://github.com/FalconKing574/victoria-launcher/releases):

- `Victoria Kingdom.exe` (el launcher),
- el desinstalador,
- el instalador de cada versión, `Victoria-Kingdom-actualizacion-<versión>.exe`.

Todos se compilan en GitHub Actions a partir del código de este repositorio
(`.github/workflows/publicar.yml`). Ningún binario armado en una PC personal se
firma.

Cada release lleva además `Victoria-Kingdom-Setup.exe`, que es una copia del
instalador de esa misma versión con el nombre que se les da a los jugadores
(`scripts/instalador-jugadores.mjs`). Las releases hasta la 1.8.1 llevan en su
lugar una copia del instalador de la 1.6.1, armado antes de usar SignPath: esa
no está firmada ni se manda a firmar.

## Equipo

| Rol | Quién |
|---|---|
| Autores (committers) | [FalconKing574](https://github.com/FalconKing574) |
| Revisores | [FalconKing574](https://github.com/FalconKing574) |
| Aprobadores de firma | [FalconKing574](https://github.com/FalconKing574) |

Cada pedido de firma se aprueba a mano. Todos los miembros usan autenticación
de dos factores en GitHub y en SignPath.

## Privacidad

El launcher no tiene telemetría. Los datos que manda, y por qué, están en
[PRIVACIDAD.md](PRIVACIDAD.md), que también se muestra durante la instalación.
