import { useState, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export interface CampoProps {
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  tipo?: 'text' | 'password' | 'email'
  placeholder?: string
  /** Va a la izquierda, dentro del campo. */
  icono?: IconName
  /** Marca el campo como «Opcional», a la derecha. */
  opcional?: boolean
  autoFocus?: boolean
  /** Texto chico debajo: una ayuda, o el problema si `error`. */
  nota?: ReactNode
  error?: boolean
  maxLength?: number
  inputMode?: 'numeric' | 'text' | 'email'
}

/**
 * El campo de texto de las pantallas de cuenta, al estilo del launcher de
 * Majestic (07-10-2026): etiqueta arriba, ícono y texto de ejemplo adentro,
 * relleno plano sin borde hasta que se enfoca, y un ojo para ver la contraseña
 * — escribirla dos veces a ciegas era la forma más fácil de equivocarse.
 */
export default function Campo({
  etiqueta,
  valor,
  onCambio,
  tipo = 'text',
  placeholder,
  icono,
  opcional,
  autoFocus,
  nota,
  error,
  maxLength,
  inputMode
}: CampoProps): JSX.Element {
  const [foco, setFoco] = useState(false)
  const [visible, setVisible] = useState(false)
  const esContrasena = tipo === 'password'

  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{etiqueta}</span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 46,
          padding: '0 12px 0 14px',
          background: foco ? 'var(--campo-hover)' : 'var(--campo)',
          // Enfocado en blanco, no en el acento: con el acento rojo, un campo
          // enfocado se confundía con uno con error.
          border: `1px solid ${error ? 'var(--err)' : foco ? 'rgba(255, 255, 255, 0.42)' : 'transparent'}`,
          borderRadius: 'var(--r-md)',
          transition: 'border-color 0.16s, background 0.16s'
        }}
      >
        {icono && (
          <span
            style={{
              display: 'flex',
              color: foco ? 'var(--text)' : 'var(--text-faint)',
              transition: 'color 0.16s'
            }}
          >
            <Icon name={icono} size={16} />
          </span>
        )}
        <input
          type={esContrasena && visible ? 'text' : tipo}
          value={valor}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          onChange={(e) => onCambio(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14
          }}
        />
        {opcional && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Opcional</span>}
        {esContrasena && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault()
              setVisible((v) => !v)
            }}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={{
              display: 'flex',
              padding: 4,
              border: 0,
              background: 'none',
              color: visible ? 'var(--text)' : 'var(--text-faint)',
              cursor: 'pointer'
            }}
          >
            <Icon name={visible ? 'eye' : 'eyeOff'} size={17} />
          </button>
        )}
      </span>
      {nota && (
        <span
          style={{
            fontSize: 12,
            color: error ? 'var(--err)' : 'var(--text-faint)',
            lineHeight: 1.5
          }}
        >
          {nota}
        </span>
      )}
    </label>
  )
}
