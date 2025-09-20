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
const BASE = 'https://graph.facebook.com/v20.0';

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
      console.warn(
        `[retry][WA] intento=${attempt} wait=${waitMs}ms`,
        err?.response?.status || err?.code || err?.message
      );
    },
  });

  // Retorna la respuesta de la API (incluye ID del mensaje, etc.)
  return data;
}
