import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Icon, { type IconName } from '../components/Icon'
import Panel from '../components/Panel'
import ProgressBar from '../components/ProgressBar'
import RemoteImage from '../components/RemoteImage'
import { screenVariants } from '../theme/motion'
import heroBandera from '../assets/hero-bandera.png'
import newsServidor from '../assets/news/servidor.jpg'
import newsComunidad from '../assets/news/comunidad.jpg'
import newsModpack from '../assets/news/modpack.jpg'
import type {
  LaunchProgress,
  LaunchStatus,
  EstadoServidor,
  RespuestaCuenta,
  SyncCheck,
  UpdaterState
} from '@shared/api'
import { shouldBlockPlay } from '../lib/play-gate'
import { leerBloqueo } from '../lib/bloqueo'
import { avisoLauncher } from '../lib/aviso-launcher'
import type { NavKey } from '../components/SideNav'
import type { IUser } from 'minecraft-launcher-core'

/* ------------------------------------------------------------------------- *
 * IMÁGENES
 *
 * Todas locales. Antes las tres fichas de novedades eran fotos de stock de
 * Unsplash enlazadas en caliente: nada que ver con el servidor, y sin conexión
 * las tres se caían a una letra sobre un cuadro dorado — que es lo que se veía
 * como "no cargan las imágenes".
 *
 * Ahora son recortes de las caras del panorama original (`assets/panorama/
 * original/`, 2048px sin desenfocar), o sea capturas de verdad del mundo del
 * servidor. Se regeneran con el bloque de sharp de `scripts/`; 106 KB las tres.
 * Si algún día hay capturas mejores, se sustituyen estos tres archivos y ya.
 * ------------------------------------------------------------------------- */
const HERO_IMAGE = heroBandera

const NEWS_IMAGES = {
  servidor: newsServidor,
  comunidad: newsComunidad,
  modpack: newsModpack
}
/* ------------------------------------------------------------------------- */

export interface HomeProps {
  username: string
  mclcUser?: IUser
  offlineUsername?: string
  /** Lets the update notice send the player straight to Ajustes. */
  onNavigate?: (key: NavKey) => void
  /**
   * El servidor de cuentas no dio el vale: sanción o pasos pendientes. La
   * pantalla que corresponde la decide `App`, que es quien las tiene.
   */
  onBloqueo?: (respuesta: RespuestaCuenta) => void
}

const NEWS = [
  {
    tag: 'Servidor',
    image: NEWS_IMAGES.servidor,
    title: 'Victoria Kingdom — temporada abierta',
    body: 'Minecraft 1.20.1 con Forge 47.4.0 y el modpack completo ya instalado.'
  },
  {
    tag: 'Comunidad',
    image: NEWS_IMAGES.comunidad,
    title: 'Eventos y avisos en Discord',
    body: 'Las novedades, caídas y eventos se anuncian primero en el Discord del servidor.'
  },
  {
    tag: 'Modpack',
    image: NEWS_IMAGES.modpack,
    title: 'Mods opcionales a tu gusto',
    body: 'En la pestaña Modpack eliges qué extras instalar sin romper la partida.'
  }
]

export default function Home({
  username,
  mclcUser,
  offlineUsername,
  onNavigate,
  onBloqueo
}: HomeProps): JSX.Element {
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  // Sólo para las fichas informativas: si fallan, la ficha muestra un guión y
  // el resto de la pantalla sigue funcionando igual.
  const [modCount, setModCount] = useState<number | null>(null)
  const [modsEnabled, setModsEnabled] = useState<number | null>(null)
  const [memoryMb, setMemoryMb] = useState<number | null>(null)

  // Playing with an outdated pack gets you rejected by the server with an error
  // nobody can read, so the button is blocked until the pack matches.
  const [pending, setPending] = useState<SyncCheck | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateNote, setUpdateNote] = useState<string | null>(null)

  // How many files are still queued, so the label is a real count.
  const [remaining, setRemaining] = useState<number | null>(null)

  // The launcher's own update, so the notice can cover both.
  const [updater, setUpdater] = useState<UpdaterState | null>(null)

  // En línea y cuánta gente hay, como el «Jugando ahora» de Majestic. Antes el
  // puntito verde era fijo: decía «en línea» aunque el servidor estuviera caído.
  const [servidor, setServidor] = useState<EstadoServidor | null>(null)

  // VALIDAR ARCHIVOS (02-10-2026): primero se explica qué hace, después se hace.
  const [confirmarValidar, setConfirmarValidar] = useState(false)
  const [validando, setValidando] = useState(false)

  const refreshPending = useCallback((): void => {
    window.api.modpack
      .check()
      .then(setPending)
      .catch(() => undefined)
  }, [])

  /**
   * One button. It installs or repairs whatever the pack needs and then starts
   * the game, so nobody has to know a modpack screen exists or understand what
   * "sincronizar" means — they press play and it works.
   */
  async function handlePlay(): Promise<void> {
    setError(null)
    setUpdateNote(null)

    setLaunching(true)

    try {
      if (shouldBlockPlay(pending)) {
        setUpdating(true)
        const report = await window.api.modpack.sync()
        setUpdating(false)
        setUpdateNote(
          report.downloaded === 0 && report.removed === 0
            ? null
            : `Modpack listo: ${report.downloaded} archivos instalados.`
        )
        refreshPending()
      }

      await window.api.launch.start({ mclcUser, offlineUsername })
    } catch (caught) {
      mostrarError((caught as Error).message)
      setLaunching(false)
      setUpdating(false)
    }
  }

  /**
   * VALIDAR ARCHIVOS: vuelve a instalar los mods y la configuración del pack tal
   * como vienen. Es lo que se le pide a alguien a quien «algo no le anda»: un jar
   * dañado, una config tocada a mano, un mod de más. No toca mundos, capturas,
   * teclas ni los mods que el jugador agregó por su cuenta (sólo se los nombra,
   * porque suelen ser la causa).
   */
  async function handleValidar(): Promise<void> {
    setConfirmarValidar(false)
    setError(null)
    setUpdateNote(null)
    setUpdating(true)
    setValidando(true)
    try {
      const report = await window.api.modpack.validate()
      const propios = report.keptOwn.length
      setUpdateNote(
        `Archivos validados: ${report.downloaded === 0 ? 'todos los mods estaban bien' : `${report.downloaded} reinstalados`}` +
          (report.configuracion ? ' y la configuración del pack, restablecida.' : '.') +
          (propios > 0
            ? ` Tenés ${propios} ${propios === 1 ? 'mod propio' : 'mods propios'} fuera del pack (${report.keptOwn.slice(0, 3).join(', ')}${propios > 3 ? '…' : ''}): si algo sigue fallando, probá sacándolos.`
            : '')
      )
      refreshPending()
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setUpdating(false)
      setValidando(false)
    }
  }

  /**
   * Un error de lanzamiento puede ser un bloqueo de la cuenta. Ese no se
   * muestra como texto rojo: va a la pantalla de sanción o a los pasos.
   */
  function mostrarError(mensaje: string): void {
    const bloqueo = leerBloqueo(mensaje)
    if (!bloqueo) {
      setError(mensaje)
      return
    }
    if ((bloqueo.error === 'sancion' || bloqueo.error === 'pasos' || bloqueo.error === 'sesion') && onBloqueo) {
      setError(null)
      onBloqueo(bloqueo)
      return
    }
    setError(bloqueo.mensaje ?? 'El servidor de Victoria no dejó entrar. Probá de nuevo.')
  }

  useEffect(() => {
    refreshPending()

    // The download runs in the main process and carries on while this screen is
    // unmounted, which happens every time the player clicks another sidebar
    // tab. Rebuilding from that snapshot instead of starting blank is what
    // stops a install in progress from looking like it had stalled.
    window.api.modpack
      .live()
      .then((snapshot) => {
        if (!snapshot.running) return
        setUpdating(true)
        setProgress({ type: 'modpack', percent: snapshot.percent })
        setRemaining(Math.max(0, snapshot.total - snapshot.done))
        if (snapshot.message) setStatus({ stage: 'download', message: snapshot.message })
      })
      .catch(() => undefined)

    const offSyncStatus = window.api.modpack.onStatus((s) =>
      setStatus({ stage: 'download', message: s.message })
    )
    const offSyncProgress = window.api.modpack.onProgress((p) => {
      setProgress({ type: 'modpack', percent: p.percent })
      setRemaining(Math.max(0, p.total - p.done))
    })
    // These two finish a sync this screen may not have started itself, so they
    // are what clear the state after a tab change.
    const offSyncDone = window.api.modpack.onDone(() => {
      setUpdating(false)
      setRemaining(null)
      refreshPending()
    })
    const offSyncError = window.api.modpack.onError((payload) => {
      setError(payload.message)
      setUpdating(false)
      setLaunching(false)
    })
    return () => {
      offSyncStatus()
      offSyncProgress()
      offSyncDone()
      offSyncError()
    }
  }, [refreshPending])

  useEffect(() => {
    let vivo = true
    const consultar = (): void => {
      window.api.servidor
        .estado()
        .then((estado) => {
          if (vivo) setServidor(estado)
        })
        .catch(() => undefined)
    }
    consultar()
    const reloj = setInterval(consultar, 60_000)
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [])

  // Checked on every mount, so opening the launcher always reports what is
  // pending instead of leaving it to be discovered in Ajustes.
  useEffect(() => {
    window.api.updater
      .state()
      .then(setUpdater)
      .catch(() => undefined)
    return window.api.updater.onState(setUpdater)
  }, [])

  useEffect(() => {
    // The launch may already be running if the user navigated away and back:
    // this screen unmounts on tab change, which used to reset the button to
    // "JUGAR" while Forge was still downloading.
    window.api.launch
      .isRunning()
      .then(setLaunching)
      .catch(() => undefined)

    window.api.mods
      .list()
      .then((mods) => {
        setModCount(mods.length)
        setModsEnabled(mods.filter((mod) => mod.enabled).length)
      })
      .catch(() => undefined)

    window.api.settings
      .get()
      .then((settings) => setMemoryMb(settings.maxMemoryMb))
      .catch(() => undefined)

    const offProgress = window.api.launch.onProgress(setProgress)
    const offStatus = window.api.launch.onStatus(setStatus)
    const offError = window.api.launch.onError((payload) => {
      // El mismo error llega también por el rechazo de `launch.start`; con
      // bloqueo, sólo lo trata ese camino para no abrir la pantalla dos veces.
      if (!leerBloqueo(payload.message)) setError(payload.message)
      setLaunching(false)
    })
    const offClosed = window.api.launch.onClosed((info) => {
      setLaunching(false)
      setStatus(null)
      setProgress(null)
      // A non-zero exit means the game died rather than being closed normally.
      if (info.code !== 0) {
        // Se prefiere lo que dice el propio crash report de Minecraft. El
        // mensaje de antes culpaba siempre a la memoria y a Java, que casi
        // nunca es el motivo, y mandaba a la gente a tocar lo que no era.
        setError(
          info.diagnosis
            ? `Minecraft se cerró solo.\n${info.diagnosis.message}` +
                (info.diagnosis.file ? `\n\nDetalle completo en:\n${info.diagnosis.file}` : '')
            : `Minecraft se cerró con el código ${info.code}. Si se repite, mira los crash-reports de la instancia.`
        )
      }
    })
    return () => {
      offProgress()
      offStatus()
      offError()
      offClosed()
    }
  }, [])

  // Whether play will install something first. Not a block any more — the
  // button does the work — but the label should say what is about to happen.
  const willInstall = shouldBlockPlay(pending)

  // Un solo aviso para las dos actualizaciones. La del launcher va primero: dice
  // cuándo se instala, que es lo que confundía (ver lib/aviso-launcher.ts).
  const aviso = avisoLauncher(updater)
  const updateNotice =
    aviso?.texto ??
    (willInstall
      ? `Hay una actualización del modpack pendiente: ${pending?.toDownload ?? 0} archivos` +
        `${pending?.latestVersion ? ` (v${pending.latestVersion})` : ''}.`
      : null)
  const alerta = aviso?.tono === 'alerta'

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: 24,
        height: '100%',
        display: 'grid',
        gap: 14,
        alignContent: 'start',
        overflowY: 'auto'
      }}
    >
      {/* Aviso de actualizaciones pendientes. Sale sólo cuando hay algo que
          contar. El botón hace lo que se pueda hacer desde acá; el resto
          lleva a Ajustes. */}
      {updateNotice && !updating && (
        <div
          className="row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            border: alerta ? '1px solid rgba(255,92,108,0.4)' : '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
            background: alerta ? 'rgba(255,92,108,0.07)' : 'color-mix(in srgb, var(--gold) 7%, transparent)'
          }}
        >
          <span
            style={{
              color: alerta ? 'var(--err)' : 'var(--gold-bright)',
              display: 'flex',
              flexShrink: 0
            }}
          >
            <Icon name={alerta ? 'warning' : 'download'} size={17} />
          </span>
          <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>{updateNotice}</span>
          {aviso?.accion && (
            <button
              onClick={() => void window.api.updater.install().catch(() => undefined)}
              style={avisoBoton}
            >
              {aviso.accion === 'reiniciar' ? 'Reiniciar ahora' : 'Reintentar'}
            </button>
          )}
          {(!aviso || aviso.tono === 'alerta') && (
            <button onClick={() => onNavigate?.('settings')} style={avisoBoton}>
              {aviso ? 'Qué hacer' : 'Ir a Ajustes'}
            </button>
          )}
        </div>
      )}

      {/* Banda principal: arte del servidor con el botón de jugar encima. */}
      <Panel style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: 232 }}>
        <RemoteImage
          src={HERO_IMAGE}
          style={{ position: 'absolute', inset: 0 }}
          position="center center"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // Dos capas: una lateral para el bloque de texto y otra inferior
            // para que el botón y el estado se lean sobre cualquier foto.
            background:
              'linear-gradient(0deg, rgba(14,14,15,0.94) 0%, rgba(14,14,15,0.55) 34%, rgba(14,14,15,0) 62%), linear-gradient(96deg, rgba(14,14,15,0.96) 0%, rgba(14,14,15,0.86) 40%, rgba(14,14,15,0.3) 100%)'
          }}
        />

        <div
          style={{
            position: 'relative',
            padding: '20px 22px',
            display: 'grid',
            gap: 18,
            alignContent: 'space-between',
            minHeight: 232
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: '0 0 5px' }}>
              Hola de nuevo, {username}
            </p>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.8 }}>
              Victoria Kingdom
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                marginTop: 7,
                fontSize: 12.5,
                color: 'var(--text-dim)'
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: servidor?.enLinea ? 'var(--ok)' : 'var(--text-faint)',
                  boxShadow: servidor?.enLinea ? '0 0 8px var(--ok)' : 'none',
                  flexShrink: 0
                }}
              />
              {servidor === null ? (
                'Consultando el servidor...'
              ) : servidor.enLinea ? (
                <span>
                  <b style={{ color: 'var(--text)', fontWeight: 600 }}>En línea</b>
                  {servidor.jugadores !== null &&
                    ` · ${servidor.jugadores} ${servidor.jugadores === 1 ? 'jugador' : 'jugadores'} ahora`}
                </span>
              ) : (
                'El servidor no responde'
              )}
              <span style={{ color: 'var(--text-faint)' }}>· Minecraft 1.20.1 · Forge 47.4.0</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap'
            }}
          >
            <div data-recorrido="jugar" style={{ width: 208, flexShrink: 0 }}>
              {/* `updating` counts too: after a tab change the install may be
                  one this mount never started, so `launching` is false while a
                  download is very much in progress. */}
              <Button full loading={launching || updating} onClick={() => void handlePlay()}>
                {validando ? 'VALIDANDO...' : updating ? 'INSTALANDO...' : launching ? 'INICIANDO...' : 'JUGAR'}
              </Button>
            </div>

            {/* Al lado de JUGAR, como lo pidió el usuario: el arreglo de «a mí no me
                anda» sin tener que explicar qué es una instancia. */}
            <div style={{ flexShrink: 0 }}>
              <Button
                variant="ghost"
                disabled={launching || updating}
                onClick={() => setConfirmarValidar(true)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="shield" size={16} />
                  VALIDAR ARCHIVOS
                </span>
              </Button>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              {/* Concrete counts rather than a vague "cargando": what is being
                  fetched and how much of it is left. */}
              {updating && progress ? (
                <ProgressBar
                  percent={progress.percent}
                  label={
                    remaining !== null
                      ? `Descargando el modpack · faltan ${remaining}`
                      : (status?.message ?? 'Descargando el modpack')
                  }
                />
              ) : launching && progress ? (
                <ProgressBar percent={progress.percent} label={status?.message ?? 'Preparando Forge'} />
              ) : (launching || updating) && status ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-dim)' }}>
                  {status.message}
                </p>
              ) : confirmarValidar ? (
                <div style={{ display: 'grid', gap: 9 }}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>
                    Vuelve a instalar los mods y la configuración del modpack tal como vienen.
                    No toca tus mundos, capturas, teclas ni los mods que agregaste vos. Puede
                    bajar varios cientos de MB.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => void handleValidar()}
                      style={{
                        padding: '8px 13px',
                        borderRadius: 8,
                        border: '1px solid color-mix(in srgb, var(--gold) 50%, transparent)',
                        background: 'color-mix(in srgb, var(--gold) 16%, transparent)',
                        color: 'var(--gold-bright)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Validar ahora
                    </button>
                    <button
                      onClick={() => setConfirmarValidar(false)}
                      style={{
                        padding: '8px 13px',
                        borderRadius: 8,
                        border: '1px solid var(--stroke-strong)',
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        fontSize: 12.5,
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : error ? (
                // pre-wrap: el diagnóstico del crash viene en varias líneas
                // (qué pasó, qué mod, dónde está el archivo) y en una sola
                // no se entiende nada. Seleccionable para poder pegarlo.
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: 'var(--err)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    userSelect: 'text',
                    maxHeight: 92,
                    overflowY: 'auto'
                  }}
                >
                  {error}
                </p>
              ) : willInstall ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--gold-bright)', lineHeight: 1.5 }}>
                  Hay {pending?.toDownload ?? 0} archivos por descargar
                  {pending?.latestVersion ? ` (v${pending.latestVersion})` : ''}. Se instalan solos
                  al pulsar JUGAR.
                </p>
              ) : updateNote ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ok)', lineHeight: 1.5 }}>
                  {updateNote}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                  El launcher prepara Forge y abre Minecraft con el modpack de Victoria Kingdom.
                </p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Fichas informativas. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))',
          gap: 10
        }}
      >
        <StatTile icon="globe" label="Versión" value="1.20.1" hint="Forge 47.4.0" />
        <StatTile
          icon="mods"
          label="Mods instalados"
          value={modCount === null ? '—' : String(modCount)}
          hint={modsEnabled === null ? 'leyendo la instancia' : `${modsEnabled} activos`}
        />
        <StatTile
          icon="gauge"
          label="Memoria asignada"
          value={memoryMb === null ? '—' : `${(memoryMb / 1024).toFixed(1)} GB`}
          hint="ajustable en Ajustes"
        />
        <StatTile
          icon="user"
          label="Cuenta"
          value={username}
          hint={offlineUsername ? 'modo sin premium' : 'sesión de Microsoft'}
        />
      </div>

      {/* Novedades. */}
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          Novedades
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))',
            gap: 12
          }}
        >
          {NEWS.map((item, index) => (
            <Panel
              key={item.title}
              delay={0.05 * (index + 1)}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div style={{ position: 'relative' }}>
                <RemoteImage src={item.image} alt="" label={item.tag} style={{ height: 82 }} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(rgba(14,14,15,0.25), rgba(14,14,15,0.88))'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    bottom: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    borderRadius: 5,
                    background: 'color-mix(in srgb, var(--gold) 16%, transparent)',
                    color: 'var(--gold-bright)'
                  }}
                >
                  {item.tag}
                </span>
              </div>
              <div style={{ padding: '12px 14px 15px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>{item.title}</div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {item.body}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function StatTile({
  icon,
  label,
  value,
  hint
}: {
  icon: IconName
  label: string
  value: string
  hint: string
}): JSX.Element {
  return (
    <div className="row" style={{ padding: '11px 13px', display: 'grid', gap: 3 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--text-faint)'
        }}
      >
        <Icon name={icon} size={13} />
        {label}
      </span>
      <span
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: -0.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{hint}</span>
    </div>
  )
}

const avisoBoton: React.CSSProperties = {
  padding: '8px 13px',
  borderRadius: 8,
  border: '1px solid var(--stroke-strong)',
  background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
  color: 'var(--gold-bright)',
  fontSize: 12.5,
  flexShrink: 0,
  cursor: 'pointer'
}
