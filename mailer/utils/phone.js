// mailer/utils/phone.js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Limpia y normaliza a E.164 (sin '+') usando libphonenumber-js.
 * Funciona globalmente (LatAm, Europa, Asia, etc).
 * @param {string|number|null|undefined} raw - Número de teléfono en cualquier formato
 * @param {string} defaultCountry - Código de país por defecto (ej: 'AR')
 * @returns {string|null} Número en formato E.164 sin '+' o null si no es válido
 */
export function normalizePhone(raw, defaultCountry = 'AR') {
  if (raw === null || raw === undefined) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Intento 1: si ya viene con + o con prefijo internacional, suele parsear bien
  let pn = parsePhoneNumberFromString(trimmed);

  // Intento 2: si es número local/nacional, usamos país por defecto
  if (!pn) pn = parsePhoneNumberFromString(trimmed, defaultCountry);

  if (!pn || !pn.isValid()) return null;

  return pn.number.replace('+', ''); // E.164 sin '+'
}

/**
 * Normaliza número PARA WHATSAPP.
 * - E.164 sin '+'
 * - Aplica correcciones especiales (Argentina mobile "9", remover '15' cuando aplique)
 *
 * @param {string|number|null|undefined} raw - Número de teléfono en cualquier formato
 * @param {string} defaultCountry - Código de país por defecto (ej: 'AR')
 * @returns {string|null} Número en formato E.164 sin '+' o null si no es válido
 */
export function normalizeWhatsAppPhone(raw, defaultCountry = 'AR') {
  if (raw === null || raw === undefined) return null;

  // 1) normalización global estándar
  const normalized = normalizePhone(raw, defaultCountry);
  if (!normalized) return null;

  // 2) Ajustes WhatsApp específicos por país (cuando hay reglas raras en datasets)
  // Argentina: WhatsApp móvil suele requerir 54 + 9 + (area + subscriber)
  // Muchos datos vienen como 54 + area + subscriber (sin 9) o con "15" embebido.
  if (normalized.startsWith('54')) {
    let n = normalized;

    // a) Si tiene '15' después del código de área, intentar removerlo.
    // Heurística segura: si hay "15" y el total queda > 13 dígitos, quitamos un solo "15"
    // (E.164 max 15). Para AR móvil típico queda 13: 54 9 + 10 dígitos.
    if (n.length > 13) {
      // quitamos primera ocurrencia de '15' después de '54'
      const afterCC = n.slice(2);
      const idx = afterCC.indexOf('15');
      if (idx >= 0) {
        n = '54' + afterCC.slice(0, idx) + afterCC.slice(idx + 2);
      }
    }

    // b) Asegurar el '9' después de 54 si parece móvil sin 9.
    // Si ya tiene 549..., ok.
    // Si no, lo insertamos. Esto fue exactamente tu bug: 5436... => 54936...
    if (!n.startsWith('549')) {
      n = '549' + n.slice(2);
    }

    // Validación final de E.164 sin '+'
    return isValidE164(n) ? n : null;
  }

  // Otros países: por defecto libphonenumber suele ser suficiente
  return isValidE164(normalized) ? normalized : null;
}

/**
 * Valida si un número de teléfono está en formato E.164 sin '+'
 * @param {string|number|null|undefined} phone - Número de teléfono a validar
 * @returns {boolean} true si el formato es válido (E.164 sin '+')
 */
export function isValidE164(phone) {
  return /^[1-9]\d{1,14}$/.test(String(phone || '').trim());
}

