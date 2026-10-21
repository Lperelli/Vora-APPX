# Vora: catálogo compartido entre el blog y la app

Grecia administra los productos en Webflow CMS. El blog y la app consultan el mismo catálogo público servido por `/app/api/catalog`. El servidor lee exclusivamente los ítems publicados de las tres colecciones mediante la API oficial de Webflow; no se envían fotos, medidas, resultados ni contactos al CMS.

## Editar productos

En **CMS → Vora Products**, cada prenda tiene nombre, marca, imagen completa, enlace de tienda, enlace de afiliado opcional, texto de precio, mercado, proporción de imagen y el interruptor **Active**.

- Pegar el enlace completo de afiliado en **Affiliate URL**, sin modificar sus parámetros de seguimiento. Si está vacío, se usa **Store URL**.
- Publicar el producto después de editarlo. Guardar un borrador no cambia las recomendaciones públicas.
- Para retirar una prenda, apagar **Active** y publicar. También se puede despublicar el producto.
- Usar **View current price** cuando no se mantenga un precio actualizado.
- Mantener el encuadre original de la prenda: `2 / 3`, `3 / 4` o `4 / 5`. No se estira la imagen.
- **Market** es una referencia editorial para organizar el catálogo. El MVP no hace geolocalización ni cambia de mercado automáticamente.

En **CMS → Vora Style Picks**, cada selección enlaza una prenda con una silueta y un artículo. Permite definir **Display order**, **Styling note** y **Active**. La app muestra las primeras cinco prendas activas y diferentes de cada silueta; el artículo muestra todas las selecciones activas que lo referencian. Una misma prenda puede tener distintos consejos para cada silueta, conservando un solo enlace de afiliado.

Las cuatro siluetas son Hourglass, Square, Triangle e Inverted Triangle. Square conserva internamente el identificador `rectangle` por continuidad de las URLs existentes.

## Artículos

Los textos siguen en **CMS → Blog Posts**. El interruptor **Use Vora catalog** activa las tarjetas compartidas en ese artículo. Los productos se administran desde las dos colecciones anteriores; no hay que copiar enlaces en el texto del artículo. El título, resumen e imagen del artículo también se usan en la recomendación de lectura dentro de la app.

El script de sincronización se aplica únicamente a la plantilla del blog. Conserva la tipografía, los botones, los colores y el encuadre de las tarjetas existentes. Los datos editoriales se insertan como texto, sin ejecutar HTML del catálogo. Cuando hay enlaces de afiliados se muestra un aviso y se usa `rel="sponsored noopener noreferrer"`.

La red o programa de afiliados de Grecia registra las compras y las comisiones. Vora no inventa códigos de afiliado, no procesa pagos ni instala herramientas de seguimiento de terceros.

## Activación técnica pendiente de credencial

El MCP permite editar las colecciones; la aplicación en ejecución necesita su propio token privado de lectura.

1. En la configuración del sitio Vora, generar un token con permiso **CMS:read**, siguiendo la [autenticación oficial](https://developers.webflow.com/data/reference/authorization).
2. En **Webflow Cloud → Vora-APPX → entorno main → variables**, agregar `WEBFLOW_CMS_API_TOKEN` marcado como **secreto**. No usar `NEXT_PUBLIC_`, no ponerlo en Git ni compartirlo en el chat.
3. Desplegar el entorno para aplicar la variable.
4. Comprobar `GET /app/api/catalog`: debe responder `source: "webflow"`, cuatro siluetas y el catálogo publicado. La respuesta nunca incluye la credencial.

Hasta configurar el token, la app conserva las selecciones anteriores (`source: "bundled"`) y el blog conserva sus tarjetas publicadas. Esta situación no confirma una sincronización activa con el CMS.

El catálogo se almacena en caché por 120 segundos y se actualiza al regresar a la pestaña o mientras permanece abierta. Los cambios publicados normalmente se reflejan en unos pocos minutos, no necesariamente en el instante de pulsar Publicar. La ruta valida URLs HTTPS y no sustituye silenciosamente un enlace de afiliado inválido por uno sin seguimiento. Si una conexión configurada falla, se ofrece reintento; el resultado del test sigue accesible.

## Verificación antes de dar la conexión por terminada

1. Confirmar siete productos, veinte selecciones y los cuatro artículos publicados.
2. Cambiar y publicar un dato inocuo en un producto; comprobar que se actualiza en el blog y en la app y revertirlo.
3. Apagar una selección, publicar y comprobar que desaparece de ambos lugares; restaurarla.
4. Con un enlace real de Grecia, verificar el destino y la atribución en su plataforma. Las pruebas con enlaces sintéticos no confirman una comisión real.
5. Comprobar móvil, prendas completas, enlaces que abren otra pestaña y regreso al perfil/repetición del test.

Los IDs de las colecciones y de las opciones de silueta están en `config.json`; son públicos. `seed.json` registra la migración inicial. La colección de productos y sus selecciones se editaron mediante el MCP de Webflow.
