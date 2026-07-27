import Icon, { type IconName } from './Icon'

export default function TitleBar(): JSX.Element {
  return (
    <div
      style={{
        height: 'var(--titlebar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 16px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--stroke)',
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 50
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 1.6,
          color: 'var(--text-faint)'
        }}
      >
        VICTORIA KINGDOM
      </span>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <WindowButton icon="minimize" onClick={() => window.api.window.minimize()} />
        <WindowButton icon="maximize" onClick={() => window.api.window.maximize()} />
        <WindowButton icon="close" danger onClick={() => window.api.window.close()} />
      </div>
    </div>
  )
}

function WindowButton({
  icon,
  onClick,
  danger
}: {
  icon: IconName
  onClick: () => void
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        width: 44,
        height: 'var(--titlebar-h)',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        display: 'grid',
        placeItems: 'center',
        transition: 'background 0.16s, color 0.16s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--err)' : 'rgba(255,255,255,0.07)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      <Icon name={icon} size={icon === 'maximize' ? 12 : 14} />
    </button>
  )
}
