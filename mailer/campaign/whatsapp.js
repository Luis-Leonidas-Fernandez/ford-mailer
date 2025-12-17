// mailer/campaign/whatsapp.js
import { enqueueWhatsApp } from '../queue.js';

/**
 * Ejecuta una campaña masiva de mensajes WhatsApp usando plantillas aprobadas
 * @param {Object} params - Parámetros de la campaña
 * @param {Iterable} params.contacts - Lista iterable de contactos { telefonoE164, nombre?, vehiculo? }
 * @param {Array} params.promos - Array de promociones a incluir (para headerImageUrl)
 * @param {Object} params.vendor - Información del vendedor { nombre, phoneE164 }
 * @param {Object} params.campaign - Objeto Campaign de MongoDB (para metrics y plantillaWhatsApp)
 * @param {Object} [params.options={}] - Opciones de configuración { attempts?, backoffMs?, templateName?, languageCode? }
 * @returns {Promise<void>} Se resuelve cuando la encolación se completa
 */
export async function runFordWhatsAppCampaign({
  contacts,
  promos,
  vendor,
  campaign,
  options = {},
}) {
  const startTime = Date.now();
  const campaignId = campaign?._id?.toString() || 'unknown';
  
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 30_000;

  const templateName =
    options.templateName ||
    campaign?.plantillaWhatsApp?.templateName ||
    process.env.WHATSAPP_TEMPLATE_NAME ||
    'promo_ford_mes';
  const languageCode =
    options.languageCode ||
    campaign?.plantillaWhatsApp?.languageCode ||
    process.env.WHATSAPP_LANGUAGE_CODE ||
    'es_AR';
  const expectedBodyParams =
    Number(process.env.WHATSAPP_TEMPLATE_BODY_PARAMS_COUNT) || 2;

  const headerImageUrl =
    promos && promos.length > 0 && promos[0].imageUrl
      ? promos[0].imageUrl
      : null;

  console.log('[WhatsApp Campaign] Configuración de campaña', {
    campaignId,
    templateName,
    languageCode,
    expectedBodyParams,
    hasHeaderImage: !!headerImageUrl,
    attempts,
    backoffMs,
    contactsCount: Array.isArray(contacts) ? contacts.length : 'iterable',
    promosCount: promos?.length || 0,
    timestamp: new Date().toISOString(),
  });

  let i = 0;
  let skipped = 0;
  let encolados = 0;
  let erroresEncolado = 0;

  // Encolar todos los contactos rápidamente (sin sleep)
  // El rate limiting se maneja en el worker con limiter
  for await (const cli of contacts) {
    i++;

    // Validar telefonoE164 (skip si falta)
    if (!cli.telefonoE164) {
      console.warn('[WhatsApp Campaign] Skip: telefonoE164 faltante', {
        campaignId,
        contacto: i,
        nombre: cli.nombre || 'sin nombre',
        timestamp: new Date().toISOString(),
      });
      skipped++;
      continue;
    }

    // Construir bodyParams según plantilla (alinear con variables aprobadas)
    const bodyParams = [
      cli.nombre || 'Cliente', // {{1}}
      cli.vehiculo || 'modelos seleccionados', // {{2}}
      // Ajustar según cantidad de variables en la plantilla aprobada
    ];

    // Validar cantidad de parámetros antes de encolar (skip si no coincide)
    if (bodyParams.length !== expectedBodyParams) {
      console.warn('[WhatsApp Campaign] Skip: bodyParams inválido', {
        campaignId,
        contacto: i,
        to: cli.telefonoE164,
        esperados: expectedBodyParams,
        recibidos: bodyParams.length,
        bodyParams,
        timestamp: new Date().toISOString(),
      });
      skipped++;
      continue;
    }

    try {
      // Encolar sin delay (el worker maneja el rate limit)
      // jobId determinístico se construye en enqueueWhatsApp: wa:${campaignId}:${to}:${templateName}
      const enqueueStart = Date.now();
      await enqueueWhatsApp(
        {
          to: cli.telefonoE164,
          templateName,
          languageCode,
          bodyParams,
          headerImageUrl,
          campaignId: campaign._id.toString(), // Necesario para jobId determinístico
        },
        {
          attempts,
          backoff: { type: 'exponential', delay: backoffMs },
          removeOnComplete: true,
          removeOnFail: 1000,
        }
      );
      encolados++;
      const enqueueDuration = Date.now() - enqueueStart;

      // Log detallado cada 50 contactos o en el primero
      if (i === 1 || i % 50 === 0) {
        console.log('[WhatsApp Campaign] Progreso de encolado', {
          campaignId,
          procesados: i,
          encolados,
          skipped,
          errores: erroresEncolado,
          telefono: cli.telefonoE164,
          enqueueMs: enqueueDuration,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      erroresEncolado++;
      console.error('[WhatsApp Campaign] Error al encolar mensaje', {
        campaignId,
        contacto: i,
        telefono: cli.telefonoE164,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  // Actualizar métricas en la campaña (opcional pero recomendado)
  if (campaign) {
    if (!campaign.metrics) {
      campaign.metrics = {
        whatsapp: { encolados: 0, omitidos: 0, enviados: 0, fallidos: 0 },
        email: { encolados: 0, enviados: 0, fallidos: 0 },
      };
    }
    campaign.metrics.whatsapp.encolados =
      (campaign.metrics.whatsapp.encolados || 0) + encolados;
    campaign.metrics.whatsapp.omitidos =
      (campaign.metrics.whatsapp.omitidos || 0) + skipped;
    await campaign.save();
    
    console.log('[WhatsApp Campaign] Métricas actualizadas en DB', {
      campaignId,
      encolados,
      skipped,
      timestamp: new Date().toISOString(),
    });
  }

  console.log('[WhatsApp Campaign] ========================================');
  console.log('[WhatsApp Campaign] ENCOLACIÓN FINALIZADA', {
    campaignId,
    totalProcesados: i,
    encolados,
    omitidos: skipped,
    errores: erroresEncolado,
    duracionMs: totalDuration,
    duracionSeg: Math.round(totalDuration / 1000),
    promedioMsPorContacto: i > 0 ? Math.round(totalDuration / i) : 0,
    timestamp: new Date().toISOString(),
  });
  console.log('[WhatsApp Campaign] ========================================');
}

