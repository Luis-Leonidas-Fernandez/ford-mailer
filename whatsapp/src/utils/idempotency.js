/**
 * Utilidades de idempotencia para WhatsApp
 * 
 * Este módulo proporciona funcionalidades para garantizar que las operaciones
 * se ejecuten una sola vez, evitando procesamientos duplicados. Utiliza Redis
 * como store de estado para mantener un registro de las operaciones ya ejecutadas.
 * 
 * Es especialmente útil para:
 * - Evitar procesar mensajes de WhatsApp duplicados
 * - Garantizar que webhooks no se procesen múltiples veces
 * - Implementar operaciones idempotentes en general
 * 
 * Funciones principales:
 * - ensureUnique: Marca una operación como única y verifica si ya fue ejecutada
 */

// src/utils/idempotency.js
import { getRedis } from './redis.js';

/**
 * Marca una clave como "nueva" de forma idempotente utilizando Redis
 * 
 * Utiliza el comando SETNX (SET if Not eXists) de Redis para garantizar
 * atomicidad en la operación. Si la clave ya existe, significa que la
 * operación ya fue procesada anteriormente.
 * 
 * @param {string} key - Clave única que identifica la operación
 * @param {number} [ttlSeconds=172800] - TTL en segundos (default: 2 días)
 * @returns {Promise<boolean>} true si NO existía (procesar), false si ya existía (ignorar)
 */
export async function ensureUnique(key, ttlSeconds = 172800) {
  const redis = getRedis();
  
  // Utiliza SETNX con TTL para marcar la clave como procesada
  // 'NX' = solo establece si no existe, 'EX' = establece TTL en segundos
  const res = await redis.set(key, '1', 'NX', 'EX', ttlSeconds);
  
  // Si retorna 'OK', la clave no existía y se estableció (operación nueva)
  // Si retorna null, la clave ya existía (operación duplicada)
  return res === 'OK';
}
