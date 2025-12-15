/**
 * Validadores para autenticación usando express-validator
 */

import { body, param, validationResult } from 'express-validator';

/**
 * Middleware para manejar errores de validación
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

/**
 * Validaciones para registro de usuario
 */
export const validateRegister = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es requerido')
    .isEmail()
    .withMessage('Por favor ingresa un email válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('El email no puede exceder 255 caracteres'),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ min: 6, max: 128 })
    .withMessage('La contraseña debe tener entre 6 y 128 caracteres'),

  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),

  handleValidationErrors,
];

/**
 * Validaciones para login
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es requerido')
    .isEmail()
    .withMessage('Por favor ingresa un email válido')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ min: 1, max: 128 })
    .withMessage('La contraseña no puede estar vacía'),

  handleValidationErrors,
];

/**
 * Validaciones para verificación de email
 */
export const validateVerifyEmail = [
  param('token')
    .notEmpty()
    .withMessage('El token de verificación es requerido')
    .isLength({ min: 32, max: 64 })
    .withMessage('El token de verificación tiene un formato inválido')
    .matches(/^[a-f0-9]+$/)
    .withMessage('El token de verificación tiene un formato inválido'),

  handleValidationErrors,
];

