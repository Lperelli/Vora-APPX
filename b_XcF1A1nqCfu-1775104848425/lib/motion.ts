import type { Transition, Variants } from 'framer-motion'

export const defaultTransition: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 34,
  mass: 0.7,
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: defaultTransition },
  exit: { opacity: 0, y: -8, filter: 'blur(6px)', transition: { duration: 0.18, ease: 'easeOut' } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

export const premiumPageTransition: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: defaultTransition },
  exit: { opacity: 0, y: -10, scale: 0.995, filter: 'blur(10px)', transition: { duration: 0.18, ease: 'easeOut' } },
}

