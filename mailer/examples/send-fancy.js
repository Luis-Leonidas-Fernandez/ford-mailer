/**
 * Ejemplo de envío directo con plantilla de recordatorio
 * 
 * Este script demuestra cómo enviar un email de recordatorio utilizando
 * las plantillas Handlebars del sistema. El email se envía directamente
 * sin pasar por la cola, útil para envíos únicos o de prueba.
 * 
 * Características del ejemplo:
 * - Envío directo sin cola (bypass del worker)
 * - Utiliza plantillas HTML y texto renderizadas
 * - Contexto completo con datos del cliente y cita
 * - Ejemplo de recordatorio de servicio automotriz
 */

// mailer/examples/send-fancy.js
import { sendReminder } from '../index.js';
import { renderReminder } from '../templates.js';
import { config } from '../../config.js';

// Contexto con todos los datos para renderizar la plantilla de recordatorio
const ctx = {
  // Información de la marca y campaña
  subject: 'Recordatorio de servicio',
  brandTitle: 'Ford Service',
  brandSubtitle: 'Centro Oficial',
  brandLogoUrl: 'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F', // Logo opcional

  // Información del cliente y vehículo
  recipientName: 'Luis',
  reminderType: 'servicio programado',
  vehicleModel: 'Ranger XLT 3.2',
  
  // Información del concesionario
  dealershipName: 'INRI Company Motors',
  dealershipAddress: 'Av. Siempreviva 742, Córdoba',
  contactPhone: '+54 351 555-1234',

  // Detalles de la cita
  appointmentDate: '05/09/2025',
  appointmentTime: '10:30',
  appointmentTz: 'ART',

  // Información adicional
  referenceCode: 'FORD-AR-012345',
  notes: 'Traer cédula verde y llaves duplicadas.',

  // Call-to-action
  ctaUrl: 'https://inricompany.com/turnos/confirmar?ref=FORD-AR-012345',
  ctaLabel: 'Confirmar asistencia',
};

// Renderiza las plantillas HTML y texto con el contexto
const { html, text } = await renderReminder(ctx);

// Envía el email directamente (sin cola) utilizando las plantillas renderizadas
const res = await sendReminder({
  to: config.testTo,
  subject: ctx.subject,
  html,
  text,
  // from: opcional; si no se especifica, usa config.from por defecto
});

console.log('Enviado:', res);
