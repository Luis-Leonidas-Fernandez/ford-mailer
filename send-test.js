/**
 * Script de prueba para el sistema de envío de emails Ford Mailer
 * 
 * Este archivo es utilizado para realizar pruebas rápidas del sistema de envío,
 * enviando un email de prueba con contenido tanto en texto plano como HTML.
 * Es útil para verificar que la configuración esté funcionando correctamente
 * antes de ejecutar campañas masivas.
 */

import 'dotenv/config';
import { sendReminder } from './mailer/index.js';
import { config } from './config.js';

// Configuración del email de prueba
const from = process.env.GMAIL_FROM || config.from; // Remitente (opcional, usa config por defecto)
const to = process.env.TEST_TO || 'tu-correo@ejemplo.com'; // Destinatario de prueba

// Contenido del email de prueba
const subject = 'Test Ford Mailer';
const text = 'Hola! Este es un test de Ford Mailer.'; // Versión en texto plano
const html = '<p><strong>Hola!</strong> Este es un test de <em>Ford Mailer</em>.</p>'; // Versión HTML

// Ejecución del envío de prueba
try {
  const res = await sendReminder({ from, to, subject, html, text });
  console.log('OK:', res);
} catch (e) {
  console.error('ERROR:', e);
  process.exit(1);
}

