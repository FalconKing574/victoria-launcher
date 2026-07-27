import { motion } from 'framer-motion'

export default function ProgressBar({
  percent,
  label
}: {
  percent: number
  label: string
}): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ color: 'var(--gold)' }}>{percent}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden'
        }}
      >
        <motion.div
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--gold-deep), var(--gold-bright))'
          }}
        />
      </div>
    </div>
  )
}
