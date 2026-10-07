import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { spring } from '../theme/motion'

type Variant = 'primary' | 'ghost' | 'microsoft'

/**
 * Planos y en mayúsculas, al estilo del launcher de Majestic (07-10-2026). Antes
 * el principal era un degradado dorado con brillo y todos crecían al pasar el
 * mouse; ahora el color hace el trabajo y el movimiento es mínimo.
 */
const STYLES: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--acento)', color: 'var(--acento-texto)', fontWeight: 800 },
  ghost: { background: 'var(--surface-3)', color: 'var(--text)', fontWeight: 700 },
  microsoft: { background: '#107c10', color: '#fff', fontWeight: 700 }
}

/**
 * Desactivado = gris plano, sea cual sea la variante. Va con un texto que dice
 * qué falta («Repetí la contraseña») en vez de un botón dorado medio apagado
 * que no explica por qué no se puede pulsar.
 */
const APAGADO: React.CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-faint)' }

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  full?: boolean
  /** Use "submit" inside a form so Enter works as well as the click. */
  type?: 'button' | 'submit'
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  full,
  type = 'button'
}: ButtonProps): JSX.Element {
  const inactive = disabled || loading
  // Cargando no es «falta algo»: conserva su color, con la ruedita.
  const apagado = disabled && !loading
  return (
    <motion.button
      type={type}
      whileHover={inactive ? undefined : { filter: 'brightness(1.1)' }}
      whileTap={inactive ? undefined : { scale: 0.98 }}
      transition={spring}
      onClick={inactive ? undefined : onClick}
      disabled={inactive}
      style={{
        ...STYLES[variant],
        ...(apagado ? APAGADO : {}),
        width: full ? '100%' : undefined,
        minHeight: 46,
        padding: '12px 20px',
        borderRadius: 'var(--r-md)',
        border: 'none',
        fontSize: 13,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        lineHeight: 1.25,
        opacity: loading ? 0.85 : 1,
        cursor: inactive ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 10
      }}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  )
}

function Spinner(): JSX.Element {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: 14,
        height: 14,
        border: '2px solid rgba(0,0,0,0.25)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0
      }}
    />
  )
}
