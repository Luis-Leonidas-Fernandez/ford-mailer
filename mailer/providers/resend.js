/**
 * Proveedor Resend para el sistema Ford Mailer
 * 
 * Este módulo implementa la integración con el servicio Resend para el envío
 * de emails transaccionales. Resend es un servicio moderno de email que ofrece
 * una API simple y confiable para el envío de emails.
 * 
 * Funciones principales:
 * - sendWithResend: Envía emails utilizando la API de Resend
 * - Validación de API key
 * - Manejo de respuestas y errores
 */

import { Resend } from 'resend';
import { config } from '../../config.js';

// Inicializa el cliente de Resend con la API key configurada
const resend = new Resend(config.resend.apiKey);

/**
 * Envía un email utilizando el servicio Resend
 * @param {Object} params - Parámetros del email
 * @param {string} params.to - Dirección del destinatario
 * @param {string} params.subject - Asunto del email
 * @param {string} params.html - Contenido HTML del email
 * @param {string} params.text - Contenido en texto plano del email
 * @param {string} [params.from] - Dirección del remitente (opcional)
 * @param {Object} [params.headers] - Headers adicionales del email
 * @returns {Promise<Object>} Objeto con messageId y threadId del email enviado
 * @throws {Error} Si falta la API key de Resend
 */
export async function sendWithResend({ to, subject, html, text, from, headers }) {
  // Verifica que la API key de Resend esté configurada
  if (!config.resend.apiKey) {
    throw new Error('Falta RESEND_API_KEY en el entorno');
  }

  // Envía el email utilizando la API de Resend
  const res = await resend.emails.send({
    from: from || config.from,
    to,
    subject,
    html,
    text,
    headers: headers || undefined, 
  });

  // Retorna los identificadores del mensaje enviado
  // Nota: Resend usa el mismo ID para messageId y threadId
  return {
    messageId: res?.data?.id || 'unknown',
    threadId: res?.data?.id || 'unknown',
  };
}


