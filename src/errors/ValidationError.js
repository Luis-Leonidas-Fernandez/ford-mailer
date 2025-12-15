/**
 * Error de validación
 * Se lanza cuando los datos de entrada no cumplen con las validaciones
 */

import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  constructor(message = 'Error de validación', errors = []) {
    super(message, 400);
    this.errors = errors; // Array de errores de validación específicos
    this.name = 'ValidationError';
  }
}

