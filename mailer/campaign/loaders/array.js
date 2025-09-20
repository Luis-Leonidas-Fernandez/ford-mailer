/**
 * Loader de contactos desde array en memoria
 * 
 * Este módulo proporciona una función generadora que procesa un array de contactos
 * y los convierte al formato estándar utilizado por el sistema de campañas.
 * Filtra contactos inválidos y normaliza los campos de email y nombre.
 * 
 * Funciones principales:
 * - contactsFromArray: Generador que procesa y valida contactos desde un array
 */

// mailer/campaign/loaders/array.js

/**
 * Generador que procesa contactos desde un array y los normaliza
 * @param {Array} base - Array de objetos con propiedades email y nombre/Name
 * @yields {Object} Contacto normalizado { email, nombre? }
 */
export function* contactsFromArray(base) {
    for (const r of base) {
      // Extrae y limpia el email
      const email = String(r.email || '').trim();
      
      // Omite contactos sin email válido
      if (!email) continue;
      
      // Extrae y normaliza el nombre (soporta diferentes formatos)
      const nombre = String(r.nombre || r.Name || '').trim() || undefined;
      
      yield {
        email,
        nombre,
      };
    }
  }
  