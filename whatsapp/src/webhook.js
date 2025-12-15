/**
 * Webhook para WhatsApp Business API
 * 
 * Este módulo implementa un servidor Express que actúa como webhook para recibir
 * mensajes de WhatsApp Business API. Maneja:
 * - Verificación del webhook (proceso de configuración inicial)
 * - Recepción de mensajes entrantes
 * - Procesamiento idempotente (evita procesar mensajes duplicados)
 * - Delegación al orquestador para generar respuestas con IA
 * 
 * El servidor escucha en el puerto configurado y procesa mensajes de texto
 * de forma asíncrona, asegurando que cada mensaje se procese una sola vez.
 */

// src/webhook.js
import express from 'express';
import 'dotenv/config';
import { handleUserQuestion } from './orchestrator.js';
import { ensureUnique } from './utils/idempotency.js';

// Configuración del servidor Express
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

/**
 * Endpoint GET para verificación del webhook
 * 
 * Meta/Facebook llama a este endpoint durante la configuración inicial
 * del webhook para verificar que el servidor está funcionando y que
 * el token de verificación es correcto.
 */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verifica que sea una suscripción con el token correcto
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  
  // Rechaza solicitudes inválidas
  return res.sendStatus(403);
});

/**
 * Endpoint POST para recepción de mensajes de WhatsApp
 * 
 * Meta/Facebook envía mensajes entrantes a este endpoint. El servidor
 * procesa mensajes de texto y los envía al orquestador para generar
 * respuestas utilizando IA + RAG.
 */
app.post('/webhook', async (req, res) => {
  try {
    // Extrae la información del mensaje desde el payload de WhatsApp
    console.log('[WhatsApp Webhook] Payload recibido:', JSON.stringify(req.body, null, 2));

    const change = req?.body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];

    // Procesa solo mensajes de texto
    if (msg?.type === 'text') {
      const messageId = msg.id;           // ID único del mensaje de WhatsApp
      const from = msg.from;              // Número de teléfono en formato E.164
      const text = msg.text?.body || '';  // Contenido del mensaje

      // 🔒 Implementa idempotencia para evitar procesar mensajes duplicados
      const key = `wa:msg:${messageId}`;
      const isNew = await ensureUnique(key); // true = procesar; false = ya procesado
      
      // Si el mensaje ya fue procesado, responde OK sin procesar
      if (!isNew) return res.sendStatus(200);

      // Procesa la pregunta del usuario utilizando IA + RAG
      await handleUserQuestion({ fromE164: from, userQuestion: text });
    }

    // Responde con éxito para todos los tipos de webhook
    res.sendStatus(200);
  } catch (err) {
    // Log de errores para debugging
    console.error('Webhook error:', err?.response?.data || err?.message);
    res.sendStatus(500);
  }
});

// Inicia el servidor en el puerto configurado
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`[Webhook] listening on :${PORT}`));
