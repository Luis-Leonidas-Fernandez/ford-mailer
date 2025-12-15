// src/controllers/campaign.controller.js
import axios from 'axios';
import { CampaignModel } from '../models/Campaign.js';
import { TenantModel } from '../models/Tenant.js';
import { runFordCampaign } from '../../mailer/campaign/core.js';

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
  console.log('[CampaignCore] Iniciando envío de campaña', {
    tenantId,
    campaignId,
  });

  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} no encontrada`);
  }

  const { segmentId, jwtToken } = campaign;

  // 1) construir headers para llamada a vector-rag (reutiliza JWT si está disponible)
  const ragHeaders = {};
  if (jwtToken) {
    ragHeaders.Authorization = `Bearer ${jwtToken}`;
    console.log('[CampaignCore] Reutilizando Authorization para llamada a vector-rag (background)', {
      hasJwtToken: true,
      authorizationHeaderPreview: `Bearer ${String(jwtToken).slice(0, 10)}...`,
    });
  } else {
    console.warn(
      '[CampaignCore] Campaign no tiene jwtToken guardado, llamada a vector-rag irá SIN Authorization'
    );
  }

// 2) obtener segmento desde vector-rag
const segmentResponse = await axios.get(
  `${VECTOR_RAG_BASE_URL}/api/segments/${segmentId}`,
  { headers: ragHeaders }
);

// La API de vector-rag envuelve el segmento en data.segment
const apiResponse = segmentResponse.data || {};
const segmento = apiResponse.data?.segment || {};
const clientes = Array.isArray(segmento.clientes) ? segmento.clientes : [];

console.log('[CampaignCore] Segmento recibido desde RAG', {
  campaignId: campaign._id?.toString(),
  rawClientesCount: clientes.length,
});

  // 2) dedupe + validación de emails
  const seen = new Set();
  const contacts = [];

  for (const c of clientes) {
    if (!c) continue;
    const email = String(c.email || '').trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    contacts.push({
      email,
      nombre: c.nombre,
    });
  }

  if (contacts.length === 0) {
    // Nada para enviar, el caller decidirá marcar COMPLETADA
    console.log('[CampaignCore] No hay contactos válidos luego de dedupe/validación', {
      campaignId: campaign._id?.toString(),
      rawClientesCount: clientes.length,
    });
    return;
  }

  // 3) construir promos y config de campaña para el motor Ford Mailer
  // Usar imageUrlPromo del segmento (array de URLs)
  const imageUrlsFromSegment = Array.isArray(segmento.imageUrlPromo) 
    ? segmento.imageUrlPromo 
    : [];
  
  // Construir array de promos desde el segmento
  const promos = imageUrlsFromSegment
    .filter(url => url && typeof url === 'string')
    .map(url => ({ imageUrl: url }));
  
  // Si no hay URLs del segmento, usar fallback de la campaña
  if (promos.length === 0 && campaign.plantillaEmail?.imagenPromoUrl) {
    promos.push({ imageUrl: campaign.plantillaEmail.imagenPromoUrl });
  }
  
  console.log('[CampaignCore] Promos construidas desde segmento', {
    campaignId: campaign._id?.toString(),
    promosCount: promos.length,
    imageUrlsFromSegment: imageUrlsFromSegment.length,
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

  const campaignConfig = {
    subject:
      campaign.plantillaEmail?.asunto || campaign.nombreCampaña || 'Promos Ford',
    brandTitle,
    brandSubtitle: 'Centro de Ventas',
    brandLogoUrl:
      process.env.CAMPAIGN_BRAND_LOGO_URL ||
      'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F',
    dealershipName:
      process.env.CAMPAIGN_DEALERSHIP_NAME || 'Asesor Certificado',
    dealershipAddress:
      process.env.CAMPAIGN_DEALERSHIP_ADDRESS || '',
    contactPhone:
      process.env.CAMPAIGN_CONTACT_PHONE || '',
    ctaLabel:
      process.env.CAMPAIGN_CTA_LABEL || 'Escribime',
  };

  // 4) Ejecutar campaña usando el motor existente (cola BullMQ + Resend/Gmail)
  console.log('[CampaignCore] Ejecutando runFordCampaign', {
    campaignId: campaign._id?.toString(),
    contactsCount: contacts.length,
    promosCount: promos.length,
  });
  await runFordCampaign({
    contacts,
    promos,
    vendor,
    campaign: campaignConfig,
    options: {
      rps: Number(process.env.MAILER_RATE_LIMIT_MAX_RPS || '5'),
    },
  });
  console.log('[CampaignCore] runFordCampaign finalizado', {
    campaignId: campaign._id?.toString(),
    contactsCount: contacts.length,
  });
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

    const campaign = await CampaignModel.create({
      tenantId,
      userId,
      segmentId,
      nombreCampaña,
      canales,
      plantillaEmail,
      estado: 'CREADA',
      jwtToken,
    });

    console.log('[Campaign] Campaña creada en DB', {
      campaignId: campaign._id?.toString(),
      tenantId,
      userId,
    });

    // Marcar ENVIANDO y disparar envío en background
    campaign.estado = 'ENVIANDO';
    campaign.lastError = null;
    await campaign.save();

    const id = campaign._id;

    // Disparar envío en background (no bloquear la request)
    sendCampaignCore({ tenantId, campaignId: id })
      .then(async () => {
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'COMPLETADA',
          lastError: null,
        });
      })
      .catch(async (err) => {
        console.error('[createCampaignFromRag] Error en background:', err);
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
    campaign.estado = 'ENVIANDO';
    campaign.lastError = null;
    await campaign.save();

    const id = campaign._id;

    // 2) disparar envío en background (NO await)
    sendCampaignCore({ tenantId, campaignId: id })
      .then(async () => {
        await CampaignModel.findByIdAndUpdate(id, {
          estado: 'COMPLETADA',
          lastError: null,
        });
      })
      .catch(async (err) => {
        console.error('[sendCampaign] Error en background:', err);
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


