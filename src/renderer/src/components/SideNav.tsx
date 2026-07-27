import { motion } from 'framer-motion'
import Icon, { type IconName } from './Icon'
import logo from '../assets/logo.png'

export type NavKey = 'play' | 'modpack' | 'mods' | 'rules' | 'settings'

const ITEMS: Array<{ key: NavKey; label: string; icon: IconName }> = [
  { key: 'play', label: 'Jugar', icon: 'play' },
  { key: 'modpack', label: 'Modpack', icon: 'package' },
  { key: 'mods', label: 'Mods', icon: 'mods' },
  { key: 'rules', label: 'Reglas', icon: 'book' },
  { key: 'settings', label: 'Ajustes', icon: 'settings' }
]

export interface SideNavProps {
  active: NavKey
  onSelect: (key: NavKey) => void
  username: string
  accountType: 'premium' | 'offline'
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
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--stroke)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        padding: '20px 14px',
        gap: 20
      }}
    >
      <img
        src={logo}
        alt="Victoria Kingdom"
        style={{ width: '100%', imageRendering: 'pixelated', padding: '0 4px' }}
      />

      <div style={{ display: 'grid', gap: 3, alignContent: 'start' }}>
        {ITEMS.map((item) => {
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: isActive ? 'rgba(230,180,34,0.10)' : 'transparent',
                color: isActive ? 'var(--gold-bright)' : 'var(--text-dim)',
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                textAlign: 'left',
                transition: 'background 0.16s, color 0.16s'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-indicator"
                  style={{
                    position: 'absolute',
                    left: -14,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: 'var(--gold)'
                  }}
                />
              )}
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 9,
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--stroke)'
          }}
        >
          <img
            src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/32`}
            alt=""
            onError={(event) => {
              // Sin conexión el avatar no carga; el hueco vale más que el icono roto.
              event.currentTarget.style.visibility = 'hidden'
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              imageRendering: 'pixelated',
              flexShrink: 0,
              background: 'var(--surface-3)'
            }}
          />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {username}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.6,
                color: accountType === 'premium' ? 'var(--ok)' : 'var(--text-faint)'
              }}
            >
              {accountType === 'premium' ? 'PREMIUM' : 'SIN PREMIUM'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '8px 10px',
            borderRadius: 9,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-faint)',
            fontSize: 12.5,
            textAlign: 'left',
            transition: 'color 0.16s, background 0.16s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--err)'
            e.currentTarget.style.background = 'rgba(255,92,108,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-faint)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Icon name="logout" size={15} />
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
