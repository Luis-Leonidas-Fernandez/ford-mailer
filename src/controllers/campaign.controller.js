// src/controllers/campaign.controller.js
import axios from 'axios';
import { CampaignModel } from '../models/Campaign.js';
import { TenantModel } from '../models/Tenant.js';
import { runFordCampaign } from '../../mailer/campaign/core.js';
import { runFordWhatsAppCampaign } from '../../mailer/campaign/whatsapp.js';
import { normalizePhone, normalizeWhatsAppPhone, isValidE164 } from '../../mailer/utils/phone.js';
import { transformCloudinaryUrlForEmail, validateAndNormalizeUrlForEmail } from '../../mailer/utils/cloudinary.js';

const VECTOR_RAG_BASE_URL =
  process.env.VECTOR_RAG_SERVICE_URL ||
  process.env.VECTOR_RAG_BASE_URL ||
  'http://vector-rag:3000';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getTenantAndUserFromReq(req) {
  const user = req.user || {};
  const userId = user.userId || user.id || user._id || null;

  // Mientras no haya multi-tenant real, usamos userId como fallback de tenantId
  const tenantId = user.tenantId || userId;

  return { tenantId, userId };
}

/**
 * Lógica reusable para enviar una campaña (sin tocar estado en DB).
 * Se encarga de:
 * - Obtener el segmento desde vector-rag
 * - Validar/deduplicar emails
 * - Construir promos y config de campaña
 * - Ejecutar runFordCampaign
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.campaignId
 */
export async function sendCampaignCore({ tenantId, campaignId }) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('[CampaignCore] ========================================');
  console.log('[CampaignCore] INICIANDO ENVÍO DE CAMPAÑA', {
    timestamp,
    campaignId: campaignId?.toString(),
    tenantId: tenantId?.toString(),
    nombreCampaña: '...', // Se actualizará después de cargar
  });

  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) {
    console.error('[CampaignCore] ERROR: Campaña no encontrada', {
      campaignId: campaignId?.toString(),
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Campaign ${campaignId} no encontrada`);
  }

  console.log('[CampaignCore] Campaña cargada desde DB', {
    campaignId: campaign._id?.toString(),
    nombreCampaña: campaign.nombreCampaña,
    estado: campaign.estado,
    canales: campaign.canales,
    segmentId: campaign.segmentId?.toString(),
    timestamp: new Date().toISOString(),
  });

  const { segmentId, jwtToken } = campaign;

  // 1) construir headers para llamada a vector-rag (reutiliza JWT si está disponible)
  console.log('[CampaignCore] Preparando llamada a Vector-RAG', {
    campaignId: campaign._id?.toString(),
    segmentId: segmentId?.toString(),
    vectorRagUrl: VECTOR_RAG_BASE_URL,
    timestamp: new Date().toISOString(),
  });

  const ragHeaders = {};
  if (jwtToken) {
    ragHeaders.Authorization = `Bearer ${jwtToken}`;
    console.log('[CampaignCore] JWT Token disponible para Vector-RAG', {
      campaignId: campaign._id?.toString(),
      hasJwtToken: true,
      authorizationHeaderPreview: `Bearer ${String(jwtToken).slice(0, 10)}...`,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.warn('[CampaignCore] ADVERTENCIA: Sin JWT Token', {
      campaignId: campaign._id?.toString(),
      message: 'Llamada a vector-rag irá SIN Authorization',
      timestamp: new Date().toISOString(),
    });
  }

  // 2) obtener segmento desde vector-rag
  console.log('[CampaignCore] Obteniendo segmento desde Vector-RAG...', {
    campaignId: campaign._id?.toString(),
    segmentId: segmentId?.toString(),
    timestamp: new Date().toISOString(),
  });

  const segmentResponse = await axios.get(
    `${VECTOR_RAG_BASE_URL}/api/segments/${segmentId}`,
    { headers: ragHeaders }
  );

  // La API de vector-rag envuelve el segmento en data.segment
  const apiResponse = segmentResponse.data || {};
  const segmento = apiResponse.data?.segment || {};
  const clientes = Array.isArray(segmento.clientes) ? segmento.clientes : [];

  console.log('[CampaignCore] Segmento recibido desde Vector-RAG', {
    campaignId: campaign._id?.toString(),
    segmentId: segmentId?.toString(),
    rawClientesCount: clientes.length,
    hasImageUrls: Array.isArray(segmento.imageUrlPromo) && segmento.imageUrlPromo.length > 0,
    imageUrlsCount: Array.isArray(segmento.imageUrlPromo) ? segmento.imageUrlPromo.length : 0,
    timestamp: new Date().toISOString(),
  });

  // 2) Normalizar canales a minúsculas
  const canales = (campaign.canales || []).map(c => String(c).toLowerCase().trim());
  console.log('[CampaignCore] Canales configurados', {
    campaignId: campaign._id?.toString(),
    canalesOriginales: campaign.canales,
    canalesNormalizados: canales,
    timestamp: new Date().toISOString(),
  });

  // 3) Procesar contactos: separar email y WhatsApp
  console.log('[CampaignCore] Iniciando procesamiento de contactos', {
    campaignId: campaign._id?.toString(),
    totalClientes: clientes.length,
    canales: canales,
    timestamp: new Date().toISOString(),
  });

  const seenEmails = new Set();
  const seenPhones = new Set();
  const emailContacts = [];
  const whatsappContacts = [];
  let emailInvalidos = 0;
  let whatsappInvalidos = 0;
  let emailDuplicados = 0;
  let whatsappDuplicados = 0;

  for (const c of clientes) {
    if (!c) continue;

    // Procesar email si el canal incluye 'email'
    if (canales.includes('email')) {
      const email = String(c.email || '').trim();
      if (!email) {
        emailInvalidos++;
      } else if (!EMAIL_RE.test(email)) {
        emailInvalidos++;
      } else if (seenEmails.has(email)) {
        emailDuplicados++;
      } else {
        seenEmails.add(email);
        emailContacts.push({
          email,
          nombre: c.nombre,
          vehiculo: c.vehiculo,
        });
      }
    }

    // Procesar WhatsApp si el canal incluye 'whatsapp'
    if (canales.includes('whatsapp')) {
      const defaultCountry = process.env.DEFAULT_PHONE_COUNTRY || 'AR';
      let phoneE164 = null;

      // Primero intentar telefonoE164 pero NORMALIZAR SIEMPRE
      // (puede venir con +, espacios, como número, etc.)
      if (c.telefonoE164) {
        const toRaw = c.telefonoE164;
        phoneE164 = normalizeWhatsAppPhone(toRaw, defaultCountry);
        // Log cuando se normaliza (útil para debugging)
        if (phoneE164 && toRaw !== phoneE164) {
          console.log('[WhatsApp] Número normalizado', {
            raw: toRaw,
            normalized: phoneE164,
            campaignId: campaign._id?.toString(),
          });
        }
      }

      // Si no salió, intentar telefonoRaw
      if (!phoneE164 && c.telefonoRaw) {
        const toRaw = c.telefonoRaw;
        phoneE164 = normalizeWhatsAppPhone(toRaw, defaultCountry);
        // Log cuando se normaliza (útil para debugging)
        if (phoneE164 && toRaw !== phoneE164) {
          console.log('[WhatsApp] Número normalizado desde telefonoRaw', {
            raw: toRaw,
            normalized: phoneE164,
            campaignId: campaign._id?.toString(),
          });
        }
      }

      // Validar formato E.164 sin '+'
      if (!phoneE164) {
        whatsappInvalidos++;
      } else if (!isValidE164(phoneE164)) {
        whatsappInvalidos++;
      } else if (seenPhones.has(phoneE164)) {
        whatsappDuplicados++;
      } else {
        seenPhones.add(phoneE164);
        whatsappContacts.push({
          telefonoE164: phoneE164,
          nombre: c.nombre,
          vehiculo: c.vehiculo,
        });
      }
    }
  }

  const hasEmail = canales.includes('email') && emailContacts.length > 0;
  const hasWhatsApp = canales.includes('whatsapp') && whatsappContacts.length > 0;

  console.log('[CampaignCore] Resumen de procesamiento de contactos', {
    campaignId: campaign._id?.toString(),
    totalClientes: clientes.length,
    email: {
      validos: emailContacts.length,
      invalidos: emailInvalidos,
      duplicados: emailDuplicados,
      canalActivo: canales.includes('email'),
    },
    whatsapp: {
      validos: whatsappContacts.length,
      invalidos: whatsappInvalidos,
      duplicados: whatsappDuplicados,
      canalActivo: canales.includes('whatsapp'),
    },
    timestamp: new Date().toISOString(),
  });

  if (!hasEmail && !hasWhatsApp) {
    // Nada para enviar, el caller decidirá marcar COMPLETADA
    console.warn('[CampaignCore] ADVERTENCIA: No hay contactos válidos para enviar', {
      campaignId: campaign._id?.toString(),
      rawClientesCount: clientes.length,
      emailContacts: emailContacts.length,
      whatsappContacts: whatsappContacts.length,
      canales: canales,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 4) construir promos y config de campaña para el motor Ford Mailer
  // Usar imageUrlPromo del segmento (array de URLs)
  const imageUrlsFromSegment = Array.isArray(segmento.imageUrlPromo) 
    ? segmento.imageUrlPromo 
    : [];
  
  // Construir array de promos desde el segmento con transformaciones para emails
  const promos = imageUrlsFromSegment
    .filter(url => url && typeof url === 'string')
    .map(url => {
      try {
        // Transformar URL de Cloudinary optimizándola para emails
        // - Ancho máximo 600px (estándar para emails)
        // - Formato automático (Cloudinary elige el mejor formato compatible)
        // - Calidad automática
        const transformedUrl = transformCloudinaryUrlForEmail(url, {
          width: 600,
          format: 'f_jpg',
          quality: 'q_auto',
          enforceHttps: true,
        });
        return { imageUrl: transformedUrl };
      } catch (error) {
        console.warn('[CampaignCore] Error al transformar URL de imagen:', {
          url,
          error: error.message,
          campaignId: campaign._id?.toString(),
        });
        // En caso de error, usar la URL original pero forzar HTTPS
        return { imageUrl: url.startsWith('http://') ? url.replace('http://', 'https://') : url };
      }
    });
  
  // Si no hay URLs del segmento, usar fallback de la campaña
  if (promos.length === 0 && campaign.plantillaEmail?.imagenPromoUrl) {
    try {
      const transformedUrl = transformCloudinaryUrlForEmail(
        campaign.plantillaEmail.imagenPromoUrl,
        {
          width: 600,
          format: 'f_jpg',
          quality: 'q_auto',
          enforceHttps: true,
        }
      );
      promos.push({ imageUrl: transformedUrl });
    } catch (error) {
      console.warn('[CampaignCore] Error al transformar URL de imagen fallback:', {
        url: campaign.plantillaEmail.imagenPromoUrl,
        error: error.message,
        campaignId: campaign._id?.toString(),
      });
      // En caso de error, usar la URL original pero forzar HTTPS
      const fallbackUrl = campaign.plantillaEmail.imagenPromoUrl;
      promos.push({
        imageUrl: fallbackUrl.startsWith('http://') 
          ? fallbackUrl.replace('http://', 'https://') 
          : fallbackUrl
      });
    }
  }
  
  // Log detallado de URLs procesadas (siempre mostrar resumen, detalle solo en debug)
  const debugMode = process.env.DEBUG_EMAIL_IMAGES === 'true';
  console.log('[CampaignCore] 🔍 URLs de promos procesadas', {
    campaignId: campaign._id?.toString(),
    totalUrlsOriginales: imageUrlsFromSegment.length,
    totalPromosValidas: promos.length,
    ...(debugMode && {
      promos: promos.map((promo, idx) => ({
        index: idx,
        original: imageUrlsFromSegment[idx] || campaign.plantillaEmail?.imagenPromoUrl,
        optimized: promo.imageUrl,
        isCloudinary: promo.imageUrl?.includes('res.cloudinary.com'),
        hasTransformations: promo.imageUrl?.includes('/w_600') || promo.imageUrl?.includes('f_jpg'),
        isHttps: promo.imageUrl?.startsWith('https://'),
        urlLength: promo.imageUrl?.length,
      })),
    }),
    timestamp: new Date().toISOString(),
  });

  const vendor = {
    nombre: process.env.VENDOR_NAME || 'Asesor Ford',
    phoneE164: process.env.VENDOR_PHONE_E164 || '+5490000000000',
  };

  // Obtener tenant para usar brandName
  let brandTitle = 'Ford Promos'; // fallback por defecto
  try {
    const tenant = await TenantModel.findById(tenantId)
      .select('brandName')
      .lean();
    if (tenant?.brandName) {
      brandTitle = `${tenant.brandName} Promos`;
    }
  } catch (err) {
    console.warn(
      '[CampaignCore] No se pudo obtener brandName del tenant, usando fallback',
      { tenantId, error: err.message }
    );
  }

  // Transformar brandLogoUrl para emails (logo más pequeño, formato optimizado)
  let brandLogoUrl = process.env.CAMPAIGN_BRAND_LOGO_URL ||
    'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F';
  
  try {
    brandLogoUrl = transformCloudinaryUrlForEmail(brandLogoUrl, {
      width: 128,
      height: 128,
      format: 'f_jpg',
      quality: 'q_auto',
      enforceHttps: true,
    });
  } catch (error) {
    console.warn('[CampaignCore] Error al transformar brandLogoUrl:', {
      url: brandLogoUrl,
      error: error.message,
      campaignId: campaign._id?.toString(),
    });
    // En caso de error, forzar HTTPS si es necesario
    if (brandLogoUrl.startsWith('http://')) {
      brandLogoUrl = brandLogoUrl.replace('http://', 'https://');
    }
  }

  const campaignConfig = {
    subject:
      campaign.plantillaEmail?.asunto || campaign.nombreCampaña || 'Promos Ford',
    brandTitle,
    brandSubtitle: 'Centro de Ventas',
    brandLogoUrl,
    dealershipName:
      process.env.CAMPAIGN_DEALERSHIP_NAME || 'Asesor Certificado',
    dealershipAddress:
      process.env.CAMPAIGN_DEALERSHIP_ADDRESS || '',
    contactPhone:
      process.env.CAMPAIGN_CONTACT_PHONE || '',
    ctaLabel:
      process.env.CAMPAIGN_CTA_LABEL || 'Escribime',
  };

  // 5) Ejecutar campañas según canales
  const emailStartTime = hasEmail ? Date.now() : null;
  const whatsappStartTime = hasWhatsApp ? Date.now() : null;

  // Ejecutar email si corresponde
  if (hasEmail) {
    console.log('[CampaignCore] ========================================');
    console.log('[CampaignCore] INICIANDO CAMPAÑA EMAIL', {
      campaignId: campaign._id?.toString(),
      contactsCount: emailContacts.length,
      promosCount: promos.length,
      rps: Number(process.env.MAILER_RATE_LIMIT_MAX_RPS || '5'),
      timestamp: new Date().toISOString(),
    });
    
    await runFordCampaign({
      contacts: emailContacts,
      promos,
      vendor,
      campaign: campaignConfig,
      campaignObj: campaign, // Pasar objeto completo para logs y campaignId
      options: {
        rps: Number(process.env.MAILER_RATE_LIMIT_MAX_RPS || '5'),
      },
    });
    
    const emailDuration = Date.now() - emailStartTime;
    console.log('[CampaignCore] CAMPAÑA EMAIL FINALIZADA', {
      campaignId: campaign._id?.toString(),
      contactsCount: emailContacts.length,
      duracionMs: emailDuration,
      duracionSeg: Math.round(emailDuration / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  // Ejecutar WhatsApp si corresponde
  if (hasWhatsApp) {
    console.log('[CampaignCore] ========================================');
    console.log('[CampaignCore] INICIANDO CAMPAÑA WHATSAPP', {
      campaignId: campaign._id?.toString(),
      contactsCount: whatsappContacts.length,
      promosCount: promos.length,
      templateName: campaign.plantillaWhatsApp?.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'promo_ford_mes',
      languageCode: campaign.plantillaWhatsApp?.languageCode || process.env.WHATSAPP_LANGUAGE_CODE || 'es_AR',
      rateLimitRps: Number(process.env.WHATSAPP_RATE_LIMIT_MAX_RPS || '2'),
      timestamp: new Date().toISOString(),
    });
    
    await runFordWhatsAppCampaign({
      contacts: whatsappContacts,
      promos,
      vendor,
      campaign, // Pasar el objeto campaign completo para metrics y plantillaWhatsApp
      options: {
        templateName: campaign.plantillaWhatsApp?.templateName,
        languageCode: campaign.plantillaWhatsApp?.languageCode,
      },
    });
    
    const whatsappDuration = Date.now() - whatsappStartTime;
    console.log('[CampaignCore] CAMPAÑA WHATSAPP FINALIZADA', {
      campaignId: campaign._id?.toString(),
      contactsCount: whatsappContacts.length,
      duracionMs: whatsappDuration,
      duracionSeg: Math.round(whatsappDuration / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  const totalDuration = Date.now() - startTime;
  console.log('[CampaignCore] ========================================');
  console.log('[CampaignCore] ENVÍO DE CAMPAÑA COMPLETADO', {
    campaignId: campaign._id?.toString(),
    nombreCampaña: campaign.nombreCampaña,
    email: hasEmail ? { contactos: emailContacts.length } : null,
    whatsapp: hasWhatsApp ? { contactos: whatsappContacts.length } : null,
    duracionTotalMs: totalDuration,
    duracionTotalSeg: Math.round(totalDuration / 1000),
    timestamp: new Date().toISOString(),
  });
  console.log('[CampaignCore] ========================================');
}

/**
 * POST /api/campaigns/from-rag
 * Body: { segmentId, nombreCampaña, canales?, plantillaEmail? }
 */
export const createCampaignFromRag = async (req, res) => {
  try {
    const { tenantId, userId } = getTenantAndUserFromReq(req);
    const {
      segmentId,
      jwtToken,
      nombreCampaña,
      canales,
      plantillaEmail,
      plantillaWhatsApp,
    } = req.body || {};

    console.log('[Campaign] createCampaignFromRag request recibida', {
      userId,
      tenantId,
      body: {
        segmentId,
        nombreCampaña,
        canales,
        plantillaEmail,
        hasJwtToken: Boolean(jwtToken),
        jwtTokenPreview: jwtToken ? String(jwtToken).slice(0, 10) + '...' : null,
      },
    });

    if (!tenantId || !userId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado correctamente',
      });
    }

    if (!segmentId || !nombreCampaña) {
      return res.status(400).json({
        ok: false,
        message: 'segmentId y nombreCampaña son obligatorios',
      });
    }

    // Construir headers para llamada a vector-rag (incluye JWT del payload si viene)
    const ragHeaders = {
      'Content-Type': 'application/json',
    };
    if (jwtToken) {
      ragHeaders.Authorization = `Bearer ${jwtToken}`;
      console.log('[Campaign] Incluyendo Authorization en llamada a vector-rag', {
        hasJwtToken: true,
        authorizationHeaderPreview: `Bearer ${String(jwtToken).slice(0, 10)}...`,
      });
    } else {
      console.warn(
        '[Campaign] No se recibió jwtToken en el body, la llamada a vector-rag irá SIN Authorization'
      );
    }

    // Validar que el segmento exista llamando a vector-rag
    let segmentResponse;
    try {
      segmentResponse = await axios.get(
        `${VECTOR_RAG_BASE_URL}/api/segments/${segmentId}`,
        { headers: ragHeaders }
      );
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({
          ok: false,
          message: 'Segmento no encontrado en RAG',
        });
      }
      console.error('Error llamando a vector-rag en createCampaignFromRag:', error);
      return res.status(502).json({
        ok: false,
        message: 'Error comunicándose con vector-rag',
      });
    }

    if (!segmentResponse.data) {
      return res.status(404).json({
        ok: false,
        message: 'Segmento no encontrado en RAG',
      });
    }

    // Normalizar canales a minúsculas antes de guardar
    const normalizedCanales = (canales || []).map(c => String(c).toLowerCase().trim());

    const campaign = await CampaignModel.create({
      tenantId,
      userId,
      segmentId,
      nombreCampaña,
      canales: normalizedCanales, // Siempre guardar en minúsculas
      plantillaEmail,
      plantillaWhatsApp,
      estado: 'CREADA',
      jwtToken,
    });

    console.log('[Campaign] ========================================');
    console.log('[Campaign] CAMPAÑA CREADA EN DB', {
      campaignId: campaign._id?.toString(),
      nombreCampaña: campaign.nombreCampaña,
      tenantId: tenantId?.toString(),
      userId: userId?.toString(),
      segmentId: segmentId?.toString(),
      canales: normalizedCanales,
      hasPlantillaEmail: !!plantillaEmail,
      hasPlantillaWhatsApp: !!plantillaWhatsApp,
      estado: campaign.estado,
      timestamp: new Date().toISOString(),
    });

    // Marcar ENVIANDO y disparar envío en background
    campaign.estado = 'ENVIANDO';
    campaign.lastError = null;
    await campaign.save();

    console.log('[Campaign] Estado actualizado a ENVIANDO', {
      campaignId: campaign._id?.toString(),
      timestamp: new Date().toISOString(),
    });

    const id = campaign._id;

    // Disparar envío en background (no bloquear la request)
    console.log('[Campaign] Iniciando envío en background', {
      campaignId: id.toString(),
      timestamp: new Date().toISOString(),
    });
    
    sendCampaignCore({ tenantId, campaignId: id })
      .then(async () => {
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'COMPLETADA',
          lastError: null,
        });
        console.log('[Campaign] Campaña marcada como COMPLETADA', {
          campaignId: id.toString(),
          timestamp: new Date().toISOString(),
        });
      })
      .catch(async (err) => {
        console.error('[Campaign] ERROR: Fallo en envío de campaña', {
          campaignId: id.toString(),
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        });
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'FALLIDA',
          lastError: err.message || 'Error desconocido al enviar campaña',
        });
      });

    console.log('[Campaign] Respondiendo creación de campaña (envío en progreso)', {
      campaignId: id.toString(),
      segmentId: campaign.segmentId?.toString(),
    });

    return res.status(201).json({
      ok: true,
      message: 'Campaña creada, envío en progreso',
      data: {
        campaignId: id,
        segmentId: campaign.segmentId,
        estado: 'ENVIANDO',
      },
    });
  } catch (err) {
    console.error('Error createCampaignFromRag:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear campaña',
    });
  }
};

/**
 * POST /api/campaigns/:campaignId/send
 */
export const sendCampaign = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUserFromReq(req);
    const { campaignId } = req.params;

    console.log('[Campaign] sendCampaign request recibida', {
      tenantId,
      campaignId,
    });

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado correctamente',
      });
    }

    const campaign = await CampaignModel.findOne({ _id: campaignId, tenantId });

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        message: 'Campaña no encontrada',
      });
    }

    // 1) marcar ENVIANDO y limpiar último error
    console.log('[Campaign] ========================================');
    console.log('[Campaign] INICIANDO ENVÍO MANUAL DE CAMPAÑA', {
      campaignId: campaign._id?.toString(),
      nombreCampaña: campaign.nombreCampaña,
      estadoAnterior: campaign.estado,
      canales: campaign.canales,
      timestamp: new Date().toISOString(),
    });

    campaign.estado = 'ENVIANDO';
    campaign.lastError = null;
    await campaign.save();

    console.log('[Campaign] Estado actualizado a ENVIANDO', {
      campaignId: campaign._id?.toString(),
      timestamp: new Date().toISOString(),
    });

    const id = campaign._id;

    // 2) disparar envío en background (NO await)
    console.log('[Campaign] Disparando envío en background', {
      campaignId: id.toString(),
      timestamp: new Date().toISOString(),
    });
    
    sendCampaignCore({ tenantId, campaignId: id })
      .then(async () => {
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'COMPLETADA',
          lastError: null,
        });
        console.log('[Campaign] Campaña marcada como COMPLETADA', {
          campaignId: id.toString(),
          timestamp: new Date().toISOString(),
        });
      })
      .catch(async (err) => {
        console.error('[Campaign] ERROR: Fallo en envío de campaña', {
          campaignId: id.toString(),
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        });
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'FALLIDA',
          lastError: err.message || 'Error desconocido al enviar campaña',
        });
      });

    // 3) responder rápido al usuario
    console.log('[Campaign] Respondiendo inicio de envío manual', {
      campaignId: id.toString(),
      segmentId: campaign.segmentId?.toString(),
    });
    return res.status(202).json({
      ok: true,
      message: 'Envío de campaña iniciado',
      data: {
        campaignId: id,
        segmentId: campaign.segmentId,
        estado: 'ENVIANDO',
      },
    });
  } catch (err) {
    console.error('Error sendCampaign:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al iniciar el envío de la campaña',
    });
  }
};


