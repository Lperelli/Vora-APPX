'use client';

export default function CTA() {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-sans text-4xl md:text-5xl font-bold text-foreground mb-6">
          Comienza Tu Transformación Hoy
        </h2>
        
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Únete a miles de usuarios que ya dominan su composición corporal. Tu primer análisis es completamente gratis.
        </p>
        
        <button className="px-10 py-4 bg-accent text-accent-foreground rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity">
          Acceso Gratuito Ahora
        </button>
        
        <p className="text-sm text-muted-foreground mt-6">
          No se requiere tarjeta de crédito. Cancela en cualquier momento.
        </p>
      </div>
    </section>
  );
}
