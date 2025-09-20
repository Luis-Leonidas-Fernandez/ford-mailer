/**
 * Ejemplo de encolado de email con retraso programado
 * 
 * Este script demuestra cómo programar el envío de un email para que se ejecute
 * después de un tiempo determinado. Utiliza la funcionalidad de delay de BullMQ
 * para diferir la ejecución del trabajo.
 * 
 * Características del ejemplo:
 * - Email programado para enviarse en 1 minuto
 * - Utiliza el email de prueba configurado en TEST_TO
 * - Demuestra el uso de la opción delay en BullMQ
 */

// mailer/examples/enqueue-later.js
import { enqueueEmail } from '../queue.js';
import { config } from '../../config.js';

// Verifica que esté configurado un email de prueba
if (!config.testTo) {
  throw new Error('Falta TEST_TO en .env (correo de prueba)');
}

// Encola un email para envío diferido
const job = await enqueueEmail(
  {
    to: config.testTo,
    subject: 'Recordatorio programado',
    html: '<p>Este es un recordatorio <strong>en 1 minuto</strong></p>',
    text: 'Este es un recordatorio en 1 minuto',
  },
  { delay: 60 * 1000 } // Retraso de 1 minuto (60,000 milisegundos)
);

console.log(`[Enqueue-Later] Job encolado con id ${job.id}, se enviará en 1 minuto`);
process.exit(0);

