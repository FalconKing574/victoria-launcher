import logo from '../assets/logo.png'

export default function TitleBar(): JSX.Element {
  return (
    <div
      style={{
        height: 'var(--titlebar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 14px',
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 50
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logo} alt="" style={{ height: 16, imageRendering: 'pixelated' }} />
        <span style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text-faint)' }}>
          VICTORIA KINGDOM LAUNCHER
        </span>
      </div>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <WindowButton label="—" onClick={() => window.api.window.minimize()} />
        <WindowButton label="▢" onClick={() => window.api.window.maximize()} />
        <WindowButton label="✕" danger onClick={() => window.api.window.close()} />
      </div>
    </div>
  )
}

function WindowButton({
  label,
  onClick,
  danger
}: {
  label: string
  onClick: () => void
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="win-btn"
      data-danger={danger ? 'true' : undefined}
      style={{
        width: 44,
        height: 'var(--titlebar-h)',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        fontSize: 12,
        transition: 'background 0.18s, color 0.18s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--err)' : 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      {label}
    </button>
  )
}
