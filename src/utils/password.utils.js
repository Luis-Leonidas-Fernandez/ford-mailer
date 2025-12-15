/**
 * Utilidades para manejo de passwords
 */

import bcrypt from 'bcryptjs';

/**
 * Hashea un password usando bcrypt
 * @param {string} password - Password en texto plano
 * @returns {Promise<string>} Password hasheado
 */
export async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compara un password en texto plano con un hash
 * @param {string} password - Password en texto plano
 * @param {string} hash - Password hasheado
 * @returns {Promise<boolean>} true si coinciden
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

