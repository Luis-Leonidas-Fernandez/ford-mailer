/**
 * Loader de contactos desde archivos Excel (.xlsx)
 * 
 * Este módulo procesa archivos Excel para extraer listas de contactos y convertirlos
 * al formato estándar del sistema de campañas. Incluye:
 * - Validación de existencia del archivo
 * - Lectura de la primera hoja del archivo Excel
 * - Validación de formato de email
 * - Deduplicación automática de contactos
 * - Normalización de campos
 * 
 * Funciones principales:
 * - contactsFromXlsx: Generador que procesa contactos desde archivo Excel
 */

// mailer/campaign/loaders/xlsx.js
import xlsx from 'xlsx';
import fs from 'node:fs';

/**
 * Generador que procesa contactos desde un archivo Excel
 * @param {string} filePath - Ruta al archivo Excel (.xlsx)
 * @yields {Object} Contacto normalizado { email, nombre? }
 * @throws {Error} Si el archivo no existe
 */
export function* contactsFromXlsx(filePath) {
  // Verifica que el archivo Excel exista
  if (!fs.existsSync(filePath)) throw new Error(`XLSX no encontrado: ${filePath}`);
  
  // Lee el archivo Excel y extrae la primera hoja
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  // Set para deduplicación de emails
  const seen = new Set();
  
  for (const r of rows) {
    // Extrae el email (soporta diferentes formatos de columna)
    const email = String(r.Email || r.email || '').trim();
    
    // Valida formato de email básico y omite inválidos
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    
    // Omite emails duplicados
    if (seen.has(email)) continue;
    seen.add(email);

    // Extrae y normaliza el nombre (soporta diferentes formatos de columna)
    const nombre = String(r.Nombre || r.nombre || r.Name || '').trim();
    
    yield { 
      email, 
      nombre: nombre || undefined 
    };
  }
}
