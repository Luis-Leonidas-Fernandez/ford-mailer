/**
 * Motor principal de campañas de email Ford
 * 
 * Este módulo implementa la lógica central para ejecutar campañas masivas de email
 * promocionales de Ford. Maneja:
 * - Procesamiento de listas de contactos
 * - Generación de contenido personalizado
 * - Rate limiting para respetar límites de envío
 * - Encolado de emails con reintentos
 * - Generación de links de WhatsApp y desuscripción
 * 
 * Funciones principales:
 * - runFordCampaign: Ejecuta una campaña completa de emails promocionales
 * - sleep: Utilidad para pausas entre envíos
 */

// mailer/campaign/core.js
import { enqueueEmail } from '../queue.js';
import { config } from '../../config.js';
import { renderFordPromos } from '../templates.js';
import { buildWhatsAppLink } from '../utils/whatsapp.js';
import { transformCloudinaryUrlForEmail } from '../utils/cloudinary.js';

/**
 * Función utilitaria para pausas asíncronas
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>} Promesa que se resuelve después del tiempo especificado
 */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/**
 * Ejecuta una campaña masiva de emails promocionales de Ford
 * @param {Object} params - Parámetros de la campaña
 * @param {Iterable} params.contacts - Lista iterable de contactos { email, nombre? }
 * @param {Array} params.promos - Array de promociones a incluir
 * @param {Object} params.vendor - Información del vendedor { nombre, phoneE164 }
 * @param {Object} params.campaign - Datos de la campaña { subject, brandTitle, etc. }
 * @param {Object} [params.options={}] - Opciones de configuración { rps?, attempts?, etc. }
 * @returns {Promise<void>} Se resuelve cuando la campaña se completa
 */
export async function runFordCampaign({
  contacts,               // iterable/array de { email, nombre? }
  promos,                 // array de promos
  vendor,                 // { nombre, phoneE164 }
  campaign,               // { subject, brandTitle, brandSubtitle, brandLogoUrl, dealershipName, dealershipAddress, contactPhone, ctaLabel }
  campaignObj,            // Objeto Campaign completo de MongoDB (opcional, para logs)
  options = {},           // { rps?, attempts?, backoffMs?, removeOnComplete?, removeOnFail? }
}) {
  const startTime = Date.now();
  const campaignId = campaignObj?._id?.toString() || 'unknown';
  
  // Configuración de rate limiting y reintentos
  const rps = options.rps ?? Math.max(config.maxRps, 1);
  const delayBetweenJobsMs = Math.floor(1000 / rps);
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 15_000;

  // Validar y sanitizar el array de promos antes de usarlo
  // Esto asegura que todas las URLs estén correctamente formateadas y sean HTTPS
  const sanitizedPromos = Array.isArray(promos)
    ? promos
        .filter(promo => promo && typeof promo === 'object')
        .map(promo => {
          // Asegurar que tenga imageUrl válido
          if (!promo.imageUrl || typeof promo.imageUrl !== 'string') {
            return null;
          }
          
          // Re-validar y transformar URL si es necesario (doble verificación)
          try {
            const validatedUrl = transformCloudinaryUrlForEmail(promo.imageUrl, {
              width: 600,
              format: 'f_jpg',
              quality: 'q_auto',
              enforceHttps: true,
            });
            return { imageUrl: validatedUrl };
          } catch (error) {
            console.warn('[Email Campaign] Error al validar URL de promo:', {
              campaignId,
              url: promo.imageUrl,
              error: error.message,
            });
            // Si falla, intentar al menos forzar HTTPS
            const httpsUrl = promo.imageUrl.startsWith('http://')
              ? promo.imageUrl.replace('http://', 'https://')
              : promo.imageUrl;
            return { imageUrl: httpsUrl };
          }
        })
        .filter(promo => promo !== null) // Eliminar nulls
    : [];

  // Log detallado solo si hay diferencias o en modo debug
  const debugMode = process.env.DEBUG_EMAIL_IMAGES === 'true';
  const hasFilteredPromos = sanitizedPromos.length !== (promos?.length || 0);
  
  if (debugMode || hasFilteredPromos) {
    console.log('[Email Campaign] 🔍 Promos sanitizadas', {
      campaignId,
      originalCount: promos?.length || 0,
      sanitizedCount: sanitizedPromos.length,
      filtered: (promos?.length || 0) - sanitizedPromos.length,
      ...(debugMode && {
        promos: sanitizedPromos.map((promo, idx) => ({
          index: idx,
          imageUrl: promo.imageUrl,
          isCloudinary: promo.imageUrl?.includes('res.cloudinary.com'),
          hasTransformations: promo.imageUrl?.includes('/w_600') || promo.imageUrl?.includes('f_jpg'),
          isHttps: promo.imageUrl?.startsWith('https://'),
          urlLength: promo.imageUrl?.length,
        })),
      }),
      timestamp: new Date().toISOString(),
    });
  }

  console.log('[Email Campaign] Configuración de campaña', {
    campaignId,
    rps,
    delayBetweenJobsMs,
    attempts,
    backoffMs,
    contactsCount: Array.isArray(contacts) ? contacts.length : 'iterable',
    promosCount: sanitizedPromos.length,
    promosOriginalCount: promos?.length || 0,
    promosFiltered: (promos?.length || 0) - sanitizedPromos.length,
    timestamp: new Date().toISOString(),
  });

  let i = 0;
  let encolados = 0;
  let erroresEncolado = 0;
  
  // Procesa cada contacto de forma secuencial respetando el rate limit
  for await (const cli of contacts) {
    i++;

    // Genera link de WhatsApp personalizado para el cliente
    const waLink = buildWhatsAppLink({
      phoneE164: vendor.phoneE164,
      clienteNombre: cli.nombre || 'Cliente',
      vendedorNombre: vendor.nombre,
    });

    // Genera URL de desuscripción con el email del cliente
    const unsubscribeUrl = `${process.env.UNSUB_HTTP_URL || 'https://inricompany.com/unsubscribe'}?e=${encodeURIComponent(cli.email)}&src=ford-promos`;

    // Construye el contexto personalizado para cada cliente
    const ctx = {
      subject: campaign.subject,
      brandTitle: campaign.brandTitle,
      brandSubtitle: campaign.brandSubtitle,
      brandLogoUrl: campaign.brandLogoUrl,
      recipientName: cli.nombre || 'Cliente',
      dealershipName: campaign.dealershipName,
      dealershipAddress: campaign.dealershipAddress,
      contactPhone: campaign.contactPhone,
      promos: sanitizedPromos, // Usar promos sanitizadas y validadas
      waLink,
      ctaLabel: campaign.ctaLabel,
      unsubscribeUrl,
    };

    try {
      // Renderiza las plantillas HTML y texto con el contexto personalizado
      const renderStart = Date.now();
      const { html, text } = await renderFordPromos(ctx);
      const renderDuration = Date.now() - renderStart;

      // Encola el email con configuración de reintentos y headers especializados
      const enqueueStart = Date.now();
      await enqueueEmail(
        {
          to: cli.email,
          subject: `${campaign.subject} — ${cli.nombre || 'Cliente'}`,
          html,
          text,
          from: config.from,
          campaignId, // Agregar campaignId para métricas
          headers: {
            // Headers para cumplir con estándares de desuscripción
            'List-Unsubscribe': `<mailto:unsubscribe@inricompany.com?subject=UNSUBSCRIBE>, <${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Campaign': 'ford-promos',
            'X-Campaign-Id': campaignId,
          },
        },
        {
          attempts,
          backoff: { type: 'exponential', delay: backoffMs },
          removeOnComplete: 200,
          removeOnFail: 1000,
        }
      );
      encolados++;
      const enqueueDuration = Date.now() - enqueueStart;

      // Log detallado cada 50 contactos o en el primero
      if (i === 1 || i % 50 === 0) {
        console.log('[Email Campaign] Progreso de encolado', {
          campaignId,
          procesados: i,
          encolados,
          errores: erroresEncolado,
          email: cli.email,
          renderMs: renderDuration,
          enqueueMs: enqueueDuration,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      erroresEncolado++;
      console.error('[Email Campaign] Error al encolar email', {
        campaignId,
        contacto: i,
        email: cli.email,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }

    // Aplica rate limiting entre envíos
    if (delayBetweenJobsMs > 0) await sleep(delayBetweenJobsMs);
  }

  const totalDuration = Date.now() - startTime;
  console.log('[Email Campaign] ========================================');
  console.log('[Email Campaign] ENCOLACIÓN FINALIZADA', {
    campaignId,
    totalProcesados: i,
    encolados,
    errores: erroresEncolado,
    duracionMs: totalDuration,
    duracionSeg: Math.round(totalDuration / 1000),
    promedioMsPorContacto: i > 0 ? Math.round(totalDuration / i) : 0,
    timestamp: new Date().toISOString(),
  });
  console.log('[Email Campaign] ========================================');
}
