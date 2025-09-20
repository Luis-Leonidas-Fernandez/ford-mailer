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
  const job = await emailQueue.add('sendEmail', data, opts);
  console.log(`[Queue] Job encolado con id ${job.id}`);
  return job;
}
