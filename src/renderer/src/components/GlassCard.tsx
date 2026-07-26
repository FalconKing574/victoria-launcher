import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { smooth } from '../theme/motion'

export default function GlassCard({
  children,
  style,
  delay = 0
}: {
  children: ReactNode
  style?: CSSProperties
  delay?: number
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...smooth, delay }}
      className="glass"
      style={{ padding: 26, ...style }}
    >
      {children}
    </motion.div>
  )
}
