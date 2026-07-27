import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { smooth } from '../theme/motion'

export default function Panel({
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...smooth, delay }}
      className="panel"
      style={{ padding: 20, ...style }}
    >
      {children}
    </motion.div>
  )
}
