import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Button from './Button'
import { Switch } from './Toggle'
import { RAM_ABSOLUTE_MIN_MB, RAM_MIN_RECOMMENDED_MB, RAM_RECOMMENDED_MB } from '@shared/tuning'
import type { EquipoInfo, OptionalMod } from '@shared/api'
import { INFO_PRESETS, presetSugerido, type PresetGrafico } from '@shared/opciones-graficas'

/**
 * El último paso del tutorial: dejar el juego configurado para esta PC.
 *
 * Todo lo que se toca acá se puede cambiar después en Ajustes, Shaders y Mods;
 * esto sólo elige un buen punto de partida para quien no sabe qué es "memoria
 * asignada" ni si su placa aguanta shaders.
 */

/**
 * La memoria sugerida según la RAM de la PC.
 *
 * Nunca más de la mitad: el sistema, el navegador y Discord también necesitan,
 * y un Minecraft que se come toda la RAM va peor que uno con menos.
 */
export function memoriaSugerida(totalMb: number): number {
  const mitad = Math.floor(totalMb / 2 / 1024) * 1024
  return Math.max(RAM_ABSOLUTE_MIN_MB, Math.min(RAM_RECOMMENDED_MB, mitad))
}

export interface ConfigGuiadaProps {
  onListo: () => void
}

export default function ConfigGuiada({ onListo }: ConfigGuiadaProps): JSX.Element {
  const [equipo, setEquipo] = useState<EquipoInfo | null>(null)
  const [memoria, setMemoria] = useState<number | null>(null)
  const [shaders, setShaders] = useState(false)
  // La configuración gráfica de arranque (02-10-2026): la sugerida según la PC.
  const [preset, setPreset] = useState<PresetGrafico>('equilibrada')
  const [sugerido, setSugerido] = useState<PresetGrafico | null>(null)
  const [opcionales, setOpcionales] = useState<OptionalMod[]>([])
  const [activos, setActivos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [nivel, setNivel] = useState<number | null>(null)
  const [errorMic, setErrorMic] = useState<string | null>(null)
  const detener = useRef<(() => void) | null>(null)

  useEffect(() => {
    void Promise.all([window.api.sistema.equipo(), window.api.modpack.state().catch(() => null)]).then(([e, estado]) => {
      setEquipo(e)
      setMemoria(memoriaSugerida(e.memoriaMb))
      const dedicada = e.gpu === 'nvidia' || e.gpu === 'amd'
      // Shaders sólo con placa dedicada: en una integrada de Intel el juego
      // pasa de jugable a diapositivas, y el jugador cree que el servidor anda mal.
      setShaders(dedicada)
      const p = presetSugerido(e.gpu, e.memoriaMb)
      setPreset(p)
      setSugerido(p)
      // Distant Horizons viene prendido; con video integrado se sugiere apagado (es lo
      // que más pide a la placa). Se puede volver a prender acá mismo o en Mods.
      const activosAhora = estado?.enabledOptional ?? []
      setActivos(dedicada ? activosAhora : activosAhora.filter((id) => id !== 'distant-horizons'))
    })
    void window.api.modpack.manifest().then((m) => setOpcionales(m.optional ?? [])).catch(() => undefined)
    return () => detener.current?.()
  }, [])

  async function probarMicrofono(): Promise<void> {
    setErrorMic(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analizador = ctx.createAnalyser()
      analizador.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analizador)
      const datos = new Uint8Array(analizador.fftSize)
      let cuadro = 0
      const medir = (): void => {
        analizador.getByteTimeDomainData(datos)
        let pico = 0
        for (const v of datos) pico = Math.max(pico, Math.abs(v - 128))
        setNivel(Math.min(1, pico / 64))
        cuadro = requestAnimationFrame(medir)
      }
      medir()
      detener.current?.()
      detener.current = () => {
        cancelAnimationFrame(cuadro)
        stream.getTracks().forEach((t) => t.stop())
        void ctx.close()
      }
    } catch (e) {
      // Cada motivo tiene su arreglo; un mensaje único mandaba a mirar Windows
      // cuando el que lo bloqueaba era el propio launcher.
      const nombre = (e as DOMException)?.name
      setErrorMic(
        nombre === 'NotFoundError' || nombre === 'OverconstrainedError'
          ? 'No encontramos ningún micrófono. Conectá uno y probá de nuevo.'
          : nombre === 'NotReadableError'
            ? 'El micrófono está ocupado por otra aplicación (Discord, OBS…). Cerrala o soltalo y probá de nuevo.'
            : nombre === 'NotAllowedError' || nombre === 'SecurityError'
              ? 'Windows no deja usar el micrófono. Abrí Configuración → Privacidad y seguridad → Micrófono y activá «Permitir que las aplicaciones de escritorio accedan al micrófono».'
              : `No se pudo abrir el micrófono (${nombre ?? 'error desconocido'}).`
      )
    }
  }

  async function guardar(): Promise<void> {
    setGuardando(true)
    try {
      if (memoria) await window.api.settings.save({ maxMemoryMb: memoria })
      await window.api.shaders.setEnabled(shaders).catch(() => undefined)
      await window.api.graficos.aplicar(preset).catch(() => undefined)
      const estado = await window.api.modpack.state().catch(() => null)
      for (const mod of opcionales) {
        const quiere = activos.includes(mod.id)
        const tiene = estado?.enabledOptional.includes(mod.id) ?? false
        if (quiere !== tiene) await window.api.modpack.setOptional(mod.id, quiere).catch(() => undefined)
      }
      detener.current?.()
      onListo()
    } finally {
      setGuardando(false)
    }
  }

  const gb = (mb: number): string => `${Math.round(mb / 1024)} GB`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(7,7,11,0.86)', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      <div className="panel" style={{ width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 26, display: 'grid', gap: 18 }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Paso 5 de 5</p>
          <h2 style={{ margin: '4px 0 0', fontSize: 21 }}>Configuración para tu PC</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            Elegimos lo mejor para tu equipo. Todo se puede cambiar después.
          </p>
        </div>

        <Bloque titulo="Memoria para el juego">
          {equipo && memoria ? (
            <>
              <p style={texto}>
                Tu PC tiene {gb(equipo.memoriaMb)}. Le damos <b>{gb(memoria)}</b> al juego.
                {memoria < RAM_MIN_RECOMMENDED_MB &&
                  ' Es lo justo para el modpack: cerrá el navegador mientras jugás.'}
              </p>
              <input
                type="range"
                min={RAM_ABSOLUTE_MIN_MB}
                max={Math.max(RAM_ABSOLUTE_MIN_MB, Math.min(RAM_RECOMMENDED_MB, Math.floor(equipo.memoriaMb * 0.75 / 1024) * 1024))}
                step={1024}
                value={memoria}
                onChange={(e) => setMemoria(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </>
          ) : (
            <p style={texto}>Midiendo tu PC…</p>
          )}
        </Bloque>

        <Bloque titulo="Gráficos">
          <p style={texto}>
            Una configuración de video pensada para el modpack. Se cambia cuando quieras en Opciones → Video
            del juego.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {INFO_PRESETS.map((info) => {
              const elegido = info.id === preset
              return (
                <button
                  key={info.id}
                  onClick={() => setPreset(info.id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 11px',
                    borderRadius: 10,
                    border: elegido ? '1px solid var(--gold-bright)' : '1px solid var(--stroke)',
                    background: elegido ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'var(--surface-3)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 4,
                    alignContent: 'start'
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: elegido ? 'var(--gold-bright)' : 'var(--text)' }}>
                    {info.nombre}
                  </span>
                  {sugerido === info.id && (
                    <span style={{ fontSize: 10.5, color: 'var(--ok)', fontWeight: 600 }}>Recomendada para tu PC</span>
                  )}
                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>{info.detalle}</span>
                </button>
              )
            })}
          </div>
        </Bloque>

        <Bloque titulo="Shaders (luces y sombras realistas)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={texto}>
              {equipo?.gpu === 'nvidia' || equipo?.gpu === 'amd'
                ? 'Tenés placa de video dedicada: los activamos.'
                : 'Tu placa de video es integrada: mejor sin shaders para que el juego vaya fluido.'}
            </p>
            <Switch checked={shaders} onChange={setShaders} />
          </div>
        </Bloque>

        {opcionales.length > 0 && (
          <Bloque titulo="Mods opcionales">
            <div style={{ display: 'grid', gap: 10 }}>
              {opcionales.map((mod) => (
                <div key={mod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5 }}>{mod.name}</p>
                    <p style={{ ...texto, fontSize: 12 }}>{mod.summary}</p>
                  </div>
                  <Switch
                    checked={activos.includes(mod.id)}
                    onChange={(on) => setActivos((a) => (on ? [...a, mod.id] : a.filter((x) => x !== mod.id)))}
                  />
                </div>
              ))}
            </div>
          </Bloque>
        )}

        <Bloque titulo="Micrófono (chat de voz por proximidad)">
          <p style={texto}>
            En Victoria se habla con los que están cerca. Probá que tu micrófono se escuche; las teclas de voz están
            en Opciones → Controles del juego.
          </p>
          {nivel === null ? (
            <Button variant="ghost" onClick={() => void probarMicrofono()}>Probar micrófono</Button>
          ) : (
            <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(nivel * 100)}%`, height: '100%', background: 'var(--ok)', transition: 'width 60ms' }} />
            </div>
          )}
          {errorMic && <p style={{ ...texto, color: 'var(--err)' }}>{errorMic}</p>}
        </Bloque>

        <Button full loading={guardando} onClick={() => void guardar()}>
          Listo, a jugar
        </Button>
      </div>
    </motion.div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }): JSX.Element {
  return (
    <section style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--stroke)' }}>
      <h3 style={{ margin: 0, fontSize: 14, color: 'var(--gold-bright)' }}>{titulo}</h3>
      {children}
    </section>
  )
}

const texto: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }
