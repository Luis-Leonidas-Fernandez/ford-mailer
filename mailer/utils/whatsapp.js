/**
 * Utilidades para generar links de WhatsApp
 * 
 * Este módulo proporciona funciones para generar enlaces de WhatsApp
 * que permiten abrir conversaciones con mensajes pre-llenados.
 */

/**
 * Genera un enlace de WhatsApp con mensaje personalizado
 * @param {Object} params - Parámetros del enlace
 * @param {string} params.phoneE164 - Número de teléfono en formato E.164 (ej: +5493515551234)
 * @param {string} params.clienteNombre - Nombre del cliente
 * @param {string} params.vendedorNombre - Nombre del vendedor
 * @returns {string} URL de WhatsApp con mensaje pre-llenado
 */
export function buildWhatsAppLink({ phoneE164, clienteNombre, vendedorNombre }) {
  // Genera mensaje personalizado
  const mensaje = `Hola ${vendedorNombre}, soy ${clienteNombre} y estoy interesado en las promociones de Ford.`;
  
  // Codifica el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje);
  
  // Genera el enlace de WhatsApp
  // Formato: https://wa.me/[número]?text=[mensaje]
  return `https://wa.me/${phoneE164.replace(/[^0-9]/g, '')}?text=${mensajeCodificado}`;
}