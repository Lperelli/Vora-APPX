'use client';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-20 pb-32 md:pt-32 md:pb-48">
      {/* Grid background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-sans text-5xl md:text-7xl font-bold text-balance leading-tight text-foreground mb-6">
            Tu Cuerpo,
            <br />
            <span className="text-accent">Entendido</span>
          </h1>
          
          <p className="font-sans text-lg md:text-xl text-muted-foreground text-balance max-w-2xl mx-auto mb-8">
            Análisis corporal avanzado impulsado por IA. Comprende tu composición, optimiza tu progreso y alcanza tus objetivos con precisión.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-accent text-accent-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
              Comenzar Ahora
            </button>
            <button className="px-8 py-4 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors">
              Ver Demo
            </button>
          </div>
        </div>
        
        {/* Hero image placeholder */}
        <div className="mt-16 md:mt-24 bg-muted rounded-2xl aspect-video flex items-center justify-center border border-border">
          <div className="text-muted-foreground font-sans">
            [Visualización de análisis corporal]
          </div>
        </div>
      </div>
    </section>
  );
}
