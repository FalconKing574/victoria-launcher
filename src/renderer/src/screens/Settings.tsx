import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import Icon, { type IconName } from '../components/Icon'
import Panel from '../components/Panel'
import Toggle from '../components/Toggle'
import { screenVariants } from '../theme/motion'
import type { Settings as SettingsType } from '@shared/api'

/**
 * Copiados de `src/main/lib/settings-core.ts` — el renderer no puede importar
 * del proceso principal, así que si allí cambian, hay que cambiarlos aquí.
 *
 * Por encima de ~10 GB el juego va PEOR, no mejor: un heap más grande obliga al
 * recolector de basura a recorrer más memoria en cada pasada, así que las pausas
 * duran más y se notan como tirones.
 */
const RAM_ABSOLUTE_MIN_MB = 4096
const RAM_MIN_RECOMMENDED_MB = 6144
const RAM_RECOMMENDED_MB = 8192
const RAM_DIMINISHING_MB = 10240

const RAM_SLIDER_MIN_MB = 2048
const RAM_SLIDER_MAX_MB = 16384

export interface SettingsProps {
  username?: string
  accountType?: 'premium' | 'offline'
  onLogout?: () => void
}

export default function Settings({ username, accountType, onLogout }: SettingsProps): JSX.Element {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    // Without the catch, a failed read leaves this screen on "Cargando..." forever
    // with nothing logged and no way for the user to know why.
    window.api.settings
      .get()
      .then(setSettings)
      .catch(() => setError('No se pudieron cargar los ajustes.'))
  }, [])

  async function patch(update: Partial<SettingsType>): Promise<void> {
    try {
      setSettings(await window.api.settings.save(update))
      setError(null)
      // Lets AmbientMusic pick up a music toggle without a restart.
      window.dispatchEvent(new CustomEvent('settings-changed'))
    } catch {
      setError('No se pudieron guardar los ajustes.')
    }
  }

  async function handleSwitchAccount(): Promise<void> {
    setSwitching(true)
    try {
      await window.api.auth.microsoftLogout()
    } catch {
      // Cerrar la sesión guardada puede fallar, pero volver al login sigue
      // siendo lo que el usuario ha pedido.
    } finally {
      setSwitching(false)
      onLogout?.()
    }
  }

  if (error && !settings) {
    return <div style={{ padding: 34, color: 'var(--err)' }}>{error}</div>
  }
  if (!settings) return <div style={{ padding: 34 }}>Cargando...</div>

  const memoryGb = settings.maxMemoryMb / 1024
  const memoryNote = describeMemory(settings.maxMemoryMb)

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ padding: 26, height: '100%', overflowY: 'auto' }}
    >
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Ajustes</h1>
        <p style={{ margin: '5px 0 18px', fontSize: 13, color: 'var(--text-dim)' }}>
          Todo se guarda solo, en cuanto lo cambias.
        </p>

        {error && <p style={{ margin: '0 0 14px', color: 'var(--err)', fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'grid', gap: 14 }}>
          <Section
            icon="user"
            title="Cuenta"
            help="Con la que el launcher entra a Minecraft."
          >
            <div
              className="row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 13px'
              }}
            >
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(username ?? 'Steve')}/32`}
                alt=""
                onError={(event) => {
                  // Sin conexión el avatar no carga; mejor sin nada que roto.
                  event.currentTarget.style.visibility = 'hidden'
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  imageRendering: 'pixelated',
                  flexShrink: 0,
                  background: 'var(--surface-3)'
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {username ?? 'Sin sesión'}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: accountType === 'premium' ? 'var(--ok)' : 'var(--text-faint)'
                  }}
                >
                  {accountType === 'premium'
                    ? 'Cuenta premium de Microsoft'
                    : 'Cuenta sin premium (modo offline)'}
                </div>
              </div>
              <button
                onClick={handleSwitchAccount}
                disabled={switching || !onLogout}
                style={{
                  padding: '9px 14px',
                  borderRadius: 9,
                  border: '1px solid var(--stroke-strong)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  flexShrink: 0,
                  opacity: switching || !onLogout ? 0.5 : 1,
                  cursor: switching || !onLogout ? 'not-allowed' : 'pointer'
                }}
              >
                {switching ? 'Cerrando...' : 'Cambiar cuenta'}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {accountType === 'premium'
                ? 'Cambiar de cuenta cierra la sesión de Microsoft guardada y te devuelve a la pantalla de inicio.'
                : 'Si compraste Minecraft y sigue apareciendo «sin premium», pulsa Cambiar cuenta y entra con Microsoft: eso borra la sesión offline guardada.'}
            </p>
          </Section>

          <Section
            icon="gauge"
            title="Rendimiento"
            help="Cuánta memoria le damos a Java y cómo la gestiona."
          >
            <div style={{ display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>Memoria máxima</span>
                <span style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                  {memoryGb.toFixed(1)} GB
                </span>
              </div>

              <input
                type="range"
                min={RAM_SLIDER_MIN_MB}
                max={RAM_SLIDER_MAX_MB}
                step={512}
                value={settings.maxMemoryMb}
                aria-label="Memoria máxima"
                onChange={(event) => patch({ maxMemoryMb: Number(event.target.value) })}
                style={{ accentColor: 'var(--gold)', width: '100%' }}
              />

              {/* Las marcas van colocadas en su posición real del recorrido, no
                  repartidas a ojo: si no, "8 GB recomendado" cae en el centro y
                  señala a un valor que no es. */}
              <div style={{ position: 'relative', height: 15, marginTop: -2 }}>
                <Tick mb={RAM_ABSOLUTE_MIN_MB} label="4 GB mínimo" />
                <Tick mb={RAM_RECOMMENDED_MB} label="8 GB recomendado" highlight />
                <Tick mb={RAM_DIMINISHING_MB} label="10 GB tope" />
              </div>

              <div
                className="row"
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  alignItems: 'flex-start'
                }}
              >
                <span style={{ color: memoryNote.color, paddingTop: 1 }}>
                  <Icon name={memoryNote.icon} size={14} />
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {memoryNote.text}
                </span>
              </div>
            </div>

            <Toggle
              label="Optimización de la JVM"
              description="Ajusta el recolector de basura de Java (G1GC) para repartir las pausas y quitar los tirones. Déjalo activado salvo que sepas lo que haces."
              checked={settings.optimizedJvm}
              onChange={(value) => patch({ optimizedJvm: value })}
            />
          </Section>

          <Section icon="play" title="Juego" help="Qué hace el launcher al arrancar Minecraft.">
            <Toggle
              label="Cerrar el launcher al iniciar el juego"
              description="Libera algo de memoria; el modpack se actualiza igual la próxima vez que lo abras."
              checked={settings.closeOnLaunch}
              onChange={(value) => patch({ closeOnLaunch: value })}
            />

            <div style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 14 }}>Ruta de Java</span>
              <input
                value={settings.javaPath ?? ''}
                placeholder="Automático (detectado del sistema)"
                onChange={(event) => patch({ javaPath: event.target.value || null })}
                spellCheck={false}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--stroke)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  transition: 'border-color 0.16s'
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--stroke)')}
              />
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                Déjalo vacío y el launcher busca un Java 17 en tu equipo. Sólo apunta a un
                javaw.exe concreto si el automático te da problemas.
              </p>
            </div>
          </Section>

          <Section icon="settings" title="Launcher" help="La aplicación en sí.">
            <Toggle
              label="Música del launcher"
              description="Suena de fondo mientras navegas por el launcher, nunca dentro del juego."
              checked={settings.musicEnabled}
              onChange={(value) => patch({ musicEnabled: value })}
            />
          </Section>
        </div>
      </div>
    </motion.div>
  )
}

function Section({
  icon,
  title,
  help,
  children
}: {
  icon: IconName
  title: string
  help: string
  children: ReactNode
}): JSX.Element {
  return (
    <Panel style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'rgba(230,180,34,0.12)',
            color: 'var(--gold-bright)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <Icon name={icon} size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{help}</div>
        </div>
      </div>
      {children}
    </Panel>
  )
}

/** Una marca bajo el slider, alineada con el valor al que se refiere. */
function Tick({
  mb,
  label,
  highlight
}: {
  mb: number
  label: string
  highlight?: boolean
}): JSX.Element {
  const percent = ((mb - RAM_SLIDER_MIN_MB) / (RAM_SLIDER_MAX_MB - RAM_SLIDER_MIN_MB)) * 100
  return (
    <span
      style={{
        position: 'absolute',
        left: `${percent}%`,
        top: 0,
        transform: 'translateX(-50%)',
        fontSize: 10.5,
        whiteSpace: 'nowrap',
        letterSpacing: 0.3,
        color: highlight ? 'var(--gold)' : 'var(--text-faint)'
      }}
    >
      {label}
    </span>
  )
}

interface MemoryNote {
  icon: IconName
  color: string
  text: string
}

/** Traduce los MB del slider a la recomendación que toca. */
function describeMemory(mb: number): MemoryNote {
  if (mb < RAM_ABSOLUTE_MIN_MB) {
    return {
      icon: 'warning',
      color: 'var(--err)',
      text: `Por debajo de ${RAM_ABSOLUTE_MIN_MB / 1024} GB el modpack no arranca de forma fiable: te quedarás sin memoria al cargar el mundo.`
    }
  }
  if (mb < RAM_MIN_RECOMMENDED_MB) {
    return {
      icon: 'warning',
      color: 'var(--gold)',
      text: `Poco para este modpack. Por debajo de ${RAM_MIN_RECOMMENDED_MB / 1024} GB el juego funciona, pero con tirones al explorar.`
    }
  }
  if (mb < RAM_DIMINISHING_MB) {
    const recommended = mb === RAM_RECOMMENDED_MB
    return {
      icon: 'check',
      color: 'var(--ok)',
      text: recommended
        ? `${RAM_RECOMMENDED_MB / 1024} GB es el punto justo para este modpack: es lo que usaba la instancia original.`
        : `Buen rango. El punto justo para este modpack son ${RAM_RECOMMENDED_MB / 1024} GB.`
    }
  }
  return {
    icon: 'warning',
    color: 'var(--gold)',
    text: `Más de ${RAM_DIMINISHING_MB / 1024} GB no mejora nada: cuanta más memoria, más tarda Java en limpiarla y más largas son las pausas. Vuelve a ${RAM_RECOMMENDED_MB / 1024} GB salvo que sepas por qué necesitas más.`
  }
}
