/**
 * Worker para el procesamiento de la cola de emails
 * 
 * Este módulo implementa un worker de BullMQ que procesa los trabajos de la cola
 * de emails de forma asíncrona. Se encarga de:
 * - Procesar trabajos de la cola 'emails'
 * - Ejecutar el envío real de emails
 * - Manejar eventos de éxito y fallo
 * - Mantener la conexión con Redis
 * 
 * El worker se ejecuta de forma continua y procesa los trabajos conforme van
 * llegando a la cola, respetando los límites de concurrencia configurados.
 */

// mailer/worker.js
import { Worker } from 'bullmq';
import { sendReminder } from './index.js';
import { config } from '../config.js';

// Crea el worker que procesará los trabajos de la cola 'emails'
const worker = new Worker('emails', async (job) => {
  console.log(`[Worker] Procesando job ${job.id}`, job.data);
  // Ejecuta el envío del email utilizando los datos del trabajo
  await sendReminder(job.data);
}, { connection: { url: config.redisUrl } });

// Evento disparado cuando un trabajo se completa exitosamente
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completado`);
});

// Evento disparado cuando un trabajo falla
worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} falló:`, err);
});
