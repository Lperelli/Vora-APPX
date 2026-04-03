'use client';

export default function Stats() {
  const stats = [
    { label: 'Usuarios Activos', value: '50K+' },
    { label: 'Análisis Realizados', value: '2M+' },
    { label: 'Satisfacción', value: '98%' },
    { label: 'Países', value: '40+' }
  ];

  return (
    <section className="py-16 md:py-20 bg-background border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="font-sans text-4xl md:text-5xl font-bold text-accent mb-2">
                {stat.value}
              </p>
              <p className="text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
