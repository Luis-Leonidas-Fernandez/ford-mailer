// mailer/whatsapp-worker.js
import { Worker } from 'bullmq';
import { waSendTemplate } from '../whatsapp/src/providers/whatsapp.js';
import { config } from '../config.js';

// Rate limit configurable desde env
// ⚠️ IMPORTANTE: El limiter de BullMQ es POR WORKER (no global compartido)
// - Si levantas 2 workers, duplicás el rate real (ej: 2 workers con max: 2 = 4 msg/seg)
// - Para aumentar throughput: subir WHATSAPP_RATE_LIMIT_MAX_RPS, NO multiplicar workers
// - Recomendación: correr UN SOLO whatsapp-worker en producción
const maxPerSecond = Number(process.env.WHATSAPP_RATE_LIMIT_MAX_RPS || '2');

const worker = new Worker(
  'whatsapp',
  async (job) => {
    const startTime = Date.now();
    const campaignId = job.data.campaignId || 'unknown';
    
    console.log('[WhatsApp Worker] ========================================');
    console.log('[WhatsApp Worker] PROCESANDO JOB', {
      jobId: job.id,
      campaignId,
      to: job.data.to,
      templateName: job.data.templateName,
      languageCode: job.data.languageCode,
      bodyParamsCount: job.data.bodyParams?.length || 0,
      hasHeaderImage: !!job.data.headerImageUrl,
      timestamp: new Date().toISOString(),
    });

    const { to, templateName, languageCode, bodyParams, headerImageUrl } = job.data;

    try {
      const result = await waSendTemplate({
        to,
        templateName,
        languageCode,
        bodyParams,
        headerImageUrl,
      });
      
      const duration = Date.now() - startTime;
      console.log('[WhatsApp Worker] MENSAJE ENVIADO EXITOSAMENTE', {
        jobId: job.id,
        campaignId,
        to,
        templateName,
        messageId: result?.messages?.[0]?.id,
        duracionMs: duration,
        timestamp: new Date().toISOString(),
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[WhatsApp Worker] ERROR AL ENVIAR MENSAJE', {
        jobId: job.id,
        campaignId,
        to,
        templateName,
        error: error.message,
        stack: error.stack,
        duracionMs: duration,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },
  {
    connection: { url: config.redisUrl },
    concurrency: 1, // 1 job a la vez (procesamiento secuencial)
    limiter: {
      max: maxPerSecond, // Mensajes por segundo POR WORKER (rate por worker, no global)
      duration: 1000, // 1000ms = 1 segundo
    },
  }
);

worker.on('completed', (job) => {
  const campaignId = job.data?.campaignId || 'unknown';
  console.log('[WhatsApp Worker] JOB COMPLETADO', {
    jobId: job.id,
    campaignId,
    to: job.data?.to,
    templateName: job.data?.templateName,
    timestamp: new Date().toISOString(),
  });
});

worker.on('failed', (job, err) => {
  const campaignId = job?.data?.campaignId || 'unknown';
  console.error('[WhatsApp Worker] JOB FALLÓ', {
    jobId: job?.id,
    campaignId,
    to: job?.data?.to,
    templateName: job?.data?.templateName,
    error: err?.message || 'Error desconocido',
    stack: err?.stack,
    attemptsMade: job?.attemptsMade,
    timestamp: new Date().toISOString(),
  });
});

console.log('[WhatsApp Worker] ========================================');
console.log('[WhatsApp Worker] INICIANDO WORKER', {
  queueName: 'whatsapp',
  maxPerSecond,
  concurrency: 1,
  redisUrl: config.redisUrl?.replace(/\/\/.*@/, '//***@'), // Ocultar password en logs
  timestamp: new Date().toISOString(),
});
console.log('[WhatsApp Worker] ========================================');

