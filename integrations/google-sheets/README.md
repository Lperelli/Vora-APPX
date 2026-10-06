# VORA: guardar leads en la hoja de Grecia

Los resultados se muestran en la app. Esta integración guarda el correo y la fecha de registro; no envía emails, fotos, medidas ni resultados.

## Lo que necesitamos de Grecia

1. Crear un Google Sheet nuevo llamado **Vora Leads** en su cuenta.
2. Compartirlo con nuestro correo de Google con permiso de **Editor**, manteniendo el acceso general **Restringido**. No habilitar “cualquier persona con el enlace”.
3. Enviarnos el enlace de la hoja. Le diremos qué correo invitar si no lo tiene.

Nosotros nos encargamos de los siguientes pasos. No activar el cambio en producción hasta terminar la conexión y verificar un registro real de prueba.

## Conexión a cargo del equipo

1. En la hoja dedicada, crear o renombrar una pestaña a `Leads`. Poner estos encabezados exactos en A1:D1:
   `Email`, `Fecha de registro (UTC)`, `Origen`, `ID de solicitud`.
   Congelar la primera fila, ajustar anchos y configurar la zona horaria del documento a UTC.
2. Abrir **Extensiones → Apps Script** y pegar `Code.gs` de esta carpeta. Guardar como “Vora Leads — capture”.
3. En **Configuración del proyecto → Propiedades del script**, añadir:
   - `LEADS_SHEET_ID`: el ID entre `/d/` y `/edit` en el enlace de Grecia.
   - `LEADS_SECRET`: un secreto aleatorio generado localmente, de al menos 32 bytes. No ponerlo en Git ni compartirlo en el chat.
4. En **Implementar → Nueva implementación → Aplicación web**, ejecutar como el miembro del equipo que implementa y configurar acceso a **Cualquier persona**. El endpoint exige el secreto en cada petición y no permite leer los leads. La hoja conserva el acceso restringido. Autorizar únicamente tras revisar los permisos solicitados por Google. Una autorización nueva o advertencia de seguridad requiere la intervención/confirmación correspondiente del titular.
5. Copiar la URL de implementación que termina en `/exec`. El formato esperado es `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`.
6. En el entorno `main` de **Webflow Cloud → Vora-APPX**, configurar variables del servidor:
   - `VORA_LEADS_WEBHOOK_URL`: URL de implementación.
   - `VORA_LEADS_WEBHOOK_SECRET`: el mismo secreto, marcado como secreto.
   Estas variables no deben tener prefijo `NEXT_PUBLIC_`. Si Webflow cambia el origen interno de la petición, configurar `VORA_APP_ORIGIN=https://vora-blog.webflow.io`.
7. Integrar la PR y desplegar. Probar desde `/app` con un correo sintético: confirmar la fila en el Sheet y que los resultados se muestran únicamente después del guardado. Repetir el mismo correo y verificar que no se duplica. Verificar que un error de conexión muestra reintento y conserva el perfil.

La app devuelve un error temporal si falta configuración. Un HTTP 200 de Google por sí solo no confirma el guardado: se exige `ok: true` y el ID de solicitud correspondiente. El bloqueo en Apps Script serializa las escrituras y evita filas duplicadas en reintentos.

Google Apps Script está sujeto a las cuotas de la cuenta. No se ha contratado ningún servicio de pago. Referencias oficiales: [despliegue de aplicaciones web](https://developers.google.com/apps-script/guides/web) y [cuotas](https://developers.google.com/apps-script/guides/services/quotas).
