import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../components/Icon'
import Panel from '../components/Panel'
import { Switch } from '../components/Toggle'
import { screenVariants } from '../theme/motion'
import type { RemovedShaderPack, ShaderSettings } from '@shared/api'

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const mb = bytes / 1048576
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export default function Shaders(): JSX.Element {
  const [settings, setSettings] = useState<ShaderSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Confirmación de lo que acaba de pasar, para las acciones cuyo efecto no se
  // ve en la propia lista.
  const [note, setNote] = useState<string | null>(null)
  // Borrar un archivo no se deshace, así que el botón pide confirmación en el
  // sitio en vez de hacerlo a la primera.
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.shaders
      .get()
      .then((next) => {
        if (alive) setSettings(next)
      })
      .catch(() => {
        if (alive) setError('No se pudo leer la configuración de shaders.')
      })
    return () => {
      alive = false
    }
  }, [])

  async function toggleOculus(next: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      setSettings(await window.api.shaders.setEnabled(next))
    } catch {
      setError('No se pudo cambiar la opción. ¿Está el modpack instalado?')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Devuelve un shader quitado.
   *
   * Los que se quitaron con el launcher nuevo están en la papelera y reaparecen
   * arriba en el acto. Los que borró la versión vieja ya no existen: lo único
   * que se puede hacer es sacarlos de la lista de bloqueo para que el pack los
   * reinstale. Sin decirlo, esa segunda ruta se veía como un botón roto — la
   * fila desaparecía y no volvía nada.
   */
  async function restorePack(pack: RemovedShaderPack): Promise<void> {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      setSettings(await window.api.shaders.restore(pack.filename))
      if (!pack.restorable) {
        setNote(
          `«${pack.name}» ya no está bloqueado. Volverá a instalarse la próxima vez que se actualice el modpack.`
        )
      }
    } catch {
      setError('No se pudo recuperar ese shader.')
    } finally {
      setBusy(false)
    }
  }

  async function selectPack(filename: string): Promise<void> {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      setSettings(await window.api.shaders.select(filename))
    } catch {
      setError('No se pudo elegir ese shader.')
    } finally {
      setBusy(false)
    }
  }

  async function deletePack(filename: string): Promise<void> {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      setSettings(await window.api.shaders.delete(filename))
      setConfirming(null)
    } catch {
      setError('No se pudo borrar ese shader. ¿Está el juego abierto?')
    } finally {
      setBusy(false)
    }
  }

  const enabled = settings?.enabled ?? false
  const packs = settings?.packs ?? []
  const removed = settings?.removed ?? []
  // Con Oculus apagado no hay shader en uso, aunque su archivo de configuración
  // siga recordando cuál era: marcar uno como activo mientras están
  // desactivados es exactamente lo que confunde.
  const selected = enabled ? settings?.selected : null
  // El que sigue apuntado con Oculus apagado. Es el que volverá al encenderlo,
  // así que se señala aparte en vez de dejarlo invisible.
  const remembered = enabled ? null : (settings?.selected ?? null)

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: 26,
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 16
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Shaders</h1>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
          Iluminación, sombras y agua realistas. Cuesta FPS, así que viene apagado.
        </p>
      </div>

      <div style={{ overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' }}>
        {/* El interruptor maestro. Todo lo de abajo depende de él. */}
        <Panel style={{ padding: '15px 17px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                flexShrink: 0,
                background: enabled ? 'rgba(230,180,34,0.14)' : 'rgba(255,255,255,0.05)',
                color: enabled ? 'var(--gold-bright)' : 'var(--text-faint)',
                transition: 'background 0.18s, color 0.18s'
              }}
            >
              <Icon name="shaders" size={19} />
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Activar Oculus</div>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  lineHeight: 1.55
                }}
              >
                Oculus es lo que hace funcionar los shaders. Apagado, Minecraft arranca sin
                ninguno — pero no se desinstala nada y al volver a encenderlo recuperas el que
                usabas.
              </p>
            </div>

            <Switch
              checked={enabled}
              disabled={busy || settings === null}
              onChange={toggleOculus}
              ariaLabel="Activar Oculus"
            />
          </div>
        </Panel>

        {error && (
          <div
            className="row"
            style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--err)', lineHeight: 1.55 }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <p className="eyebrow" style={{ margin: 0 }}>
            Shaders disponibles
          </p>
          {/* Merece decirlo: dentro del juego el menú de shaders solo enseña el
              que está en uso, porque los demás no están en la carpeta. */}
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
            solo el que uses se carga en el juego
          </span>
        </div>

        {/* Bloqueado en vez de oculto: esconder la lista no explicaría por qué
            no hay nada que tocar, y el motivo es justo lo que hay que decir. */}
        {!enabled && (
          <div
            className="row"
            style={{
              padding: '13px 15px',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              fontSize: 12.5,
              color: 'var(--gold-bright)',
              lineHeight: 1.55
            }}
          >
            <Icon name="info" size={16} />
            <span>Para poder ponerte shaders tienes que activar Oculus aquí arriba.</span>
          </div>
        )}

        {settings !== null && packs.length === 0 && (
          <div
            className="row"
            style={{ padding: '13px 15px', fontSize: 13, color: 'var(--text-dim)' }}
          >
            {settings.installed
              ? 'No hay ningún shader en la carpeta shaderpacks todavía.'
              : 'Todavía no has instalado el modpack. Dale a JUGAR una vez y vuelve aquí.'}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
            gap: 12,
            // La lista entera no se bloquea: con Oculus apagado no puedes elegir
            // shader, pero sí borrar uno que ya no quieras tener ahí.
            transition: 'opacity 0.18s'
          }}
        >
          {packs.map((pack, index) => {
            const active = selected === pack.filename
            const isConfirming = confirming === pack.filename
            return (
              <Panel
                key={pack.filename}
                delay={0.03 * index}
                style={{
                  padding: '14px 15px',
                  display: 'grid',
                  gap: 9,
                  alignContent: 'start',
                  border: active ? '1px solid var(--gold)' : undefined,
                  background: active ? 'rgba(230,180,34,0.07)' : undefined
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {/* Recortado: un shader que meta el jugador puede tener un
                      nombre largo, y al partirse en dos líneas estiraba toda la
                      fila de tarjetas de la rejilla. */}
                  <span
                    title={pack.filename}
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pack.name}
                  </span>
                  {active && (
                    <span style={{ color: 'var(--gold-bright)', display: 'flex' }}>
                      <Icon name="check" size={16} />
                    </span>
                  )}
                  {/* Con Oculus apagado ninguna ficha va resaltada, así que sin
                      esto el jugador pierde de vista cuál volvería al encenderlo
                      — que es el que sigue apuntado en oculus.properties. */}
                  {remembered === pack.filename && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        padding: '3px 7px',
                        borderRadius: 5,
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-faint)'
                      }}
                    >
                      último usado
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    paddingTop: 8,
                    borderTop: '1px solid var(--stroke)'
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {formatSize(pack.sizeBytes)}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {/* El que está en uso se puede apagar desde aquí.
                        Antes este botón ponía «En uso» y estaba inerte, así que
                        la única forma de dejar de usar un shader era borrarlo o
                        buscar el interruptor de arriba. Dejar de usarlo escribe
                        enableShaders=false y NO toca shaderPack: el archivo se
                        queda, Minecraft arranca sin shaders, y al volver a
                        activarlo reaparece el mismo. */}
                    <button
                      onClick={() =>
                        void (active ? toggleOculus(false) : selectPack(pack.filename))
                      }
                      disabled={busy || !enabled}
                      title={
                        active
                          ? 'Arrancar sin shaders, sin desinstalarlo'
                          : 'Usar este shader al arrancar'
                      }
                      style={{
                        padding: '7px 13px',
                        borderRadius: 8,
                        border: '1px solid var(--stroke-strong)',
                        background: active ? 'transparent' : 'rgba(255,255,255,0.05)',
                        color: active ? 'var(--gold-bright)' : 'var(--text)',
                        fontSize: 12,
                        cursor: busy || !enabled ? 'default' : 'pointer',
                        opacity: !enabled || busy ? 0.45 : 1
                      }}
                    >
                      {active ? 'Dejar de usar' : 'Usar'}
                    </button>

                    <button
                      onClick={() => {
                        if (isConfirming) void deletePack(pack.filename)
                        else setConfirming(pack.filename)
                      }}
                      onBlur={() => setConfirming(null)}
                      disabled={busy}
                      title={
                        isConfirming
                          ? 'Pulsa otra vez para quitarlo'
                          : 'Quitar este shader (puedes recuperarlo)'
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: isConfirming ? '7px 11px' : 7,
                        borderRadius: 8,
                        border: `1px solid ${isConfirming ? 'var(--err)' : 'var(--stroke-strong)'}`,
                        background: isConfirming ? 'rgba(255,92,108,0.14)' : 'transparent',
                        color: isConfirming ? 'var(--err)' : 'var(--text-faint)',
                        fontSize: 12,
                        cursor: busy ? 'default' : 'pointer',
                        opacity: busy ? 0.5 : 1
                      }}
                    >
                      <Icon name="trash" size={14} />
                      {isConfirming && '¿Seguro?'}
                    </button>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>

        {/* Recuperar lo borrado.
            Borrar un shader lo mandaba a rmSync y apuntaba su nombre para
            volver a borrarlo tras cada actualización del pack, así que no había
            ninguna forma de recuperarlo. Ahora va a una papelera y esta sección
            lo devuelve. Sólo sale si hay algo que devolver. */}
        {(removed.length > 0 || note) && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Shaders que quitaste
              </p>
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                el launcher no los reinstala hasta que se lo digas
              </span>
            </div>

            {/* Sin esto, quitar un shader de la lista de bloqueo hacía
                desaparecer la fila y nada más: no había forma de saber que
                había funcionado. */}
            {note && (
              <div
                className="row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '12px 14px',
                  fontSize: 12.5,
                  color: 'var(--ok)',
                  lineHeight: 1.55
                }}
              >
                <Icon name="check" size={16} />
                <span>{note}</span>
              </div>
            )}

            {removed.map((pack) => (
              <div
                key={pack.filename}
                className="row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 13px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    title={pack.filename}
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pack.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {pack.restorable
                      ? `${formatSize(pack.sizeBytes)} · guardado, vuelve al instante`
                      : 'el archivo ya no está: lo reinstala el pack al actualizarse'}
                  </div>
                </div>

                {/* La etiqueta cambia porque la acción es distinta. Para uno
                    guardado, el shader reaparece arriba y se ve solo. Para uno
                    que ya no existe, lo único que pasa es que deja de estar
                    bloqueado, y eso no se ve en ningún sitio: lo cuenta el
                    aviso de arriba. */}
                <button
                  onClick={() => void restorePack(pack)}
                  disabled={busy}
                  title={
                    pack.restorable
                      ? 'Devolverlo a la carpeta de shaders'
                      : 'Dejar de bloquearlo para que el pack lo reinstale'
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 13px',
                    borderRadius: 8,
                    border: '1px solid var(--stroke-strong)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontSize: 12.5,
                    flexShrink: 0,
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.5 : 1
                  }}
                >
                  <Icon name="refresh" size={14} />
                  {pack.restorable ? 'Recuperar' : 'Desbloquear'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
