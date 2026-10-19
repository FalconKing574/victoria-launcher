import { motion } from 'framer-motion'
import Avatar from './Avatar'
import Icon, { type IconName } from './Icon'
import logo from '../assets/logo.png'
import { ENLACES_WEB } from '@shared/web'

export type NavKey = 'play' | 'mods' | 'shaders' | 'settings'

const ITEMS: Array<{ key: NavKey; label: string; icon: IconName }> = [
  { key: 'play', label: 'Jugar', icon: 'play' },
  { key: 'mods', label: 'Mods', icon: 'mods' },
  { key: 'shaders', label: 'Shaders', icon: 'shaders' },
  { key: 'settings', label: 'Ajustes', icon: 'settings' }
]

/** Opens in the system browser rather than switching screens. */
const DISCORD_INVITE = 'https://discord.gg/HFvsGaxc7G'

/**
 * Lo que abre el navegador en vez de cambiar de pantalla. El Discord, con el
 * azul de Discord al pasar el mouse; la wiki (cómo se juega: banco, terrenos,
 * vehículos, teléfono), en gris.
 */
const EXTERNOS: Array<{
  label: string
  icon: IconName
  url: string
  fondo: string
  color: string
}> = [
  {
    label: 'Discord',
    icon: 'discord',
    url: DISCORD_INVITE,
    fondo: 'rgba(88,101,242,0.14)',
    color: '#a3adf7'
  },
  {
    label: 'Wiki',
    icon: 'book',
    url: ENLACES_WEB.wiki,
    fondo: 'rgba(255,255,255,0.04)',
    color: 'var(--text)'
  }
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
              data-recorrido={item.key}
              onClick={() => onSelect(item.key)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                // Como en Majestic: lo activo se marca con la barra del borde y el
                // ícono dorado, no tiñendo todo el renglón.
                background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
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
              <span style={{ display: 'flex', color: isActive ? 'var(--gold)' : 'inherit' }}>
                <Icon name={item.icon} size={16} />
              </span>
              {item.label}
            </button>
          )
        })}

        <span style={{ height: 1, background: 'var(--stroke)', margin: '9px 12px' }} />

        {EXTERNOS.map((externo) => (
          <button
            key={externo.label}
            onClick={() => {
              // Fire and forget: a blocked or missing browser must not break the nav.
              void window.api.window.openExternal(externo.url).catch(() => undefined)
            }}
            title={externo.url}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: 13.5,
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background 0.16s, color 0.16s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = externo.fondo
              e.currentTarget.style.color = externo.color
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            <Icon name={externo.icon} size={16} />
            <span style={{ flex: 1 }}>{externo.label}</span>
            <Icon name="external" size={12} />
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 9,
            borderRadius: 10,
            background: 'var(--surface-2)'
          }}
        >
          <Avatar username={username} size={30} radius={7} />
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
