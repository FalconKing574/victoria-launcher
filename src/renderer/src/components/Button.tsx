import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { spring } from '../theme/motion'

type Variant = 'primary' | 'ghost' | 'microsoft'

const STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold-deep))',
    color: '#241a00',
    boxShadow: 'var(--shadow-gold)',
    fontWeight: 700
  },
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    border: '1px solid var(--stroke-strong)'
  },
  microsoft: { background: '#107c10', color: '#fff', fontWeight: 600 }
}

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  full?: boolean
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  full
}: ButtonProps): JSX.Element {
  const inactive = disabled || loading
  return (
    <motion.button
      whileHover={inactive ? undefined : { scale: 1.025, y: -1 }}
      whileTap={inactive ? undefined : { scale: 0.975 }}
      transition={spring}
      onClick={inactive ? undefined : onClick}
      disabled={inactive}
      style={{
        ...STYLES[variant],
        width: full ? '100%' : undefined,
        padding: '13px 22px',
        borderRadius: 12,
        border: STYLES[variant].border ?? 'none',
        fontSize: 14,
        letterSpacing: 0.3,
        opacity: inactive ? 0.55 : 1,
        cursor: inactive ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
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
        display: 'inline-block'
      }}
    />
  )
}
