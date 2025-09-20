/**
 * Ejemplo de ejecución de campaña Ford desde array de contactos
 * 
 * Este script demuestra cómo ejecutar una campaña promocional de Ford
 * utilizando un array de contactos definido directamente en el código.
 * Es útil para pruebas rápidas y campañas pequeñas.
 * 
 * Características del ejemplo:
 * - Contactos definidos en array estático
 * - Promociones de ejemplo de vehículos Ford
 * - Configuración de vendedor y campaña
 * - Rate limiting configurado a 8 RPS
 */

import { runFordCampaign } from '../campaign/core.js';
import { contactsFromArray } from '../campaign/loaders/array.js';

// Lista de contactos de ejemplo para la campaña
const BASE = [
  { email: 'ana@example.com', nombre: 'Ana' },
  { email: 'carlos@example.com', nombre: 'Carlos' },
];

// Promociones de vehículos Ford para incluir en el email
const PROMOS = [
  { 
    titulo: 'Ford Ranger XLT', 
    descripcion: 'Financiación especial', 
    precio: 'USD 32.500', 
    url: 'https://inri.com/ranger?utm_source=email&utm_medium=promo&utm_campaign=ford' 
  },
  { 
    titulo: 'Ford Mustang', 
    descripcion: 'Entrega pactada', 
    precio: 'USD 52.000', 
    url: 'https://inri.com/mustang?utm_source=email&utm_medium=promo&utm_campaign=ford' 
  },
  // Agregar más promociones según necesidad...
];

// Información del vendedor para contacto por WhatsApp
const VENDEDOR = { nombre: 'Mariano', phoneE164: '+5493515551234' };

// Configuración de la campaña promocional
const CAMPAIGN = {
  subject: 'Promos Ford de la semana',
  brandTitle: 'Ford Service',
  brandSubtitle: 'Centro Oficial',
  brandLogoUrl: 'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F',
  dealershipName: 'INRI Company Motors',
  dealershipAddress: 'Av. Siempreviva 742, Córdoba',
  contactPhone: '+54 351 555-1234',
  ctaLabel: 'Escribir por WhatsApp',
};

// Ejecuta la campaña con los parámetros configurados
await runFordCampaign({
  contacts: contactsFromArray(BASE),  // Convierte el array en generador de contactos
  promos: PROMOS,                     // Lista de promociones
  vendor: VENDEDOR,                   // Información del vendedor
  campaign: CAMPAIGN,                 // Datos de la campaña
  options: { rps: 8 },               // Configuración: 8 emails por segundo
});

// Termina el proceso una vez completada la campaña
process.exit(0);
