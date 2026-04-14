'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type MotionButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  whileHoverScale?: number
  whileTapScale?: number
}

export function MotionButton({
  whileHoverScale = 1.015,
  whileTapScale = 0.985,
  style,
  disabled,
  ...props
}: MotionButtonProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileHover={
        shouldReduceMotion || disabled
          ? undefined
          : {
              scale: whileHoverScale,
              y: -1,
            }
      }
      whileTap={
        shouldReduceMotion || disabled
          ? undefined
          : {
              scale: whileTapScale,
              y: 0,
            }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0.12 }
          : {
              type: 'spring',
              stiffness: 520,
              damping: 38,
              mass: 0.55,
            }
      }
      style={{
        ...style,
        transformOrigin: 'center',
        willChange: shouldReduceMotion ? undefined : 'transform',
      }}
    />
  )
}

