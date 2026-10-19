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
   https://github.com/settings/security. Activada (lo confirmó el dueño el
   09-10-2026). La cuenta que se cree en SignPath también la necesita.
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
   | What will be signed | `Victoria Kingdom.exe`, its NSIS uninstaller and the NSIS installer `Victoria-Kingdom-actualizacion-<version>.exe` |
   | Project website (si lo pide) | https://victoriakingdom.pages.dev |

   Descripción sugerida (en inglés, que es como leen):

   > Victoria Kingdom Launcher is the open source (MIT) desktop launcher for the
   > Victoria Kingdom Minecraft roleplay server. It installs Java, Minecraft
   > 1.20.1, Forge and the server's modpack, keeps them updated, and manages the
   > player's server account (Microsoft sign-in or a server account with email
   > verification) and Discord linking. It is built with Electron and
   > electron-builder on GitHub Actions. Installers are per-user and never
   > request administrator rights. No telemetry.

3. Lo que SignPath pide antes de mirar el formulario ya está: `main` tiene
   `LICENSE`, `FIRMA-DE-CODIGO.md` y `PRIVACIDAD.md`, el repo es público, y hay
   versiones publicadas armadas en GitHub Actions (la 1.8.1, 07-10-2026, fue la
   primera que salió entera por `publicar.yml`).
4. Si el formulario pide algo que no está en la tabla (cantidad de usuarios,
   motivo, etc.), contestar con datos reales; no inventar números.

**Ojo con los nombres.** `.signpath/instalador.xml` tiene que buscar el mismo
nombre que `nsis.artifactName` de `electron-builder.yml`. Hasta el 09-10-2026
buscaba `Victoria Kingdom Setup *.exe`, el nombre de antes del instalador fijo:
la primera firma se habría cortado sin firmar nada.

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

## 4. Mientras no haya firma

**Desde el 10-10-2026 los jugadores bajan siempre el instalador de la última
versión** (`scripts/instalador-jugadores.mjs`, ver `02-actualizar-launcher.md`
§6). Sin firma, el aviso de SmartScreen puede salir con cada versión nueva:
es lo que pasa hasta que esté la firma de SignPath.

Antes, del 27-09 al 10-10-2026, se probó otra cosa: un **instalador fijo**.

- **Un único instalador para todos**: `Victoria-Kingdom-Setup.exe` (launcher
  1.6.1, SHA-256 `f3853e7b7be46de9b542c7e32111ffa20251bc4b628b1ede924ea672683ea3e5`)
  en la release `instalador`, copiado a cada versión. La idea: SmartScreen ata
  la reputación al archivo, y si el archivo no cambia, lo que junte no se pierde.
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
    is released»: sin firma, cada archivo nuevo empieza de cero.
  - «once your signing certificate has gained reputation in our system, all
    applications or releases signed with your certificate should have
    warn-free experience»: por eso lo que lo cierra es la firma.
- **Por qué se dejó:** el 1.6.1 quedó viejo. Quien instalaba de cero arrancaba
  en una versión de semanas atrás y el 10-10 el dueño lo vio quedarse en el
  logo al abrir. Y la reputación del fijo no alcanzaba para quitar el aviso.
- **En el navegador integrado de Claude** (para un envío nuevo a Microsoft): ya
  logueado, entrar directo a `filesubmission?persona=SoftwareDeveloper` (el
  botón «Continue» de la portada deja una página en blanco). No deja adjuntar
  archivos de la PC ni pasar el captcha final: eso lo hace el usuario.

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
