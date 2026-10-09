# Firma de código (SignPath Foundation)

Por qué: sin firma, SmartScreen («Windows protegió tu PC») y varios antivirus
desconfían del instalador. Con firma y reputación acumulada, en la práctica deja
de pasar. Es gratis porque el launcher es código abierto (MIT).

**Lo que se hizo del lado del código (15-09-2026):** licencia MIT + marca
(`LICENSE`, `MARCA.md`), `PRIVACIDAD.md` (también se muestra al instalar),
`FIRMA-DE-CODIGO.md`, instalador por usuario sin elevación y sin `elevate.exe`,
metadatos completos en cada `.exe`, y el workflow `.github/workflows/publicar.yml`
que arma y firma en GitHub Actions en dos vueltas (ver el comentario del
workflow y `scripts/firma.cjs`).

El editor que muestra Windows va a ser **«SignPath Foundation»**, no «Victoria
Kingdom»: el certificado es de ellos. Es así para todos los proyectos del
programa.

## 1. Pedirla (lo hace el dueño del repo)

1. **Verificación en dos pasos en GitHub** (obligatoria):
   https://github.com/settings/security
2. Formulario: https://signpath.org/apply
   Datos para completar:

   | Campo | Valor |
   |---|---|
   | Project name | Victoria Kingdom Launcher |
   | Repository | https://github.com/FalconKing574/victoria-launcher |
   | License | MIT |
   | Download page | https://github.com/FalconKing574/victoria-launcher/releases |
   | Code signing policy | https://github.com/FalconKing574/victoria-launcher/blob/main/FIRMA-DE-CODIGO.md |
   | Privacy policy | https://github.com/FalconKing574/victoria-launcher/blob/main/PRIVACIDAD.md |
   | Build system | GitHub Actions (`.github/workflows/publicar.yml`) |
   | What will be signed | `Victoria Kingdom.exe`, its NSIS uninstaller and the NSIS installer `Victoria Kingdom Setup <version>.exe` |

   Descripción sugerida (en inglés, que es como leen):

   > Victoria Kingdom Launcher is the open source (MIT) desktop launcher for the
   > Victoria Kingdom Minecraft roleplay server. It installs Java, Minecraft
   > 1.20.1, Forge and the server's modpack, keeps them updated, and manages the
   > player's server account (Microsoft sign-in or a server account with email
   > verification) and Discord linking. It is built with Electron and
   > electron-builder on GitHub Actions. Installers are per-user and never
   > request administrator rights. No telemetry.

3. **Importante:** SignPath pide que el proyecto ya esté publicado y que la rama
   `main` tenga los archivos de arriba. Antes de mandar el formulario hay que
   mergear `feat/cuentas-victoria` a `main` y publicar la 1.6.0.

## 2. Cuando aprueben

En SignPath (https://app.signpath.io):

1. Crear las dos **Artifact Configurations** pegando `.signpath/ejecutables.xml`
   (slug `ejecutables`) y `.signpath/instalador.xml` (slug `instalador`).
2. Crear un **API token** (usuario de CI) con permiso de enviar pedidos.
3. Anotar el **Organization ID**, el **project slug** y el **signing policy slug**.

En GitHub → repo → Settings → Secrets and variables → Actions:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `SIGNPATH_API_TOKEN` | el token de SignPath |
| Variable | `SIGNPATH_ORGANIZATION_ID` | el id de la organización |
| Variable | `SIGNPATH_PROJECT_SLUG` | el slug del proyecto |
| Variable | `SIGNPATH_POLICY_SLUG` | el slug de la política (normalmente `release-signing`) |

Con `SIGNPATH_ORGANIZATION_ID` puesta, el workflow firma solo. Sin ella, publica
sin firmar como antes.

## 3. Publicar una versión firmada

1. Subir `version` en `package.json`, commit a `main`.
2. `git tag v1.6.1 && git push origin v1.6.1`.
3. En SignPath aparecen **dos pedidos** (ejecutables e instalador): aprobarlos.
   El workflow espera hasta 4 horas cada uno.
4. El paso «Verificar que TODO quedó firmado» falla si queda algún `.exe` sin
   firma válida, antes de publicar nada.

Después de publicar, con `electron-builder.yml` → `verifyUpdateCodeSignature`
se puede pasar a `true` con `publisherName: SignPath Foundation`, **pero sólo
cuando los jugadores ya tengan una versión firmada**: un launcher sin firma que
exige firma al actualizarse queda trabado.

## 4. Mientras no haya firma: el instalador fijo (lo que está en uso)

El 27-09-2026 el usuario eligió no depender de SignPath por ahora. Lo que se
hizo en su lugar:

- **Un único instalador para todos**: `Victoria-Kingdom-Setup.exe` (launcher
  1.6.1, SHA-256 `f3853e7b7be46de9b542c7e32111ffa20251bc4b628b1ede924ea672683ea3e5`)
  en la release `instalador` (prerelease) y en `Desktop/Victoria Kingdom Launcher/`.
  SmartScreen ata la reputación al hash: si el archivo no cambia, la reputación
  que junte no se pierde.
- **Cada versión lleva una copia** del fijo (`scripts/instalador-fijo.mjs`, que
  corre solo al final de `npm run release` y del workflow), así el botón
  «Descargar» del Discord, que apunta a `/releases/latest`, entrega el fijo.
- **El `.exe` de cada versión** se llama `Victoria-Kingdom-actualizacion-<versión>.exe`:
  lo baja el actualizador, no los jugadores. El actualizador no pasa por
  SmartScreen (no le pone la marca de «descargado de internet»).
- **Enviado a Microsoft** como «Software developer» → producto «Microsoft
  Defender Smartscreen» → «Incorrectly detected as malware/malicious». El envío
  del 27-09 no llegó a salir (el historial estaba vacío el 01-10); el que vale es
  el del 01-10-2026, ID `fe36e6ff-1531-48d6-83ef-a48a4de46ea9`:
  https://www.microsoft.com/en-us/wdsi/submission/fe36e6ff-1531-48d6-83ef-a48a4de46ea9
  (cuenta Microsoft del usuario; el historial guarda 30 días).
- **Respuesta de Microsoft (llegó el 09-10-2026):** no habla de malware. Dice
  que el aviso es falta de reputación, que se junta sola con el uso (descargas,
  historial, resultados de antivirus, reputación de la URL) y que nadie la
  aprueba a mano. Volver a mandar el mismo archivo no cambia nada. Dos frases
  que deciden lo de este documento:
  - «unsigned files will have to establish reputation each time a new version
    is released»: por eso el fijo no se cambia.
  - «once your signing certificate has gained reputation in our system, all
    applications or releases signed with your certificate should have
    warn-free experience»: por eso lo que lo cierra es la firma.
- **En el navegador integrado de Claude**: ya logueado, entrar directo a
  `filesubmission?persona=SoftwareDeveloper` (el botón «Continue» de la
  portada deja una página en blanco). No deja adjuntar archivos de la PC ni
  pasar el captcha final: eso lo hace el usuario.

**Reemplazar el fijo** (sólo si hace falta, ver `02-actualizar-launcher.md` §6):
subir el nuevo a la release `instalador` con `gh release upload instalador
<archivo> --clobber` (con el nombre `Victoria-Kingdom-Setup.exe`), copiarlo a la
carpeta de reparto, actualizar el SHA-256 de este documento y de las notas de la
release, y **volver a mandarlo a Microsoft**: la reputación del viejo no pasa
al nuevo.

## 5. Reputación: lo que hace que deje de avisar

La firma sola no apaga SmartScreen el primer día: la reputación se junta con
descargas. Para acelerarla, con cada versión firmada:

1. **Microsoft (Defender + SmartScreen):**
   https://www.microsoft.com/en-us/wdsi/filesubmission → «Software developer» →
   subir el instalador → «Incorrectly detected as malware/malicious» o
   «SmartScreen warning». Con cuenta Microsoft.
2. **VirusTotal:** subir el instalador en https://www.virustotal.com. Si algún
   motor lo marca, cada uno tiene su formulario de falso positivo (Avast/AVG,
   Kaspersky, ESET, Bitdefender, etc.); se reporta con el link de VirusTotal.
3. **No cambiar** el nombre del producto, el publicador ni el tipo de
   instalador entre versiones: la reputación se ata a eso.
