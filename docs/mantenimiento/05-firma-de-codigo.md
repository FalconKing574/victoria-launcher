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

## 4. Reputación: lo que hace que deje de avisar

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
