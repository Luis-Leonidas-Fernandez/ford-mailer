/**
 * Archivo de configuración principal del proyecto Ford Mailer
 * 
 * Este módulo centraliza todas las configuraciones del sistema de envío de emails,
 * cargando las variables de entorno necesarias y estableciendo valores por defecto.
 * Incluye configuraciones para:
 * - Proveedores de email (Resend, Gmail)
 * - Configuración de Redis para colas
 * - Límites de velocidad y timezone
 * - Modo de prueba (dry run)
 */

// config.js
import 'dotenv/config';

export const config = {
  // Proveedor de email a utilizar: 'resend' o 'gmail'
  provider: process.env.EMAIL_PROVIDER || 'resend',

  // Configuración específica para el proveedor Resend
  resend: {
    apiKey: process.env.RESEND_API_KEY || null,
  },

  // Dirección de remitente por defecto, con fallback en orden de prioridad
  from:
    process.env.RESEND_FROM ||
    process.env.GMAIL_FROM ||
    'Recordatorios Ford <no-reply@inricompany.com>',

  // Email de prueba para testing - ⚠️ Importante configurar en producción
  testTo: process.env.TEST_TO || 'test@example.com',

  // URL de conexión a Redis para el sistema de colas BullMQ
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Zona horaria por defecto para programación de emails
  timezone: process.env.MAILER_TIMEZONE_DEFAULT || 'UTC',
  
  // Límite máximo de emails por segundo (rate limiting)
  maxRps: parseInt(process.env.MAILER_RATE_LIMIT_MAX_RPS || '5', 10),
  
  // Modo de prueba: si está activo, no envía emails reales
  dryRun: process.env.MAILER_DRY_RUN === 'true',
};
