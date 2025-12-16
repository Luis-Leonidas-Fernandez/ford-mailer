/**
 * Aplicación Express
 * Configuración de middleware y rutas
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import authRoutes from './routes/auth.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import { authenticate } from '../auth/middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import { handleUserQuestion } from '../whatsapp/src/orchestrator.js';
import { ensureUnique } from '../whatsapp/src/utils/idempotency.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
app.set('trust proxy', true); // importante porque estás detrás de Nginx


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
app.use(express.static(join(__dirname, '../public')));

// Ruta raíz - sirve el HTML de estado
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public', 'index.html'));
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
      port: process.env.API_PORT || 3001,
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

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de campañas
app.use('/api/campaigns', campaignRoutes);

// Ruta protegida de ejemplo
app.get('/api/protected', authenticate, (req, res) => {
  res.json({
    message: 'Esta es una ruta protegida',
    user: req.user,
  });
});

// ===================== WHATSAPP WEBHOOK =====================

// GET /whatsapp/webhook -> verificación de Meta
app.get('/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verificación OK');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Verificación FALLIDA', { mode, token });
  return res.sendStatus(403);
});

// POST /whatsapp/webhook -> mensajes + estados
app.post('/whatsapp/webhook', async (req, res) => {
  try {
    console.log(
      '[WhatsApp Webhook] Payload recibido:',
      JSON.stringify(req.body, null, 2)
    );

    const change = req?.body?.entry?.[0]?.changes?.[0];
    const value = change?.value;

    // 1) Eventos de estado (sent, delivered, failed, etc.)
    const status = value?.statuses?.[0];
    if (status) {
      console.log('[WA STATUS]', {
        msgId: status.id,
        status: status.status,
        errors: status.errors,
      });
    }

    // 2) Mensajes entrantes de texto
    const msg = value?.messages?.[0];
    if (msg?.type === 'text') {
      const messageId = msg.id;
      const from = msg.from;
      const text = msg.text?.body || '';

      const key = `wa:msg:${messageId}`;
      const isNew = await ensureUnique(key);
      if (!isNew) {
        return res.sendStatus(200);
      }

      await handleUserQuestion({ fromE164: from, userQuestion: text });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err?.response?.data || err?.message);
    return res.sendStatus(500);
  }
});

// ================== FIN WHATSAPP WEBHOOK ====================



// Middleware de manejo de rutas no encontradas (404)
app.use(notFoundHandler);

// Middleware de manejo de errores global (debe ser el último)
app.use(errorHandler);

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

export default app;

