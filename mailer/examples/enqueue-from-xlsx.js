/**
 * Ejemplo de ejecución de campaña Ford desde archivo Excel
 * 
 * Este script demuestra cómo ejecutar una campaña promocional de Ford
 * utilizando contactos cargados desde un archivo Excel (.xlsx).
 * Es la forma recomendada para campañas masivas con muchos contactos.
 * 
 * Características del ejemplo:
 * - Contactos cargados desde archivo Excel
 * - Ruta configurable via variable de entorno MAILER_XLSX_PATH
 * - Deduplicación automática de contactos
 * - Validación de formato de emails
 * - Rate limiting configurado a 8 RPS
 */

import path from 'node:path';
import { runFordCampaign } from '../campaign/core.js';
import { contactsFromXlsx } from '../campaign/loaders/xlsx.js';

// Ruta al archivo Excel, configurable via variable de entorno
const XLSX_PATH = process.env.MAILER_XLSX_PATH || path.resolve(process.cwd(), 'data/clientes.xlsx');

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

// Ejecuta la campaña cargando contactos desde el archivo Excel
await runFordCampaign({
  contacts: contactsFromXlsx(XLSX_PATH),  // Carga contactos desde Excel
  promos: PROMOS,                         // Lista de promociones
  vendor: VENDEDOR,                       // Información del vendedor
  campaign: CAMPAIGN,                     // Datos de la campaña
  options: { rps: 8 },                   // Configuración: 8 emails por segundo
});

// Termina el proceso una vez completada la campaña
process.exit(0);
