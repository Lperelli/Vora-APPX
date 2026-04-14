// Shared VORA logo component used across all screens
export function VoraLogo({ className = '' }: { className?: string }) {
  return (
    <h1
      className={`font-serif text-5xl font-light tracking-tight text-foreground select-none ${className}`}
      style={{ fontFamily: 'var(--font-cormorant), serif' }}
    >
      vora
    </h1>
  )
}
