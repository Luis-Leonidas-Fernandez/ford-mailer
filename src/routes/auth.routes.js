/**
 * Rutas de autenticación
 */

import express from 'express';
import * as authController from '../../auth/controller/auth.controller.js';
import { authenticate } from '../../auth/middleware/auth.middleware.js';
import {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
} from '../validators/auth.validators.js';
import { combinedRateLimit } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Rutas públicas con validación y rate limiting (solo login y registro)
router.post('/register', ...combinedRateLimit(), validateRegister, authController.register);
router.post('/login', ...combinedRateLimit(), validateLogin, authController.login);
router.get('/verify-email/:token', validateVerifyEmail, authController.verifyEmail);

// Rutas protegidas (requieren autenticación)
router.get('/me', authenticate, authController.getMe);

export default router;

