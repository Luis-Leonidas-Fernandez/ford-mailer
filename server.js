/**
 * Servidor Express para Inri Servicios Digitales API
 * 
 * Este servidor proporciona una API REST con:
 * - Middleware CORS para permitir peticiones desde cualquier origen
 * - Servicio de archivos estáticos desde la carpeta public
 * - Endpoint de estado del servidor
 * - Webhooks de WhatsApp Business API (verificación y eventos)
 *   - Verificación del webhook (GET) según políticas de Meta
 *   - Procesamiento de eventos (POST) con:
 *     - Validación de payload
 *     - Idempotencia para evitar mensajes duplicados
 *     - Manejo de diferentes tipos de eventos (mensajes, statuses)
 *     - Rate limiting para protección contra spam/abuso
 *     - Logging estructurado
 * - Manejo de errores centralizado
 * - Logging de requests con Morgan
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { getRedis } from './whatsapp/src/utils/redis.js';
import { ensureUnique } from './whatsapp/src/utils/idempotency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear aplicación Express
const app = express();

// Configuración del puerto
const PORT = Number(process.env.API_PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Tiempo de inicio del servidor
const startTime = Date.now();

// Middleware
app.use(cors()); // Permitir CORS desde cualquier origen
app.use(express.json()); // Parsear JSON en requests
app.use(express.urlencoded({ extended: true })); // Parsear URL-encoded

// Logging HTTP (solo en desarrollo mostrar formato detallado)
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Servir archivos estáticos desde la carpeta public
app.use(express.static(join(__dirname, 'public')));

// Rate limiting para webhook de WhatsApp (protección contra spam/abuso)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests por minuto
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No aplicar rate limit a peticiones de Meta (por User-Agent)
    const userAgent = req.get('user-agent') || '';
    return userAgent.includes('facebookplatform') || userAgent.includes('facebookexternalhit');
  }
});

// Ruta raíz - sirve el HTML de estado
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Endpoint de estado del servidor (JSON)
app.get('/api/status', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  
  res.json({
    status: 'active',
    message: 'Inri Servicios Digitales API está funcionando correctamente',
    server: {
      uptime: uptime,
      uptimeFormatted: uptimeFormatted,
      nodeVersion: process.version,
      environment: NODE_ENV,
      port: PORT,
      timestamp: new Date().toISOString()
    }
  });
});

// Endpoint de salud (health check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// WhatsApp Webhook Verification (OBLIGATORIO)
app.get('/whatsapp/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'inri_verify_token';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Si es una verificación de Meta (tiene los parámetros de verificación)
  if (mode && token && challenge) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook] Webhook verificado correctamente.');
      // Meta espera solo el challenge como texto plano
      res.status(200).send(challenge);
    } else {
      console.log('[WhatsApp Webhook] Verificación fallida.');
      res.sendStatus(403);
    }
  } else {
    // Si no es una verificación de Meta, mostrar página HTML elegante
    res.sendFile(join(__dirname, 'public', 'webhook.html'));
  }
});

/**
 * Valida la estructura del payload del webhook de WhatsApp
 * @param {Object} body - Cuerpo de la petición
 * @returns {boolean} true si el payload es válido
 */
function validateWebhookPayload(body) {
  if (!body || typeof body !== 'object') return false;
  if (!Array.isArray(body.entry) || body.entry.length === 0) return false;
  
  const entry = body.entry[0];
  if (!Array.isArray(entry.changes) || entry.changes.length === 0) return false;
  
  const change = entry.changes[0];
  if (!change.value || typeof change.value !== 'object') return false;
  
  return true;
}

// WhatsApp Webhook para eventos (mensajes entrantes)
app.post('/whatsapp/webhook', webhookLimiter, async (req, res) => {
  try {
    // Validar estructura del payload
    if (!validateWebhookPayload(req.body)) {
      console.warn('[WhatsApp Webhook] Payload inválido recibido');
      // Siempre responder 200 OK incluso si el payload es inválido (política de Meta)
      return res.sendStatus(200);
    }

    const change = req.body.entry[0].changes[0];
    const value = change.value;

    // Manejar mensajes entrantes
    if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
      const msg = value.messages[0];
      
      // Procesar solo mensajes de texto
      if (msg.type === 'text' && msg.text?.body) {
        const messageId = msg.id;
        const from = msg.from;
        const text = msg.text.body;

        // Implementar idempotencia para evitar procesar mensajes duplicados
        try {
          const key = `wa:msg:${messageId}`;
          const isNew = await ensureUnique(key, 172800); // TTL de 2 días
          
          if (!isNew) {
            console.log(`[WhatsApp Webhook] Mensaje duplicado ignorado: ${messageId}`);
            return res.sendStatus(200);
          }

          // Log estructurado del mensaje recibido
          console.log('[WhatsApp Webhook] Mensaje recibido:', {
            messageId,
            from,
            text: text.substring(0, 100), // Solo primeros 100 caracteres para log
            timestamp: new Date().toISOString()
          });

          // TODO: Aquí puedes agregar la lógica para procesar el mensaje
          // Por ejemplo: delegar al orquestador, guardar en BD, etc.
          // await handleUserQuestion({ fromE164: from, userQuestion: text });

        } catch (redisError) {
          // Si hay error con Redis, loguear pero continuar procesando
          console.error('[WhatsApp Webhook] Error de Redis (idempotencia):', redisError);
          // Continuar procesando el mensaje aunque falle la idempotencia
        }
      } else {
        console.log(`[WhatsApp Webhook] Tipo de mensaje no procesado: ${msg.type}`);
      }
    }

    // Manejar actualizaciones de estado de mensajes
    if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
      const status = value.statuses[0];
      console.log('[WhatsApp Webhook] Estado de mensaje actualizado:', {
        messageId: status.id,
        status: status.status,
        timestamp: status.timestamp,
        recipientId: status.recipient_id
      });
    }

    // Manejar otros tipos de eventos (read receipts, etc.)
    if (value.contacts) {
      console.log('[WhatsApp Webhook] Información de contacto recibida');
    }

    // Siempre responder 200 OK (política de Meta)
    res.sendStatus(200);
  } catch (err) {
    // Log estructurado de errores
    console.error('[WhatsApp Webhook] Error procesando webhook:', {
      error: err.message,
      stack: NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Siempre responder 200 OK incluso si hay errores (política de Meta)
    res.sendStatus(200);
  }
});

// Middleware de manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `La ruta ${req.method} ${req.path} no existe`,
    timestamp: new Date().toISOString()
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// Función auxiliar para formatear uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[Inri API] Servidor iniciado en puerto ${PORT}`);
  console.log(`[Inri API] Entorno: ${NODE_ENV}`);
  console.log(`[Inri API] Estado disponible en: http://localhost:${PORT}`);
  console.log(`[Inri API] API Status: http://localhost:${PORT}/api/status`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

