'use client'

export function RetakeTestButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex min-h-[44px] items-center justify-center px-4 text-center text-[10px] uppercase tracking-[0.22em] text-foreground/60 transition-colors hover:text-foreground focus-visible:rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      Retake test
    </button>
  )
}
