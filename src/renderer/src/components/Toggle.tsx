import { motion } from 'framer-motion'

export interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  /** Screen-reader name when the switch is not next to a visible label. */
  ariaLabel?: string
}

/** The bare pill switch, for rows that already have their own layout. */
export function Switch({ checked, onChange, disabled, ariaLabel }: SwitchProps): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 46,
        height: 25,
        borderRadius: 99,
        border: 'none',
        padding: 3,
        background: checked ? 'var(--gold)' : 'rgba(255,255,255,0.14)',
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 0.22s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff' }}
      />
    </button>
  )
}

export interface ToggleProps extends SwitchProps {
  label: string
  /** One line explaining what the setting actually does. */
  description?: string
}

/** A labelled settings row: name, optional helper line, switch on the right. */
export default function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled
}: ToggleProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        {description && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  )
}
