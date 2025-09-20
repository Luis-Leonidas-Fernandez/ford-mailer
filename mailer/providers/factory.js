/**
 * Factory de proveedores de email
 * 
 * Este módulo actúa como un factory pattern que selecciona el proveedor de email
 * apropiado basado en la configuración. Soporta múltiples proveedores:
 * - Resend: Servicio de email transaccional
 * - Gmail: API de Gmail con OAuth2
 * 
 * La función principal delega el envío al proveedor configurado y maneja
 * la importación dinámica de los módulos específicos de cada proveedor.
 */

import { config } from '../../config.js';

/**
 * Envía un email utilizando el proveedor configurado
 * @param {Object} params - Parámetros del email
 * @param {string} params.to - Dirección del destinatario
 * @param {string} params.subject - Asunto del email
 * @param {string} params.html - Contenido HTML del email
 * @param {string} params.text - Contenido en texto plano del email
 * @param {string} [params.from] - Dirección del remitente (opcional)
 * @param {Object} [params.headers] - Headers adicionales del email
 * @returns {Promise<Object>} Resultado del envío con messageId y threadId
 * @throws {Error} Si el proveedor configurado no es soportado
 */
export async function sendEmail({ to, subject, html, text, from, headers }) {
  // Proveedor Resend - Servicio de email transaccional
  if (config.provider === 'resend') {
    const { sendWithResend } = await import('./resend.js');
    return await sendWithResend({ to, subject, html, text, from, headers });
  }

  // Proveedor Gmail - Utiliza Gmail API con OAuth2
  if (config.provider === 'gmail') {
    const { buildMultipart } = await import('../mime.js');
    const { sendRawBase64Url } = await import('../gmail.js');
    
    // Construye el mensaje MIME para Gmail API
    const raw = buildMultipart({
      from: from || config.from, to, subject, html, text, headers
    });
    
    return await sendRawBase64Url({ raw });
  }

  // Error si el proveedor no es reconocido
  throw new Error(`EMAIL_PROVIDER no soportado: ${config.provider}`);
}

