/**
 * Ejemplo de encolado inmediato de email
 * 
 * Este script demuestra cómo encolar un email para envío inmediato
 * utilizando el sistema de colas BullMQ. El email se procesará tan pronto
 * como un worker esté disponible.
 * 
 * Características del ejemplo:
 * - Encolado inmediato sin retrasos
 * - Utiliza el email de prueba configurado en TEST_TO
 * - Demuestra el uso básico de la cola de emails
 */

// mailer/examples/enqueue-now.js
import { enqueueEmail } from '../queue.js';
import { config } from '../../config.js';

// Verifica que esté configurado un email de prueba
if (!config.testTo) {
  throw new Error('Falta TEST_TO en .env (correo de prueba)');
}

// Encola un email para envío inmediato
const job = await enqueueEmail(
  {
    to: config.testTo,
    subject: 'Recordatorio inmediato',
    html: '<p>Este es un recordatorio de prueba <strong>ahora</strong></p>',
    text: 'Este es un recordatorio de prueba ahora',
  }
  // Sin opciones adicionales = envío inmediato
);

console.log(`[Enqueue-Now] Job encolado con id ${job.id}`);
process.exit(0);
