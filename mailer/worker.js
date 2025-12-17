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

console.log('[Email Worker] ========================================');
console.log('[Email Worker] INICIANDO WORKER', {
  queueName: 'emails',
  redisUrl: config.redisUrl?.replace(/\/\/.*@/, '//***@'), // Ocultar password
  timestamp: new Date().toISOString(),
});

// Crea el worker que procesará los trabajos de la cola 'emails'
const worker = new Worker('emails', async (job) => {
  const startTime = Date.now();
  const campaignId = job.data.campaignId || 'unknown';
  
  console.log('[Email Worker] ========================================');
  console.log('[Email Worker] PROCESANDO JOB', {
    jobId: job.id,
    campaignId,
    to: job.data.to,
    subject: job.data.subject,
    timestamp: new Date().toISOString(),
  });

  try {
    // Ejecuta el envío del email utilizando los datos del trabajo
    const result = await sendReminder(job.data);
    const duration = Date.now() - startTime;
    
    console.log('[Email Worker] EMAIL ENVIADO EXITOSAMENTE', {
      jobId: job.id,
      campaignId,
      to: job.data.to,
      duracionMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Email Worker] ERROR AL ENVIAR EMAIL', {
      jobId: job.id,
      campaignId,
      to: job.data.to,
      error: error.message,
      stack: error.stack,
      duracionMs: duration,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}, { connection: { url: config.redisUrl } });

// Evento disparado cuando un trabajo se completa exitosamente
worker.on('completed', (job) => {
  const campaignId = job.data?.campaignId || 'unknown';
  console.log('[Email Worker] JOB COMPLETADO', {
    jobId: job.id,
    campaignId,
    to: job.data?.to,
    timestamp: new Date().toISOString(),
  });
});

// Evento disparado cuando un trabajo falla
worker.on('failed', (job, err) => {
  const campaignId = job?.data?.campaignId || 'unknown';
  console.error('[Email Worker] JOB FALLÓ', {
    jobId: job?.id,
    campaignId,
    to: job?.data?.to,
    error: err?.message || 'Error desconocido',
    stack: err?.stack,
    attemptsMade: job?.attemptsMade,
    timestamp: new Date().toISOString(),
  });
});
