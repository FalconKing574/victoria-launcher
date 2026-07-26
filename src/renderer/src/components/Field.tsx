export interface FieldProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus
}: FieldProps): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-faint)' }}>
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--stroke)',
          borderRadius: 11,
          padding: '12px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s'
        }}
        onFocus={(event) => {
          event.currentTarget.style.borderColor = 'var(--gold)'
          event.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        }}
        onBlur={(event) => {
          event.currentTarget.style.borderColor = 'var(--stroke)'
          event.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        }}
      />
    </label>
  )
}
