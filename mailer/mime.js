/**
 * Generador de mensajes MIME multipart para Gmail API
 * 
 * Este módulo se encarga de construir mensajes de email en formato MIME multipart/alternative
 * que contienen tanto versión HTML como texto plano. El resultado se codifica en base64url
 * para ser compatible con Gmail API.
 * 
 * Funciones principales:
 * - buildMultipart: Construye un mensaje MIME completo con headers y body
 * - escapeHtml: Escapa caracteres HTML para prevenir inyecciones
 */

/**
 * Construye un mensaje MIME multipart/alternative codificado en base64url
 * @param {Object} params - Parámetros del mensaje
 * @param {string} params.from - Dirección del remitente
 * @param {string} params.to - Dirección del destinatario
 * @param {string} params.subject - Asunto del mensaje
 * @param {string} params.html - Contenido HTML del mensaje
 * @param {string} params.text - Contenido en texto plano del mensaje
 * @param {Object} [params.extraHeaders] - Headers adicionales opcionales
 * @returns {string} Mensaje MIME completo codificado en base64url
 */
export function buildMultipart({ from, to, subject, html, text, extraHeaders }) {
    // Genera un boundary único para separar las partes del mensaje multipart
    const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Construye los headers básicos del mensaje MIME
    let headers =
      `From: ${from}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    
    // Agrega headers adicionales si se proporcionan
    if (extraHeaders && typeof extraHeaders === 'object') {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers += `${k}: ${v}\r\n`;
      }
    }
    headers += `\r\n`;  
  
    // Prepara el contenido en texto plano y HTML
    const plain = text ?? '';
    const rich = html ?? `<pre>${escapeHtml(plain)}</pre>`;
  
    // Construye el body multipart con ambas versiones del contenido
    const body =
      `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${plain}\r\n\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${rich}\r\n\r\n` +
      `--${boundary}--`;
  
    // Codifica en base64url (formato requerido por Gmail API)
    // Reemplaza caracteres para compatibilidad con URLs y elimina padding
    return Buffer.from(headers + body)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  
/**
 * Escapa caracteres especiales HTML para prevenir inyecciones y renderizado incorrecto
 * @param {string} s - Cadena de texto a escapar
 * @returns {string} Texto con caracteres HTML escapados
 */
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')   // Ampersand debe escaparse primero
    .replaceAll('<', '&lt;')    // Menor que
    .replaceAll('>', '&gt;');   // Mayor que
}
  