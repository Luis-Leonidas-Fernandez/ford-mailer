/**
 * Proveedor de Gmail para el sistema Ford Mailer
 * 
 * Este módulo maneja la integración con Gmail API utilizando OAuth2 para el envío
 * de emails. Utiliza las credenciales de Google configuradas en las variables de entorno
 * para autenticarse y enviar emails a través de la API de Gmail.
 * 
 * Funciones principales:
 * - ensureClient: Inicializa y configura el cliente de Gmail API
 * - sendRawBase64Url: Envía emails en formato MIME codificado en base64url
 */

import { google } from 'googleapis';

// Extracción de variables de entorno necesarias para OAuth2
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
} = process.env;

let client, gmail;

/**
 * Inicializa y configura el cliente de Gmail API con autenticación OAuth2
 * @returns {Object} Cliente de Gmail API configurado
 * @throws {Error} Si faltan las credenciales OAuth2 requeridas
 */
function ensureClient() {
  // Si ya existe una instancia, la reutiliza
  if (gmail) return gmail;
  
  // Verifica que todas las credenciales OAuth2 estén presentes
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Missing OAuth2 envs (CLIENT_ID/SECRET/REFRESH_TOKEN)');
  }
  
  // Configura el cliente OAuth2 de Google
  client = new google.auth.OAuth2({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: 'http://localhost',
  });
  
  // Establece el refresh token para la autenticación automática
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  
  // Inicializa el cliente de Gmail API
  gmail = google.gmail({ version: 'v1', auth: client });
  return gmail;
}

/**
 * Envía un email utilizando Gmail API con contenido MIME en formato base64url
 * @param {Object} params - Parámetros del envío
 * @param {string} params.raw - Contenido del email en formato MIME codificado en base64url
 * @returns {Promise<Object>} Objeto con messageId y threadId del email enviado
 */
export async function sendRawBase64Url({ raw }) {
  const api = ensureClient();
  
  // Envía el email utilizando Gmail API
  const res = await api.users.messages.send({
    userId: 'me', // 'me' indica el usuario autenticado actual
    requestBody: { raw },
  });
  
  // Retorna los identificadores del mensaje enviado
  return { messageId: res.data.id, threadId: res.data.threadId };
}
