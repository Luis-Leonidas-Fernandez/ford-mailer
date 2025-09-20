/**
 * Proveedor RAG (Retrieval-Augmented Generation)
 * 
 * Este módulo maneja la integración con el sistema de búsqueda semántica
 * RAG para obtener contexto relevante de la base de conocimientos.
 * Incluye:
 * - Búsqueda semántica en vectores embeddings
 * - Configuración de top-K resultados
 * - Reintentos automáticos en caso de fallo
 * - Normalización de respuestas desde diferentes formatos
 * 
 * El sistema RAG permite que el modelo de IA tenga acceso a información
 * específica y actualizada sobre Ford y sus productos/servicios.
 * 
 * Funciones principales:
 * - ragSearch: Busca contexto relevante en la base de conocimientos
 */

// src/providers/rag.js
import axios from 'axios';
import 'dotenv/config';
import { retry } from '../utils/retry.js';

/**
 * Realiza una búsqueda semántica en la base de conocimientos RAG
 * @param {string} query - Consulta de búsqueda del usuario
 * @param {number} [topK=5] - Número máximo de resultados a retornar
 * @returns {Promise<Array>} Array de chunks con texto, fuente y score de relevancia
 */
export async function ragSearch(query, topK = 5) {
  // Función que ejecuta la búsqueda en el sistema RAG
  const doCall = () =>
    axios.post(
      process.env.RAG_ENDPOINT,
      { query, top_k: topK },
      { 
        headers: { 'x-api-key': process.env.RAG_API_KEY }, 
        timeout: 5000 
      }
    );

  // Ejecuta la búsqueda con reintentos automáticos
  const { data } = await retry(() => doCall(), {
    retries: 3,
    minDelay: 250,
    maxDelay: 2500,
    onRetry: (err, attempt, waitMs) => {
      console.warn(
        `[retry][RAG] intento=${attempt} wait=${waitMs}ms`,
        err?.response?.status || err?.code || err?.message
      );
    },
  });

  // Normaliza la respuesta desde diferentes formatos posibles de la API RAG
  const chunks = (data?.chunks || data?.results || data?.data?.chunks || []).map((c) => ({
    text: c.text || c.content || '',      // Contenido del chunk
    source: c.source || c.url || '',      // Fuente original del contenido
    score: c.score ?? null,               // Score de relevancia semántica
  }));

  return chunks;
}
