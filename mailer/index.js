/**
 * Módulo principal del sistema de envío de emails Ford Mailer
 * 
 * Este archivo actúa como punto de entrada principal para el envío de recordatorios
 * y emails. Maneja la lógica de modo dry-run y delega el envío real a los proveedores
 * configurados (Resend o Gmail).
 * 
 * Funciones principales:
 * - sendReminder: Función principal para envío de emails con soporte para modo de prueba
 */

import { config } from '../config.js';
import { sendEmail } from './providers/factory.js';

/**
 * Envía un recordatorio por email utilizando el proveedor configurado
 * @param {Object} params - Parámetros del email
 * @param {string} params.to - Email del destinatario
 * @param {string} params.subject - Asunto del email
 * @param {string} params.html - Contenido HTML del email
 * @param {string} params.text - Contenido en texto plano del email
 * @param {string} [params.from] - Email del remitente (opcional, usa config.from por defecto)
 * @param {Object} [params.headers] - Headers adicionales para el email
 * @returns {Promise<Object>} Resultado del envío con messageId y threadId
 */
export async function sendReminder({ to, subject, html, text, from, headers }) {
  // Si está en modo dry-run, solo simula el envío sin enviar realmente
  if (config.dryRun) {
    console.log('[DRY_RUN] Would send:', {
      provider: config.provider, to, subject, from: from || config.from, headers
    });
    return { messageId: 'dry_run', threadId: 'dry_run' };
  }

  // Envío real utilizando el proveedor configurado
  return await sendEmail({ to, subject, html, text, from, headers });
}



