/**
 * Errores de autenticación y autorización
 */

import { AppError } from './AppError.js';

export class AuthError extends AppError {
  constructor(message = 'Error de autenticación', statusCode = 401) {
    super(message, statusCode);
    this.name = 'AuthError';
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'No autorizado') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'Acceso prohibido') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

