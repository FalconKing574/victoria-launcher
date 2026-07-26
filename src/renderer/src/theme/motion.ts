import type { Transition, Variants } from 'framer-motion'

export const spring: Transition = { type: 'spring', stiffness: 260, damping: 26 }
export const smooth: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] }

export const screenVariants: Variants = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: smooth },
  exit: { opacity: 0, y: -12, filter: 'blur(6px)', transition: { duration: 0.28 } }
}

export const staggerChildren: Variants = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: smooth }
}
