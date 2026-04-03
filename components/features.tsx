'use client';

export default function Features() {
  const features = [
    {
      title: 'Análisis Corporal IA',
      description: 'Tecnología de escaneo avanzada que mide tu composición corporal con precisión clínica.'
    },
    {
      title: 'Seguimiento Inteligente',
      description: 'Monitorea tu progreso en tiempo real con gráficos intuitivos y métricas detalladas.'
    },
    {
      title: 'Planes Personalizados',
      description: 'Recomendaciones adaptadas a tu cuerpo, metas y estilo de vida.'
    },
    {
      title: 'Comunidad Global',
      description: 'Conecta con otros usuarios, comparte logros y obtén motivación.'
    },
    {
      title: 'Integración Total',
      description: 'Sincroniza con tus apps de fitness y salud favoritas automáticamente.'
    },
    {
      title: 'Soporte 24/7',
      description: 'Asistencia experta siempre disponible para responder tus preguntas.'
    }
  ];

  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="font-sans text-4xl md:text-5xl font-bold text-foreground mb-4">
            Características Poderosas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Todo lo que necesitas para dominar tu composición corporal y salud.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="bg-background border border-border rounded-xl p-6 hover:border-accent transition-colors">
              <h3 className="font-sans text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
