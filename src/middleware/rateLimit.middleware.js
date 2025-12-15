/**
 * Middleware de rate limiting personalizado
 * Rate limiting por IP y por usuario (email) para autenticación
 */

import rateLimit from 'express-rate-limit';
import { getRedis } from '../../whatsapp/src/utils/redis.js';

/**
 * Rate limiting por IP para login y registro
 * Más estricto que el rate limiting general
 */
export const rateLimitByIP = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP cada 15 minutos
  message: {
    error: 'Demasiados intentos desde esta IP. Por favor intenta más tarde.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos (200/201)
  skipFailedRequests: false, // Contar requests fallidos
});

/**
 * Rate limiting por email/usuario usando Redis
 * Previene ataques de fuerza bruta por email específico
 */
export async function rateLimitByEmail(req, res, next) {
  try {
    const { email } = req.body;

    // Si no hay email en el body, saltar este middleware
    if (!email) {
      return next();
    }

    const redis = getRedis();
    const emailNormalized = email.toLowerCase().trim();
    const key = `rate_limit:auth:${emailNormalized}`;
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxAttempts = 3; // máximo 3 intentos por email cada 15 minutos

    // Obtener intentos actuales
    const attempts = await redis.get(key);
    const currentAttempts = attempts ? parseInt(attempts, 10) : 0;

    // Si excedió el límite
    if (currentAttempts >= maxAttempts) {
      const ttl = await redis.ttl(key);
      const minutesLeft = Math.ceil(ttl / 60) || 15;

      return res.status(429).json({
        error: 'Demasiados intentos para este email. Por favor intenta más tarde.',
        retryAfter: `${minutesLeft} minutos`,
        message: `Has excedido el límite de ${maxAttempts} intentos. Intenta nuevamente en ${minutesLeft} minuto(s).`,
      });
    }

    // Incrementar contador
    if (currentAttempts === 0) {
      // Primera vez, establecer con TTL
      await redis.setex(key, Math.ceil(windowMs / 1000), '1');
    } else {
      // Incrementar contador existente
      await redis.incr(key);
    }

    // Agregar información al request para resetear en caso de éxito
    req.rateLimitKey = key;
    req.rateLimitEmail = emailNormalized;

    next();
  } catch (error) {
    // Si hay error con Redis, loguear pero continuar (no bloquear)
    console.error('[Rate Limit] Error con Redis:', error);
    next();
  }
}

/**
 * Middleware para resetear contador de rate limit en respuestas exitosas
 * Se ejecuta después de que el controlador responde exitosamente
 */
export function resetRateLimitOnSuccess(req, res, next) {
  // Interceptar cuando la respuesta se envía
  const originalEnd = res.end.bind(res);
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Sobrescribir res.json
  res.json = function (data) {
    // Verificar si la respuesta será exitosa
    const statusCode = res.statusCode || 200;
    if ((statusCode === 200 || statusCode === 201) && req.rateLimitKey) {
      // Resetear de forma asíncrona sin bloquear la respuesta
      resetEmailRateLimit(req.rateLimitKey).catch((err) => {
        console.error('[Rate Limit] Error reseteando contador:', err);
      });
    }
    return originalJson(data);
  };

  // Sobrescribir res.send
  res.send = function (data) {
    const statusCode = res.statusCode || 200;
    if ((statusCode === 200 || statusCode === 201) && req.rateLimitKey) {
      resetEmailRateLimit(req.rateLimitKey).catch((err) => {
        console.error('[Rate Limit] Error reseteando contador:', err);
      });
    }
    return originalSend(data);
  };

  // También interceptar cuando la respuesta termina
  res.on('finish', () => {
    const statusCode = res.statusCode;
    if ((statusCode === 200 || statusCode === 201) && req.rateLimitKey) {
      resetEmailRateLimit(req.rateLimitKey).catch((err) => {
        console.error('[Rate Limit] Error reseteando contador:', err);
      });
    }
  });

  next();
}

/**
 * Resetea el contador de rate limit para un email específico
 */
async function resetEmailRateLimit(key) {
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch (error) {
    console.error('[Rate Limit] Error reseteando contador:', error);
  }
}

/**
 * Rate limiting combinado: IP + Email
 * Aplica ambos rate limiters a login y registro
 */
export function combinedRateLimit() {
  return [
    rateLimitByIP, // Primero rate limit por IP
    rateLimitByEmail, // Luego rate limit por email
    resetRateLimitOnSuccess, // Resetear en éxito
  ];
}

