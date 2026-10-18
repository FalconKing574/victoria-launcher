import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icon'
import type { RegistroContenido, RegistroInfo } from '@shared/api'

/**
 * Ajustes → Registros (18-10-2026).
 *
 * Cuando algo falla el staff pide «mandá el log», y el jugador no sabe cuál ni dónde está. Acá están todos,
 * con un nombre que se entiende, para leerlos sin salir del launcher, copiarlos o abrir la carpeta y
 * arrastrar el archivo a Discord. Abajo, la reparación de Minecraft y Forge, que es lo que suele resolver
 * lo que esos registros muestran.
 */
export default function Registros(): JSX.Element {
  const [lista, setLista] = useState<RegistroInfo[] | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback((): void => {
    window.api.registros
      .lista()
      .then((l) => {
        setLista(l)
        setError(null)
      })
      .catch(() => setError('No se pudieron leer los registros.'))
  }, [])

  useEffect(recargar, [recargar])

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--err)' }}>{error}</p>}

      {lista === null && !error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>Buscando registros...</p>
      )}

      {lista?.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Todavía no hay registros. Aparecen después del primer JUGAR.
        </p>
      )}

      {lista?.map((r) => (
        <div key={r.id} className="row" style={{ display: 'grid', gap: 10, padding: '11px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {cuando(r.modificado)} · {peso(r.tamano)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>{r.descripcion}</div>
            </div>
            <button
              onClick={() => setAbierto(abierto === r.id ? null : r.id)}
              aria-expanded={abierto === r.id}
              style={boton(abierto === r.id)}
            >
              {abierto === r.id ? 'Cerrar' : 'Ver'}
            </button>
            <button
              onClick={() => void window.api.registros.carpeta(r.id).catch(() => recargar())}
              title="Mostrar en la carpeta"
              aria-label={`Mostrar ${r.nombre} en la carpeta`}
              style={{ ...boton(false), padding: '9px 10px', display: 'grid', placeItems: 'center' }}
            >
              <Icon name="folder" size={14} />
            </button>
          </div>
          {abierto === r.id && <Visor registro={r} onPerdido={recargar} />}
        </div>
      ))}

      <Reparar onHecho={recargar} />
    </div>
  )
}

/** Renglones que vale la pena mirar primero: errores, excepciones y sus pilas. */
const ERROR = /\b(ERROR|FATAL|SEVERE)\b|Exception|Failed|Caused by|^\s+at\s+[\w.$/]+\(/
const AVISO = /\bWARN(ING)?\b/

function Visor({ registro, onPerdido }: { registro: RegistroInfo; onPerdido: () => void }): JSX.Element {
  const [contenido, setContenido] = useState<RegistroContenido | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [soloErrores, setSoloErrores] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const caja = useRef<HTMLPreElement>(null)

  const cargar = useCallback((): void => {
    setFallo(null)
    window.api.registros
      .leer(registro.id)
      .then(setContenido)
      .catch(() => {
        setFallo('No se pudo leer el archivo. Puede que se haya borrado.')
        onPerdido()
      })
  }, [registro.id, onPerdido])

  useEffect(cargar, [cargar])

  const renglones = useMemo(() => {
    const todos = (contenido?.texto ?? '').split(/\r?\n/)
    return soloErrores ? todos.filter((l) => ERROR.test(l)) : todos
  }, [contenido, soloErrores])

  // El error casi siempre está al final: se abre mirando el final.
  useLayoutEffect(() => {
    if (caja.current) caja.current.scrollTop = caja.current.scrollHeight
  }, [renglones])

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(renglones.join('\n'))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      setFallo('No se pudo copiar. Usá «Abrir» y copialo desde ahí.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setSoloErrores(!soloErrores)} aria-pressed={soloErrores} style={chip(soloErrores)}>
          Sólo errores
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={() => void copiar()} style={chip(copiado)} disabled={!contenido}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button onClick={() => void window.api.registros.abrir(registro.id).catch(() => onPerdido())} style={chip(false)}>
          Abrir
        </button>
        <button onClick={cargar} style={chip(false)} title="Volver a leer" aria-label="Volver a leer">
          <Icon name="refresh" size={12} />
        </button>
      </div>

      {fallo && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--err)' }}>{fallo}</p>}

      <pre
        ref={caja}
        style={{
          margin: 0,
          maxHeight: 300,
          minHeight: 120,
          overflow: 'auto',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--stroke)',
          background: 'var(--surface-2)',
          fontFamily: 'ui-monospace, Consolas, "Cascadia Mono", monospace',
          fontSize: 11,
          lineHeight: 1.55,
          color: 'var(--text-dim)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          userSelect: 'text'
        }}
      >
        {!contenido && !fallo && 'Leyendo...'}
        {contenido && renglones.length === 0 && (soloErrores ? 'Ningún error en este registro.' : 'El archivo está vacío.')}
        {contenido &&
          renglones.map((l, i) => (
            <div
              key={i}
              style={{ color: ERROR.test(l) ? 'var(--err)' : AVISO.test(l) ? '#e0b04a' : undefined }}
            >
              {l || ' '}
            </div>
          ))}
      </pre>

      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', wordBreak: 'break-all' }}>
        {contenido?.recortado ? 'Se muestra el final del archivo. ' : ''}
        {registro.ruta}
      </div>
    </div>
  )
}

/**
 * Borra Forge entero y revisa Minecraft con los hashes de Mojang. Es lo mismo que hace el launcher solo
 * cuando Forge falla al instalarse; acá está a mano para quien lo necesite antes de volver a probar.
 */
function Reparar({ onHecho }: { onHecho: () => void }): JSX.Element {
  const [confirmar, setConfirmar] = useState(false)
  const [estado, setEstado] = useState<'listo' | 'reparando' | 'hecho' | 'error'>('listo')
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function reparar(): Promise<void> {
    setConfirmar(false)
    setEstado('reparando')
    setMensaje(null)
    try {
      const r = await window.api.launch.reparar()
      setEstado('hecho')
      setMensaje(
        `Listo: ${r.borrados} ${r.borrados === 1 ? 'archivo borrado' : 'archivos y carpetas borrados'}. ` +
          'Se vuelven a bajar al apretar JUGAR (tarda un poco más esa vez).'
      )
      onHecho()
    } catch (e) {
      setEstado('error')
      setMensaje((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  return (
    <div className="row" style={{ display: 'grid', gap: 10, padding: '12px 13px', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reparar Minecraft y Forge</div>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: estado === 'error' ? 'var(--err)' : estado === 'hecho' ? 'var(--ok)' : 'var(--text-faint)'
            }}
          >
            {mensaje ??
              'Para «Failed to run processor» y errores de Forge al iniciar. No toca mods, mundos, ajustes ni tu cuenta.'}
          </div>
        </div>
        {confirmar ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmar(false)} style={boton(false)}>
              Cancelar
            </button>
            <button onClick={() => void reparar()} style={boton(true)}>
              Sí, reparar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmar(true)}
            disabled={estado === 'reparando'}
            style={{ ...boton(false), opacity: estado === 'reparando' ? 0.5 : 1 }}
          >
            {estado === 'reparando' ? 'Reparando...' : 'Reparar'}
          </button>
        )}
      </div>
    </div>
  )
}

function boton(activo: boolean): CSSProperties {
  return {
    padding: '9px 14px',
    borderRadius: 9,
    border: '1px solid var(--stroke-strong)',
    background: activo ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'rgba(255,255,255,0.05)',
    color: activo ? 'var(--gold-bright)' : 'var(--text)',
    fontSize: 12.5,
    flexShrink: 0,
    cursor: 'pointer'
  }
}

function chip(activo: boolean): CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid var(--stroke-strong)',
    background: activo ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'rgba(255,255,255,0.04)',
    color: activo ? 'var(--gold-bright)' : 'var(--text-dim)',
    fontSize: 11.5,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer'
  }
}

function peso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function cuando(ms: number): string {
  const fecha = new Date(ms)
  const hoy = new Date()
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (fecha.toDateString() === hoy.toDateString()) return `hoy ${hora}`
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (fecha.toDateString() === ayer.toDateString()) return `ayer ${hora}`
  return `${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${hora}`
}
