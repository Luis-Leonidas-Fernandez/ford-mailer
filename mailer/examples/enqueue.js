/**
 * Ejemplo avanzado de campaña con encolado manual
 * 
 * Este script demuestra un enfoque más granular para ejecutar campañas,
 * donde cada email se encola manualmente con control detallado sobre
 * el proceso. Incluye rate limiting, batching y manejo de progreso.
 * 
 * Características del ejemplo:
 * - Encolado manual email por email
 * - Rate limiting configurable
 * - Procesamiento por lotes (batches)
 * - Generación de links de WhatsApp
 * - Headers de desuscripción
 * - Control granular del proceso
 */

// mailer/examples/enqueue-campaign.js
import { enqueueEmail } from '../queue.js';
import { config } from '../../config.js';
import { renderFordPromos } from '../templates.js';
import { buildWhatsAppLink } from '../utils/whatsapp.js';

// Información del vendedor para contacto por WhatsApp
const VENDEDOR = {
  nombre: 'Cristian',
  phoneE164: '+5493624169463',
};

// Base de contactos (en producción cargar desde CSV/DB)
const BASE = [
  { email: 'ana@example.com', nombre: 'Ana' },
  { email: 'carlos@example.com', nombre: 'Carlos' },
  // ... expandir con más contactos según necesidad
];

// Promociones de vehículos Ford para incluir en los emails
const PROMOS = [
  { 
    titulo: 'Ford Ranger XLT', 
    descripcion: 'Financiación especial', 
    precio: 'USD 32.500', 
    url: 'https://inri.com/ranger?utm_source=email&utm_medium=promo&utm_campaign=ford' 
  },
  { 
    titulo: 'Ford Ka Usado Certificado', 
    descripcion: 'Entrega inmediata', 
    precio: 'ARS 10.500.000', 
    url: 'https://inri.com/ka?utm_source=email&utm_medium=promo&utm_campaign=ford' 
  },
];

// Configuración de la campaña promocional
const CAMPAIGN = {
  subject: 'Promos Ford de la semana',
  brandTitle: 'Ford Service',
  brandSubtitle: 'Centro Oficial',
  brandLogoUrl: 'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F',
  dealershipName: 'INRI Company Motors',
  dealershipAddress: 'Av. Siempreviva 742, Córdoba',
  contactPhone: '+54 351 555-1234',
  ctaLabel: 'Escribir por WhatsApp',
};

// Configuración de procesamiento por lotes y rate limiting
const BATCH_SIZE = 200; // Pausa cada 200 emails procesados
const DELAY_BETWEEN_JOBS_MS = Math.floor(1000 / Math.max(config.maxRps, 1)); // Respeta MAILER_RATE_LIMIT_MAX_RPS

/**
 * Función utilitaria para pausas asíncronas
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>} Promesa que se resuelve después del tiempo especificado
 */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// Procesa cada contacto de la base de datos
for (let i = 0; i < BASE.length; i++) {
  const cli = BASE[i];

  // Genera link personalizado de WhatsApp para cada cliente
  const waLink = buildWhatsAppLink({
    phoneE164: VENDEDOR.phoneE164,
    clienteNombre: cli.nombre || 'Cliente',
    vendedorNombre: VENDEDOR.nombre,
  });

  // Genera URL de desuscripción con el email del cliente
  const unsubscribeUrl = `${process.env.UNSUB_HTTP_URL || 'https://inricompany.com/unsubscribe'}?e=${encodeURIComponent(cli.email)}&src=ford-promos`;

  // Construye el contexto personalizado para cada cliente
  const ctx = {
    subject: CAMPAIGN.subject,
    brandTitle: CAMPAIGN.brandTitle,
    brandSubtitle: CAMPAIGN.brandSubtitle,
    brandLogoUrl: CAMPAIGN.brandLogoUrl,
    recipientName: cli.nombre || 'Cliente',
    dealershipName: CAMPAIGN.dealershipName,
    dealershipAddress: CAMPAIGN.dealershipAddress,
    contactPhone: CAMPAIGN.contactPhone,
    promos: PROMOS,
    waLink,
    ctaLabel: CAMPAIGN.ctaLabel,
    unsubscribeUrl,
  };

  // Renderiza las plantillas HTML y texto con el contexto personalizado
  const { html, text } = await renderFordPromos(ctx);

  // Encola cada email con configuración completa de reintentos y headers
  await enqueueEmail(
    {
      to: cli.email,
      subject: CAMPAIGN.subject + ` — ${cli.nombre || 'Cliente'}`,
      html,
      text,
      from: config.from,
      // Headers útiles para cumplir con estándares de desuscripción
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@inricompany.com?subject=UNSUBSCRIBE>, <${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Campaign': 'ford-promos',
      }
    },
    {
      // Configuración de BullMQ para reintentos y limpieza
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );

  // Aplica rate limiting entre envíos
  await sleep(DELAY_BETWEEN_JOBS_MS);

  // Pausa cada BATCH_SIZE para evitar sobrecarga
  if ((i+1) % BATCH_SIZE === 0) {
    console.log(`[Campaign] Encolados ${i+1}. Pausa corta...`);
    await sleep(3000); // Pausa de 3 segundos cada lote
  }
}

console.log('[Campaign] Todos los jobs encolados.');
process.exit(0);
