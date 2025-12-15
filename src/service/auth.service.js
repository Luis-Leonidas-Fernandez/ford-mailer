/**
 * Servicio de autenticación
 * Contiene la lógica de negocio para registro, login y verificación de email
 */

import User from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.utils.js';
import { generateToken } from '../utils/jwt.utils.js';
import { sendReminder } from '../../mailer/index.js';
import { config } from '../../config.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import crypto from 'crypto';
import {
  DuplicateKeyError,
  AuthError,
  NotFoundError,
  handleMongooseError,
  errorMessages,
} from '../errors/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carga y renderiza la plantilla de verificación de email
 */
async function loadVerificationTemplate() {
  const templatePath = path.join(__dirname, '../../auth/templates/verification.html.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  return Handlebars.compile(templateContent);
}

/**
 * Registra un nuevo usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Password en texto plano
 * @param {string} name - Nombre del usuario (opcional)
 * @returns {Promise<Object>} Usuario creado
 */
export async function registerUser(email, password, name) {
  try {
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new DuplicateKeyError(errorMessages.DATABASE.DUPLICATE_EMAIL, 'email');
    }

    // Hashear password
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const user = new User({
      email,
      password: hashedPassword,
      name,
      emailVerified: false,
    });

    // Generar token de verificación
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Enviar email de verificación
    try {
      const template = await loadVerificationTemplate();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationUrl = `${frontendUrl}/api/auth/verify-email/${verificationToken}`;

      const html = template({
        name: name || email,
        verificationUrl,
        brandTitle: 'Ford Mailer',
        brandSubtitle: 'Sistema de Comunicación',
      });

      await sendReminder({
        to: email,
        subject: 'Verifica tu email - Ford Mailer',
        html,
        text: `Por favor verifica tu email haciendo clic en el siguiente enlace: ${verificationUrl}`,
      });
    } catch (error) {
      console.error('[Auth Service] Error enviando email de verificación:', error);
      // No lanzar error, el usuario ya está creado
    }

    // Retornar usuario sin datos sensibles
    return user.toJSON();
  } catch (error) {
    // Si es un error de Mongoose, convertirlo
    if (error.name === 'ValidationError' || error.code === 11000) {
      throw handleMongooseError(error);
    }
    // Si ya es un error personalizado, re-lanzarlo
    if (error instanceof DuplicateKeyError || error instanceof AuthError) {
      throw error;
    }
    // Error inesperado
    throw error;
  }
}

/**
 * Inicia sesión de un usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Password en texto plano
 * @returns {Promise<Object>} Objeto con token y usuario
 */
export async function loginUser(email, password) {
  // Buscar usuario incluyendo password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AuthError(errorMessages.AUTH.INVALID_CREDENTIALS);
  }

  // Verificar password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AuthError(errorMessages.AUTH.INVALID_CREDENTIALS);
  }

  // Verificar que el email esté verificado
  if (!user.emailVerified) {
    throw new AuthError(errorMessages.AUTH.EMAIL_NOT_VERIFIED);
  }

  // Generar JWT
  const token = generateToken({ userId: user._id.toString(), email: user.email });

  // Retornar token y usuario
  return {
    token,
    user: user.toJSON(),
  };
}

/**
 * Verifica el email de un usuario usando un token
 * @param {string} token - Token de verificación
 * @returns {Promise<Object>} Usuario actualizado
 */
export async function verifyEmail(token) {
  // Hashear el token para comparar
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Buscar usuario con el token válido y no expirado
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AuthError(errorMessages.VALIDATION.TOKEN_INVALID);
  }

  // Actualizar usuario
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return user.toJSON();
}

/**
 * Obtiene un usuario por ID
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Usuario
 */
export async function getUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(errorMessages.DATABASE.USER_NOT_FOUND);
  }
  return user.toJSON();
}

