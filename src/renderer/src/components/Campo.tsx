import type { ReactNode } from 'react'

export interface CampoProps {
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  tipo?: 'text' | 'password' | 'email'
  placeholder?: string
  autoFocus?: boolean
  /** Texto chico debajo: una ayuda, o el problema si `error`. */
  nota?: ReactNode
  error?: boolean
  maxLength?: number
  inputMode?: 'numeric' | 'text' | 'email'
}

/** El campo de texto de las pantallas de cuenta, con el mismo estilo que tenía el login. */
export default function Campo({
  etiqueta,
  valor,
  onCambio,
  tipo = 'text',
  placeholder,
  autoFocus,
  nota,
  error,
  maxLength,
  inputMode
}: CampoProps): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span className="eyebrow">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(e) => onCambio(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: `1px solid ${error ? 'var(--err)' : 'var(--stroke)'}`,
          borderRadius: 10,
          padding: '11px 13px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.16s'
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = error ? 'var(--err)' : 'var(--stroke)')}
      />
      {nota && (
        <span style={{ fontSize: 12, color: error ? 'var(--err)' : 'var(--text-faint)', lineHeight: 1.5 }}>
          {nota}
        </span>
      )}
    </label>
  )
}
