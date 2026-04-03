'use client';

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-sans font-bold text-foreground mb-4">Vora</h3>
            <p className="text-sm text-muted-foreground">
              Comprende tu cuerpo, optimiza tu vida.
            </p>
          </div>
          
          <div>
            <h4 className="font-sans font-semibold text-foreground mb-4">Producto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Características</a></li>
              <li><a href="#" className="hover:text-foreground transition">Precios</a></li>
              <li><a href="#" className="hover:text-foreground transition">Seguridad</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-sans font-semibold text-foreground mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Sobre Nosotros</a></li>
              <li><a href="#" className="hover:text-foreground transition">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition">Contacto</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-sans font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Privacidad</a></li>
              <li><a href="#" className="hover:text-foreground transition">Términos</a></li>
              <li><a href="#" className="hover:text-foreground transition">Cookies</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; 2026 Vora. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition">Twitter</a>
            <a href="#" className="hover:text-foreground transition">Instagram</a>
            <a href="#" className="hover:text-foreground transition">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
