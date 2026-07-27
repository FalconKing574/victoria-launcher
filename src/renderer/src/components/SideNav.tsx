import { motion } from 'framer-motion'
import logo from '../assets/logo.png'

export type NavKey = 'play' | 'mods' | 'settings'

const ITEMS: Array<{ key: NavKey; label: string; icon: string }> = [
  { key: 'play', label: 'Jugar', icon: '▶' },
  { key: 'mods', label: 'Mods', icon: '🧩' },
  { key: 'settings', label: 'Ajustes', icon: '⚙' }
]

export interface SideNavProps {
  active: NavKey
  onSelect: (key: NavKey) => void
  username: string
  accountType: 'premium' | 'custom'
  onLogout: () => void
}

export default function SideNav({
  active,
  onSelect,
  username,
  accountType,
  onLogout
}: SideNavProps): JSX.Element {
  return (
    <nav
      className="glass"
      style={{
        width: 214,
        borderRadius: 0,
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        padding: '22px 16px',
        gap: 18
      }}
    >
      <img src={logo} alt="Victoria Kingdom" style={{ width: '100%', imageRendering: 'pixelated' }} />

      <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 13px',
              borderRadius: 11,
              border: 'none',
              background: active === item.key ? 'rgba(230,180,34,0.12)' : 'transparent',
              color: active === item.key ? 'var(--gold-bright)' : 'var(--text-dim)',
              fontSize: 14,
              textAlign: 'left',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {active === item.key && (
              <motion.span
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 9,
                  bottom: 9,
                  width: 3,
                  borderRadius: 99,
                  background: 'var(--gold)'
                }}
              />
            )}
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 11,
            background: 'rgba(255,255,255,0.04)'
          }}
        >
          <img
            src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/32`}
            alt=""
            style={{ width: 32, height: 32, borderRadius: 7, imageRendering: 'pixelated' }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {username}
            </div>
            <div style={{ fontSize: 10, color: accountType === 'premium' ? 'var(--ok)' : 'var(--text-faint)' }}>
              {accountType === 'premium' ? 'PREMIUM' : 'LAUNCHER'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            fontSize: 12,
            textDecoration: 'underline',
            textAlign: 'left',
            paddingLeft: 10
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
