/**
 * Servidor Express para Inri Servicios Digitales API
 * 
 * Este servidor proporciona una API REST con:
 * - Middleware CORS para permitir peticiones desde cualquier origen
 * - Servicio de archivos estáticos desde la carpeta public
 * - Endpoint de estado del servidor
 * - Webhooks de WhatsApp Business API (verificación y eventos)
 * - Manejo de errores centralizado
 * - Logging de requests con Morgan
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

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

// WhatsApp Webhook para eventos (mensajes entrantes)
app.post('/whatsapp/webhook', (req, res) => {
  console.log('[WhatsApp Webhook] Evento entrante de WhatsApp:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
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

