/**
 * Errores relacionados con la base de datos
 */

import { AppError } from './AppError.js';
import { ValidationError } from './ValidationError.js';

export class DatabaseError extends AppError {
  constructor(message = 'Error de base de datos', originalError = null) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class DuplicateKeyError extends DatabaseError {
  constructor(message = 'El recurso ya existe', field = null) {
    super(message);
    this.statusCode = 409;
    this.name = 'DuplicateKeyError';
    this.field = field;
  }
}

/**
 * Convierte errores de Mongoose a errores personalizados
 */
export function handleMongooseError(error) {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return new ValidationError('Error de validación de datos', messages);
  }

  if (error.name === 'CastError') {
    return new ValidationError(`Formato inválido para ${error.path}`);
  }

  if (error.code === 11000) {
    // Error de duplicado
    const field = Object.keys(error.keyPattern)[0];
    return new DuplicateKeyError(`El ${field} ya está en uso`, field);
  }

  if (error.name === 'MongoServerError') {
    return new DatabaseError('Error del servidor de base de datos', error);
  }

  return new DatabaseError('Error de base de datos', error);
}

