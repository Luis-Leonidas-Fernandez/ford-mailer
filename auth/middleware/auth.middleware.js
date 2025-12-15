/**
 * Middleware de autenticación JWT
 */

import { verifyToken } from '../../src/utils/jwt.utils.js';
import { UnauthorizedError, errorMessages } from '../../src/errors/index.js';

/**
 * Middleware para verificar JWT y agregar usuario a req.user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export function authenticate(req, res, next) {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError(errorMessages.AUTH.TOKEN_REQUIRED));
    }

    // Extraer token
    const token = authHeader.substring(7); // Remover "Bearer "

    // Verificar token
    const decoded = verifyToken(token);

    // Agregar información del usuario al request
    req.user = decoded;

    next();
  } catch (error) {
    // Los errores de JWT serán manejados por el errorHandler
    next(error);
  }
}

