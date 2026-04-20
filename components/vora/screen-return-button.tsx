'use client'

import type { ReactNode } from 'react'

type Variant = 'onDark' | 'onTheme'

interface ScreenReturnButtonProps {
  onClick: () => void
  variant?: Variant
  className?: string
}

/**
 * Consistent RETURN control (user flow): top-left placement is handled by the parent layout.
 */
export function ScreenReturnButton({ onClick, variant = 'onTheme', className = '' }: ScreenReturnButtonProps) {
  const styles =
    variant === 'onDark'
      ? 'text-white/50 hover:text-white active:text-white/90'
      : 'text-muted-foreground hover:text-foreground active:text-foreground/80'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] sm:min-w-0 flex items-center justify-center sm:justify-start text-left text-[10px] tracking-[0.28em] uppercase transition-colors touch-manipulation ${styles} ${className}`.trim()}
      aria-label="Return"
    >
      RETURN
    </button>
  )
}

/** Header row: RETURN (left) · centered child (usually logo) · optional right slot */
export function VoraScreenHeader({
  onReturn,
  variant = 'onTheme',
  center,
  right,
  className = '',
}: {
  onReturn: () => void
  variant?: Variant
  center: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <header
      className={`grid w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[80rem] mx-auto grid-cols-[minmax(44px,auto)_1fr_minmax(44px,auto)] items-center gap-2 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:pb-4 ${className}`.trim()}
    >
      <div className="flex justify-start items-center">
        <ScreenReturnButton onClick={onReturn} variant={variant} />
      </div>
      <div className="flex justify-center min-w-0">{center}</div>
      <div className="flex justify-end items-center min-h-[44px]">{right ?? <span className="w-px h-px opacity-0" aria-hidden />}</div>
    </header>
  )
}
