/**
 * Utilidades para manejo de JWT
 */

import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

/**
 * Genera un token JWT
 * @param {Object} payload - Datos a incluir en el token
 * @returns {string} Token JWT
 */
export function generateToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
}

/**
 * Verifica y decodifica un token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object} Payload decodificado
 * @throws {Error} Si el token es inválido o expiró
 */
export function verifyToken(token) {
  return jwt.verify(token, jwtConfig.secret);
}

