/**
 * Proveedor de WhatsApp Business API
 * 
 * Este módulo maneja la integración con WhatsApp Business API de Meta/Facebook
 * para el envío de mensajes. Incluye:
 * - Configuración de la API de Graph Facebook
 * - Envío de mensajes de texto
 * - Reintentos automáticos con backoff exponencial
 * - Manejo de errores y timeouts
 * 
 * Funciones principales:
 * - waSend: Envía mensajes de texto por WhatsApp con reintentos
 */

// src/providers/whatsapp.js
import axios from 'axios';
import 'dotenv/config';
import { retry } from '../utils/retry.js';

// URL base de la API de Graph Facebook para WhatsApp
const GRAPH_VERSION = process.env.WA_GRAPH_VERSION || 'v24.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
console.log('[WhatsApp] Config', { GRAPH_VERSION, BASE });


/**
 * Envía un mensaje de texto por WhatsApp Business API
 * @param {Object} params - Parámetros del mensaje
 * @param {string} params.to - Número de teléfono del destinatario en formato E.164
 * @param {string} params.text - Contenido del mensaje de texto
 * @returns {Promise<Object>} Respuesta de la API con información del mensaje enviado
 */
export async function waSend({ to, text }) {
  // Construye la URL del endpoint de mensajes
  const url = `${BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`;
  
  // Logging para diagnóstico
  console.log('[WhatsApp] Intentando enviar mensaje de texto', {
    url,
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID ? `${String(process.env.WA_PHONE_NUMBER_ID).slice(0, 10)}...` : 'NO CONFIGURADO',
    hasAccessToken: !!process.env.WA_ACCESS_TOKEN,
    accessTokenPreview: process.env.WA_ACCESS_TOKEN ? `${String(process.env.WA_ACCESS_TOKEN).slice(0, 10)}...` : 'NO CONFIGURADO',
    to,
    textLength: text?.length || 0,
  });
  
  // Headers de autenticación para la API de WhatsApp
  const headers = {
    Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  
  // Payload del mensaje según especificación de WhatsApp Business API
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  // Función que ejecuta la llamada HTTP
  const doCall = () => axios.post(url, body, { headers, timeout: 5000 });

  // Ejecuta la llamada con reintentos automáticos en caso de fallo
  const { data } = await retry(() => doCall(), {
    retries: 3,
    minDelay: 300,
    maxDelay: 2000,
    onRetry: (err, attempt, waitMs) => {
      console.warn(`[retry][WA] intento=${attempt} wait=${waitMs}ms`, {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        url: err?.config?.url,
        message: err?.message,
        responseData: err?.response?.data,
      });
    },
  });

  // Retorna la respuesta de la API (incluye ID del mensaje, etc.)
  return data;
}

/**
 * Envía un mensaje de plantilla por WhatsApp Business API
 * @param {Object} params - Parámetros del mensaje
 * @param {string} params.to - Número de teléfono del destinatario en formato E.164 (sin '+')
 * @param {string} params.templateName - Nombre de la plantilla aprobada por Meta
 * @param {string} params.languageCode - Código de idioma (ej: 'es_AR')
 * @param {Array<string>} params.bodyParams - Parámetros para las variables del cuerpo de la plantilla
 * @param {string} [params.headerImageUrl] - URL de imagen para el header (opcional)
 * @param {number} [params.expectedBodyParams] - Cantidad esperada de parámetros (para validación)
 * @returns {Promise<Object>} Respuesta de la API con información del mensaje enviado
 */
export async function waSendTemplate({
  to,
  templateName,
  languageCode,
  bodyParams = [],
  headerImageUrl,
  expectedBodyParams,
}) {
  // Validar cantidad de parámetros si se especifica
  if (expectedBodyParams !== undefined && bodyParams.length !== expectedBodyParams) {
    throw new Error(
      `Plantilla ${templateName} espera ${expectedBodyParams} params, llegaron ${bodyParams.length}`
    );
  }

  // Construye la URL del endpoint de mensajes
  const url = `${BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  // Logging para diagnóstico
  console.log('[WhatsApp] Intentando enviar template', {
    url,
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID ? `${String(process.env.WA_PHONE_NUMBER_ID).slice(0, 10)}...` : 'NO CONFIGURADO',
    hasAccessToken: !!process.env.WA_ACCESS_TOKEN,
    accessTokenPreview: process.env.WA_ACCESS_TOKEN ? `${String(process.env.WA_ACCESS_TOKEN).slice(0, 10)}...` : 'NO CONFIGURADO',
    templateName,
    languageCode,
    to,
    bodyParamsCount: bodyParams.length,
    hasHeaderImage: !!headerImageUrl,
  });

  // Headers de autenticación para la API de WhatsApp
  const headers = {
    Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Construir componentes del mensaje de plantilla según especificación WhatsApp Cloud API
  const components = [];

  // 1. Header con imagen (solo si se proporciona headerImageUrl)
  if (headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: headerImageUrl,
          },
        },
      ],
    });
  }

  // 2. Body con parámetros de texto (siempre se incluye si hay bodyParams)
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((param) => ({
        type: 'text',
        text: String(param),
      })),
    });
  }

  // Payload del mensaje según especificación de WhatsApp Business API para plantillas
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      // Incluir components solo si hay al menos uno (formato oficial WhatsApp Cloud API)
      ...(components.length > 0 ? { components } : {}),
    },
  };

  // Log del payload final antes de enviarlo (sin access token por seguridad)
  console.log('[WhatsApp] Payload final', {
    to,
    templateName,
    languageCode,
    components: components.map((c) => ({
      type: c.type,
      parametersCount: c.parameters?.length || 0,
      hasImage: c.type === 'header' && c.parameters?.[0]?.image?.link ? true : false,
    })),
    payload: JSON.stringify(body, null, 2),
  });

  // Función que ejecuta la llamada HTTP
  const doCall = () => axios.post(url, body, { headers, timeout: 5000 });

  // Ejecuta la llamada con reintentos automáticos en caso de fallo
  const { data } = await retry(() => doCall(), {
    retries: 3,
    minDelay: 300,
    maxDelay: 2000,
    onRetry: (err, attempt, waitMs) => {
      console.warn(`[retry][WA Template] intento=${attempt} wait=${waitMs}ms`, {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        url: err?.config?.url,
        message: err?.message,
        responseData: err?.response?.data,
      });
    },
  });

  // Retorna la respuesta de la API (incluye ID del mensaje, etc.)
  return data;
}
