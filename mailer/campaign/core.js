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
  options = {},           // { rps?, attempts?, backoffMs?, removeOnComplete?, removeOnFail? }
}) {
  // Configuración de rate limiting y reintentos
  const rps = options.rps ?? Math.max(config.maxRps, 1);
  const delayBetweenJobsMs = Math.floor(1000 / rps);
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 15_000;

  let i = 0;
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
      promos,
      waLink,
      ctaLabel: campaign.ctaLabel,
      unsubscribeUrl,
    };

    // Renderiza las plantillas HTML y texto con el contexto personalizado
    const { html, text } = await renderFordPromos(ctx);

    // Encola el email con configuración de reintentos y headers especializados
    await enqueueEmail(
      {
        to: cli.email,
        subject: `${campaign.subject} — ${cli.nombre || 'Cliente'}`,
        html,
        text,
        from: config.from,
        headers: {
          // Headers para cumplir con estándares de desuscripción
          'List-Unsubscribe': `<mailto:unsubscribe@inricompany.com?subject=UNSUBSCRIBE>, <${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Campaign': 'ford-promos',
        },
      },
      {
        attempts,
        backoff: { type: 'exponential', delay: backoffMs },
        removeOnComplete: true,
        removeOnFail: 1000,
      }
    );

    // Aplica rate limiting entre envíos
    if (delayBetweenJobsMs > 0) await sleep(delayBetweenJobsMs);
    
    // Muestra progreso cada 200 contactos procesados
    if (i % 200 === 0) console.log(`[Campaign] Encolados ${i} contactos...`);
  }

  console.log('[Campaign] Finalizada la encolación.');
}
