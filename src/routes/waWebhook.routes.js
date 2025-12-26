/**
 * Rutas de Webhook de WhatsApp Business API
 * 
 * Maneja:
 * - Verificación de webhook (GET /wa/webhook)
 * - Recepción de eventos (POST /wa/webhook):
 *   - Statuses de mensajes (sent, delivered, read, failed)
 *   - Mensajes entrantes de usuarios
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { handleUserQuestion } from '../../whatsapp/src/orchestrator.js';
import { ensureUnique } from '../../whatsapp/src/utils/idempotency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const waWebhookRouter = express.Router();

/**
 * GET /wa/webhook
 * Verificación de webhook por Meta/Facebook
 * Meta envía un challenge que debemos devolver si el token coincide
 * Si no es una verificación, muestra la página HTML del webhook
 */
waWebhookRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Si es una verificación de Meta, manejar la verificación
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('[WA Webhook] Verificación OK', {
      mode,
      timestamp: new Date().toISOString(),
    });
    return res.status(200).send(challenge);
  }

  // Si hay parámetros de Meta pero no coinciden, rechazar
  if (mode) {
    console.warn('[WA Webhook] Verificación FALLIDA', {
      mode,
      tokenProvided: !!token,
      expectedToken: !!process.env.WA_VERIFY_TOKEN,
      timestamp: new Date().toISOString(),
    });
    return res.sendStatus(403);
  }

  // Si no hay parámetros de Meta, servir la página HTML del webhook
  // Usar resolve para obtener ruta absoluta
  const webhookPath = resolve(__dirname, '../../public/webhook.html');
  return res.sendFile(webhookPath);
});

/**
 * POST /wa/webhook
 * Recibe eventos de WhatsApp Business API:
 * - Statuses de mensajes enviados (sent, delivered, read, failed)
 * - Mensajes entrantes de usuarios
 */
waWebhookRouter.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const body = req.body;
    console.log('[WA Webhook] RAW', JSON.stringify(body, null, 2));

    // Extraer todos los statuses del payload (puede haber múltiples en un solo webhook)
    const statuses =
      body?.entry?.flatMap((e) =>
        e.changes?.flatMap((c) => c.value?.statuses || []) || []
      ) || [];

    // Procesar cada status
    for (const st of statuses) {
      console.log('[WA Webhook] STATUS', {
        id: st.id, // wamid del mensaje
        status: st.status, // sent | delivered | read | failed
        timestamp: st.timestamp,
        recipient_id: st.recipient_id,
        errors: st.errors,
      });

      // TODO: Aquí puedes actualizar métricas en Campaign cuando llegue el status
      // Ejemplo:
      // - Buscar la campaña que tiene este wamid
      // - Actualizar campaign.metrics.whatsapp.enviados si status === 'sent'
      // - Actualizar campaign.metrics.whatsapp.fallidos si status === 'failed'
      // - etc.
    }

    // Extraer mensajes entrantes (si los hay)
    const messages =
      body?.entry?.flatMap((e) =>
        e.changes?.flatMap((c) => c.value?.messages || []) || []
      ) || [];

    // Procesar mensajes entrantes de texto
    for (const msg of messages) {
      if (msg.type === 'text') {
        const messageId = msg.id;
        const from = msg.from;
        const text = msg.text?.body || '';

        console.log('[WA Webhook] MENSAJE ENTRANTE', {
          id: messageId,
          from,
          text,
          timestamp: new Date().toISOString(),
        });

        // Evitar procesar el mismo mensaje dos veces (idempotencia)
        const key = `wa:msg:${messageId}`;
        const isNew = await ensureUnique(key);
        if (!isNew) {
          console.log('[WA Webhook] Mensaje duplicado, ignorando', { messageId });
          continue;
        }

        // Procesar mensaje entrante (RAG, respuesta automática, etc.)
        await handleUserQuestion({ fromE164: from, userQuestion: text });
      }
    }

    // Responder 200 OK a Meta (importante para que no reintente)
    res.sendStatus(200);
  } catch (error) {
    console.error('[WA Webhook] ERROR', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    // Aún así responder 200 para evitar reintentos infinitos de Meta
    // (mejor loguear el error y procesarlo después)
    res.sendStatus(200);
  }
});

