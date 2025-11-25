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
    imageUrl: 'https://res.cloudinary.com/dzrr7sbol/image/upload/v1763472209/ford-ranger-xlt_nyyc5m.webp', 
     
     },
  { 
    imageUrl: 'https://res.cloudinary.com/dzrr7sbol/image/upload/v1763472439/ford-ranger-xls_lfnnfz.webp', 
    
    },
  // Agregar más promociones según necesidad...
];

// Información del vendedor para contacto por WhatsApp
const VENDEDOR = { nombre: 'Cristian', phoneE164: '+5493624169463' };

// Configuración de la campaña promocional
const CAMPAIGN = {
  subject: 'Promos Ford del mes',
  brandTitle: 'Ford Promos del Mes',
  brandSubtitle: 'Centro de Ventas',
  brandLogoUrl: 'https://dummyimage.com/128x128/0b2a4a/ffffff&text=F',
  dealershipName: 'Asesor Certificado',
  dealershipAddress: 'Av. 9 de Julio y Av. Italia',
  contactPhone: '+54 362 416-9463',
  ctaLabel: 'Escribime',
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
