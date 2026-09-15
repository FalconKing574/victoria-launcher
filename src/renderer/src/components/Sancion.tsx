import { motion } from 'framer-motion'
import Button from './Button'
import type { SancionInfo } from '@shared/api'

const DISCORD_INVITE = 'https://discord.gg/HFvsGaxc7G'

export interface SancionProps {
  sancion: SancionInfo
  onCerrar?: () => void
}

function fecha(ms: number): string {
  return new Date(ms).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * La cuenta no puede jugar por una sanción.
 *
 * Si la sanción es de OTRA cuenta (comparte IP o equipo con un baneado), no se
 * muestra el motivo ni la fecha: eso es del otro. Se dice qué pasa y cómo pedir
 * revisión, que es lo único que le sirve a quien no hizo nada.
 */
export default function Sancion({ sancion, onCerrar }: SancionProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(7,7,11,0.82)',
        display: 'grid',
        placeItems: 'center',
        padding: 24
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(460px, 100%)',
          padding: 26,
          display: 'grid',
          gap: 14,
          borderColor: 'rgba(255, 92, 108, 0.4)'
        }}
      >
        <p className="eyebrow" style={{ margin: 0, color: 'var(--err)' }}>
          Victoria Kingdom
        </p>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {!sancion.propia
            ? 'No se puede jugar desde esta conexión'
            : sancion.permanente
              ? 'Tu cuenta está baneada'
              : 'Tu cuenta está suspendida'}
        </h2>

        {sancion.propia ? (
          <div style={{ display: 'grid', gap: 8, fontSize: 13.5, lineHeight: 1.55 }}>
            {sancion.motivo && (
              <p style={{ margin: 0 }}>
                <span style={{ color: 'var(--text-dim)' }}>Motivo: </span>
                {sancion.motivo}
              </p>
            )}
            <p style={{ margin: 0 }}>
              <span style={{ color: 'var(--text-dim)' }}>Hasta: </span>
              {sancion.permanente || !sancion.hasta ? 'permanente' : fecha(sancion.hasta)}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>{sancion.mensaje}</p>
        )}

        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
          {sancion.propia
            ? 'Si creés que es un error, abrí un ticket en el Discord de Victoria para apelar.'
            : 'Si compartís internet con otra persona (familia, residencia, datos móviles), pedí revisión por ticket: el staff puede habilitar tu cuenta.'}
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button onClick={() => void window.api.window.openExternal(DISCORD_INVITE)}>Abrir el Discord</Button>
          {onCerrar && (
            <Button variant="ghost" onClick={onCerrar}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
