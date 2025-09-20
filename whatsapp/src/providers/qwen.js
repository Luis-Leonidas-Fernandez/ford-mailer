/**
 * Proveedor del modelo de IA Qwen
 * 
 * Este módulo maneja la integración con el modelo de lenguaje Qwen para
 * generar respuestas inteligentes. Incluye:
 * - Configuración del modelo Qwen 2.5-1.5B Instruct
 * - Envío de mensajes con contexto y conversación
 * - Reintentos automáticos en caso de fallo
 * - Parsing de respuestas del modelo
 * 
 * El modelo se ejecuta en un endpoint externo (ej: RunPod) y se comunica
 * via API REST con formato compatible con OpenAI.
 * 
 * Funciones principales:
 * - chatQwen: Genera respuestas utilizando el modelo Qwen con contexto
 */

// src/providers/qwen.js
import axios from 'axios';
import 'dotenv/config';
import { retry } from '../utils/retry.js';

/**
 * Genera una respuesta utilizando el modelo Qwen
 * @param {Array} messages - Array de mensajes de conversación en formato OpenAI
 * @returns {Promise<Object>} Objeto con la respuesta generada y datos raw
 */
export async function chatQwen(messages) {
  // Configura el payload para el modelo Qwen (formato compatible con OpenAI)
  const payload = {
    model: 'qwen2.5-1.5b-instruct',    // Modelo específico de Qwen
    messages,                          // Conversación con contexto del sistema
    temperature: 0.3,                  // Controla la creatividad (0.0 = determinístico, 1.0 = creativo)
    max_tokens: 500,                   // Límite máximo de tokens en la respuesta
  };

  // Función que ejecuta la llamada al modelo de IA
  const doCall = () =>
    axios.post(process.env.LLM_ENDPOINT, payload, { timeout: 8000 });

  // Ejecuta la llamada con reintentos automáticos
  const { data } = await retry(() => doCall(), {
    retries: 3,
    minDelay: 300,
    maxDelay: 3000,
    onRetry: (err, attempt, waitMs) => {
      console.warn(
        `[retry][QWEN] intento=${attempt} wait=${waitMs}ms`,
        err?.response?.status || err?.code || err?.message
      );
    },
  });

  // Extrae el texto de respuesta desde diferentes formatos posibles
  const text =
    data?.choices?.[0]?.message?.content ??  // Formato OpenAI estándar
    data?.output ??                          // Formato alternativo 1
    data?.text ??                            // Formato alternativo 2
    '';                                      // Fallback vacío

  return { text, raw: data };
}
