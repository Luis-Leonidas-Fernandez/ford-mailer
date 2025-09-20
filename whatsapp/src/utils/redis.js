/**
 * Cliente de Redis para WhatsApp
 * 
 * Este módulo proporciona una conexión singleton a Redis para ser utilizada
 * por todo el sistema de WhatsApp. Redis se utiliza para:
 * - Almacenamiento de estado de idempotencia
 * - Cache de sesiones y datos temporales
 * - Coordinación entre diferentes instancias del servicio
 * 
 * El cliente se inicializa de forma lazy (solo cuando se necesita) y
 * reutiliza la misma conexión en toda la aplicación.
 * 
 * Funciones principales:
 * - getRedis: Obtiene la instancia singleton del cliente Redis
 */

// src/utils/redis.js
import Redis from 'ioredis';
import 'dotenv/config';

// Variable para almacenar la instancia singleton del cliente Redis
let client;

/**
 * Obtiene la instancia singleton del cliente Redis
 * 
 * Inicializa la conexión la primera vez que se llama y reutiliza
 * la misma instancia en llamadas posteriores. Esto evita crear
 * múltiples conexiones innecesarias a Redis.
 * 
 * @returns {Redis} Instancia del cliente Redis configurado
 */
export function getRedis() {
  if (!client) {
    // Inicializa el cliente Redis con la URL configurada o localhost por defecto
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return client;
}
