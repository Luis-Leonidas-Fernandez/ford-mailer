/**
 * Sistema de reintentos con backoff exponencial para WhatsApp
 * 
 * Este módulo proporciona funcionalidades robustas de reintento para llamadas
 * a APIs externas que pueden fallar temporalmente. Incluye:
 * - Backoff exponencial con jitter para evitar thundering herd
 * - Detección inteligente de errores recuperables vs no recuperables
 * - Configuración flexible de reintentos, delays y callbacks
 * - Soporte para timeouts y errores de red
 * 
 * Es especialmente útil para:
 * - Llamadas a WhatsApp Business API
 * - Consultas a sistemas RAG externos
 * - Comunicación con modelos de IA
 * - Cualquier operación de red que pueda fallar temporalmente
 * 
 * Funciones principales:
 * - retry: Ejecuta una función con reintentos automáticos
 * - isRetryableError: Determina si un error es recuperable
 * - sleep: Utilidad para pausas asíncronas
 */

// src/utils/retry.js

/**
 * Función utilitaria para pausas asíncronas
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>} Promesa que se resuelve después del tiempo especificado
 */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Determina si un error es recuperable y vale la pena reintentarlo
 * @param {Error} err - Error a evaluar
 * @returns {boolean} true si el error es recuperable, false si es definitivo
 */
function isRetryableError(err) {
  const status = err?.response?.status;
  
  // Errores HTTP recuperables
  if (status === 429 || status === 408 || status === 425) return true;  // Rate limit, timeout, too early
  if (status >= 500 && status <= 599) return true;                      // Errores de servidor
  
  // Errores de red recuperables
  const code = err?.code;
  const retryable = new Set([
    'ECONNRESET',    // Conexión reiniciada por el peer
    'ETIMEDOUT',     // Timeout de conexión
    'EHOSTUNREACH',  // Host inalcanzable
    'ENETUNREACH',   // Red inalcanzable
    'EAI_AGAIN',     // DNS temporal failure
    'ECONNABORTED',  // Conexión abortada
    'ENOTFOUND'      // DNS no encontrado (puede ser temporal)
  ]);
  if (retryable.has(code)) return true;
  
  // Errores de timeout en mensaje de error
  if (err?.message?.toLowerCase?.().includes('timeout')) return true;
  
  return false;
}

/**
 * Reintenta una función asíncrona con backoff exponencial y jitter
 * @param {Function} fn - Función asíncrona a ejecutar
 * @param {Object} [opts={}] - Opciones de configuración
 * @param {number} [opts.retries=3] - Número máximo de reintentos
 * @param {number} [opts.minDelay=200] - Delay mínimo en ms
 * @param {number} [opts.maxDelay=3000] - Delay máximo en ms
 * @param {number} [opts.factor=2] - Factor de multiplicación para backoff exponencial
 * @param {number} [opts.jitter=0.25] - Factor de jitter (0-1) para aleatorización
 * @param {Function} [opts.onRetry] - Callback ejecutado en cada reintento
 * @returns {Promise<any>} Resultado de la función exitosa
 * @throws {Error} El último error si todos los reintentos fallan
 */
export async function retry(fn, opts = {}) {
  // Extrae configuración con valores por defecto
  const {
    retries = 3,            // Número máximo de reintentos
    minDelay = 200,         // Delay inicial en milisegundos
    maxDelay = 3000,        // Delay máximo en milisegundos
    factor = 2,             // Factor de multiplicación para backoff exponencial
    jitter = 0.25,          // Factor de jitter para aleatorización (0-1)
    onRetry = () => {},     // Callback opcional para logging/debugging
  } = opts;

  let attempt = 0;
  let delay = minDelay;

  // Bucle principal: primer intento + reintentos
  while (true) {
    try {
      // Intenta ejecutar la función
      return await fn();
    } catch (err) {
      // Si se agotaron los reintentos o el error no es recuperable, lanza el error
      if (attempt >= retries || !isRetryableError(err)) {
        throw err;
      }
      
      // Calcula el delay con jitter para evitar thundering herd
      const jitterMs = delay * jitter * Math.random();
      const waitMs = Math.min(delay + jitterMs, maxDelay);
      
      // Ejecuta callback de reintento si se proporcionó
      onRetry(err, attempt + 1, Math.round(waitMs));
      
      // Espera antes del próximo intento
      await sleep(waitMs);
      
      // Incrementa el delay para el próximo intento (backoff exponencial)
      delay = Math.min(delay * factor, maxDelay);
      attempt += 1;
    }
  }
}
