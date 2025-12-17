/**
 * Sistema de colas para el envío asíncrono de emails
 * 
 * Este módulo utiliza BullMQ y Redis para gestionar una cola de emails que permite
 * el envío asíncrono y confiable de mensajes. Proporciona funcionalidades como:
 * - Programación de envíos diferidos
 * - Reintentos automáticos en caso de fallo
 * - Rate limiting para respetar límites de proveedores
 * - Persistencia de trabajos en Redis
 * 
 * Funciones principales:
 * - emailQueue: Instancia de la cola de emails
 * - enqueueEmail: Encola un email para envío asíncrono
 */

// mailer/queue.js
import { Queue } from 'bullmq';
import { config } from '../config.js';

// Instancia de la cola de emails conectada a Redis
export const emailQueue = new Queue('emails', {
  connection: { url: config.redisUrl },
});

// Instancia de la cola de WhatsApp conectada a Redis
export const whatsappQueue = new Queue('whatsapp', {
  connection: { url: config.redisUrl },
});

/**
 * Encola un email para envío asíncrono
 * @param {Object} data - Datos del email a enviar
 * @param {string} data.to - Dirección del destinatario
 * @param {string} data.subject - Asunto del email
 * @param {string} data.html - Contenido HTML del email
 * @param {string} data.text - Contenido en texto plano del email
 * @param {Object} [opts={}] - Opciones de BullMQ (delay, priority, attempts, etc.)
 * @returns {Promise<Object>} Job encolado con su ID
 */
export async function enqueueEmail(data, opts = {}) {
  const startTime = Date.now();
  const campaignId = data.campaignId || 'unknown';
  
  try {
    const job = await emailQueue.add('sendEmail', data, opts);
    const duration = Date.now() - startTime;
    
    console.log('[Email Queue] Job encolado', {
      jobId: job.id,
      campaignId,
      to: data.to,
      subject: data.subject,
      attempts: opts.attempts || 3,
      enqueueMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return job;
  } catch (error) {
    console.error('[Email Queue] Error al encolar job', {
      campaignId,
      to: data.to,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Encola un mensaje de WhatsApp para envío asíncrono
 * @param {Object} data - Datos del mensaje a enviar
 * @param {string} data.to - Número de teléfono del destinatario en formato E.164 (sin '+')
 * @param {string} data.templateName - Nombre de la plantilla aprobada
 * @param {string} data.languageCode - Código de idioma (ej: 'es_AR')
 * @param {Array<string>} data.bodyParams - Parámetros para las variables del cuerpo
 * @param {string} [data.headerImageUrl] - URL de imagen para el header
 * @param {string} data.campaignId - ID de la campaña (para jobId determinístico)
 * @param {Object} [opts={}] - Opciones de BullMQ (delay, priority, attempts, etc.)
 * @returns {Promise<Object>} Job encolado con su ID
 */
export async function enqueueWhatsApp(data, opts = {}) {
  const startTime = Date.now();
  const { to, templateName, campaignId } = data;

  // JobId determinístico para idempotencia
  // Evita duplicar mensajes si se reintenta el endpoint POST /send
  const jobId = `wa:${campaignId}:${to}:${templateName}`;

  try {
    const job = await whatsappQueue.add('sendWhatsApp', data, {
      jobId,
      ...opts,
    });
    
    const duration = Date.now() - startTime;
    console.log('[WhatsApp Queue] Job encolado', {
      jobId: job.id,
      deterministicJobId: jobId,
      campaignId,
      to,
      templateName,
      languageCode: data.languageCode,
      bodyParamsCount: data.bodyParams?.length || 0,
      attempts: opts.attempts || 3,
      enqueueMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return job;
  } catch (error) {
    console.error('[WhatsApp Queue] Error al encolar job', {
      campaignId,
      to,
      templateName,
      deterministicJobId: jobId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
