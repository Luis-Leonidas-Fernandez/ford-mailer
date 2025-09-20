/**
 * Orquestador principal del sistema de WhatsApp con IA
 * 
 * Este módulo coordina la interacción entre el usuario de WhatsApp y el sistema
 * de IA basado en RAG (Retrieval-Augmented Generation). Maneja el flujo completo:
 * 1. Recibe preguntas del usuario via WhatsApp
 * 2. Busca contexto relevante en la base de conocimientos (RAG)
 * 3. Genera respuestas utilizando el modelo de IA (Qwen)
 * 4. Envía la respuesta de vuelta por WhatsApp
 * 
 * Funciones principales:
 * - handleUserQuestion: Procesa preguntas del usuario con contexto RAG
 */

// src/orchestrator.js
import { ragSearch } from './providers/rag.js';
import { chatQwen } from './providers/qwen.js';
import { waSend } from './providers/whatsapp.js';

/**
 * Maneja preguntas de usuarios utilizando RAG + LLM + WhatsApp
 * 
 * Flujo del proceso:
 * 1. Busca contexto relevante en RAG
 * 2. Combina contexto + pregunta para el LLM (Qwen)
 * 3. Responde al usuario por WhatsApp
 * 
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.fromE164 - Número de teléfono del usuario en formato E.164
 * @param {string} params.userQuestion - Pregunta del usuario
 * @returns {Promise<Object>} Resultado con información de envío y chunks utilizados
 */
export async function handleUserQuestion({ fromE164, userQuestion }) {
  // Paso 1: Buscar contexto relevante en la base de conocimientos RAG
  const chunks = await ragSearch(userQuestion, 5);

  // Construye un bloque de contexto formateado con las fuentes encontradas
  const contextBlock = chunks
    .map((c, i) => `# Fuente ${i + 1}\n${c.text}\n${c.source ? `(Fuente: ${c.source})` : ''}`)
    .join('\n\n');

  // Paso 2: Prepara el prompt para el modelo de IA con contexto y restricciones
  const messages = [
    {
      role: 'system',
      content:
        'Eres un asistente de Ford. Responde SOLO con la información del CONTEXTO. ' +
        'Si la info no está, dilo explícitamente y ofrece alternativas. Sé breve, claro y útil.',
    },
    { role: 'system', content: `CONTEXTO:\n\n${contextBlock || '(sin resultados de RAG)'}` },
    { role: 'user', content: userQuestion },
  ];

  // Genera respuesta utilizando el modelo Qwen
  const { text: answer } = await chatQwen(messages);

  // Valida y sanitiza la respuesta, proporciona fallback si es necesario
  const safeAnswer =
    (answer && answer.trim()) ||
    'No encuentro datos ahora mismo. ¿Podés darme un poco más de detalle?';

  // Paso 3: Envía la respuesta al usuario por WhatsApp
  await waSend({ to: fromE164, text: safeAnswer });

  // Retorna información del procesamiento para logging/debugging
  return { sentTo: fromE164, answer: safeAnswer, usedChunks: chunks.length };
}
