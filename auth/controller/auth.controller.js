/**
 * Controlador de autenticación
 * Maneja las peticiones HTTP relacionadas con autenticación
 */

import * as authService from '../../src/service/auth.service.js';
import { asyncHandler } from '../../src/errors/errorHandler.js';

/**
 * Registra un nuevo usuario
 * POST /api/auth/register
 * La validación se hace en el middleware validateRegister
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  const user = await authService.registerUser(email, password, name);

  res.status(201).json({
    message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
    user,
  });
});

/**
 * Inicia sesión de un usuario
 * POST /api/auth/login
 * La validación se hace en el middleware validateLogin
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.loginUser(email, password);

  res.json({
    message: 'Login exitoso',
    ...result,
  });
});

/**
 * Verifica el email de un usuario
 * GET /api/auth/verify-email/:token
 * La validación se hace en el middleware validateVerifyEmail
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await authService.verifyEmail(token);

  res.json({
    message: 'Email verificado exitosamente',
    user,
  });
});

/**
 * Obtiene el usuario actual
 * GET /api/auth/me
 * Requiere autenticación (middleware)
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.userId);

  res.json({
    user,
  });
});

