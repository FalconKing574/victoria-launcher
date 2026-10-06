; Lo incluye electron-builder solo: `nsis.include` usa build/installer.nsh por
; defecto. Las macros ${isUpdated} e ${isForceRun} las define electron-builder
; en la cabecera del script, antes de incluir este archivo.

; ---------------------------------------------------------------------------
; Una actualización NO vuelve a mostrar el asistente de instalación.
;
; El actualizador abre el instalador de la versión nueva con `--updated`. Las
; versiones del launcher hasta la 1.7.1 —incluida la 1.6.1 del instalador fijo
; que se reparte— lo abren además sin `/S`, así que el asistente aparecía otra
; vez: barra de «Instalando», página de «Finalizar» y la casilla de abrir el
; launcher. El jugador creía que la instalación había vuelto a empezar, y si
; cerraba esa ventana sin la casilla el launcher ni siquiera se volvía a abrir.
;
; En silencio no hay ventanas, y installSection.nsh abre el launcher solo al
; terminar (`--force-run` + Silent). Va acá y no sólo en el launcher porque el
; instalador nuevo es lo único de la actualización que controla la versión
; nueva: el código que lo abre es el de la versión vieja.
;
; Una instalación normal (doble clic en el .exe, sin `--updated`) sigue
; mostrando el asistente como siempre.
; ---------------------------------------------------------------------------
!macro customInit
  ${if} ${isUpdated}
    SetSilent silent
  ${endIf}
!macroend

; ---------------------------------------------------------------------------
; Sin la página «¿Para quién instalar? Todos los usuarios / Sólo para mí».
;
; El launcher se instala siempre para el usuario (perMachine: false, sin pedir
; administrador): «Todos los usuarios» sale deshabilitado o, si alguien abre el
; instalador como administrador, deja una segunda copia en Archivos de
; programa. Era una pregunta de más que nadie tenía que contestar, y además
; aparecía en cada actualización, porque skipPageIfUpdated no la salta.
; ---------------------------------------------------------------------------
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
