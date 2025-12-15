/**
 * Middleware centralizado para manejo de errores
 */

import { AppError } from './AppError.js';
import { handleMongooseError } from './DatabaseError.js';
import { ValidationError } from './ValidationError.js';

/**
 * Middleware de manejo de errores de Express
 * Debe ser el último middleware en la cadena
 */
export function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;

  // Log del error para debugging
  console.error('[Error Handler]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Error de Mongoose - convertir a error personalizado
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
    error = handleMongooseError(err);
  }

  // Error de express-validator (ya manejado por handleValidationErrors)
  // No necesitamos procesarlo aquí

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token inválido', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expirado', 401);
  }

  // Si es un AppError, usar sus propiedades
  if (err instanceof AppError) {
    error = err;
  }

  // Si no es un error operacional, no exponer detalles
  const statusCode = error.statusCode || 500;
  const message = error.isOperational !== false 
    ? error.message 
    : 'Error interno del servidor';

  // Respuesta de error
  const response = {
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Agregar errores de validación si existen
  if (error instanceof ValidationError && error.errors) {
    response.errors = error.errors;
  }

  // Agregar stack trace solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = {
      name: err.name,
      path: req.path,
      method: req.method,
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Middleware para manejar rutas no encontradas (404)
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `La ruta ${req.method} ${req.path} no existe`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wrapper para manejar errores en funciones async
 * Evita tener que usar try-catch en cada controlador
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

