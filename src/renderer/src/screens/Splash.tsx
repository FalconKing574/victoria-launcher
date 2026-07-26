import { motion } from 'framer-motion'
import { useEffect } from 'react'
import logo from '../assets/logo.png'

export default function Splash({ onDone }: { onDone: () => void }): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, 2200)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5 } }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        zIndex: 100
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 26 }}>
        <motion.img
          src={logo}
          alt="Victoria Kingdom"
          initial={{ opacity: 0, scale: 0.86, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 360, imageRendering: 'pixelated' }}
        />

        <div
          style={{
            width: 220,
            height: 3,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden'
          }}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            style={{
              height: '100%',
              width: '55%',
              background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
