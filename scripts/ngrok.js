#!/usr/bin/env node

/**
 * Script para iniciar ngrok automáticamente
 * 
 * Uso: npm run ngrok
 * 
 * Este script:
 * 1. Verifica que ngrok esté instalado
 * 2. Obtiene el puerto de API_PORT o usa 3001 por defecto
 * 3. Inicia ngrok apuntando a ese puerto
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Obtener el puerto desde .env o usar default
const API_PORT = process.env.API_PORT || '3001';

console.log('[Ngrok] ========================================');
console.log('[Ngrok] Iniciando túnel ngrok...');
console.log('[Ngrok] Puerto local:', API_PORT);
console.log('[Ngrok] ========================================');
console.log('');

// Verificar que ngrok esté instalado
try {
  execSync('ngrok version', { stdio: 'ignore' });
} catch (error) {
  console.error('[Ngrok] ❌ ERROR: ngrok no está instalado');
  console.error('');
  console.error('Instalación:');
  console.error('  1. Descarga desde: https://ngrok.com/download');
  console.error('  2. O con Homebrew: brew install ngrok/ngrok/ngrok');
  console.error('  3. O con npm: npm install -g ngrok');
  console.error('');
  console.error('Luego configura tu authtoken:');
  console.error('  ngrok config add-authtoken TU_AUTHTOKEN');
  console.error('');
  process.exit(1);
}

// Verificar que WA_VERIFY_TOKEN esté configurado
if (!process.env.WA_VERIFY_TOKEN) {
  console.warn('[Ngrok] ⚠️  ADVERTENCIA: WA_VERIFY_TOKEN no está configurado en .env');
  console.warn('[Ngrok] El webhook no funcionará sin este token');
  console.warn('');
}

console.log('[Ngrok] ✅ ngrok está instalado');
console.log('[Ngrok] Iniciando túnel...');
console.log('');
console.log('[Ngrok] 📋 IMPORTANTE:');
console.log('[Ngrok] 1. Copia la URL HTTPS que ngrok te muestre');
console.log('[Ngrok] 2. Ve a Meta Developer Console');
console.log('[Ngrok] 3. Configura el webhook con: https://xxxx.ngrok-free.app/wa/webhook');
console.log('[Ngrok] 4. Usa el mismo WA_VERIFY_TOKEN que tienes en .env');
console.log('');
console.log('[Ngrok] Presiona Ctrl+C para detener ngrok');
console.log('');

// Iniciar ngrok
try {
  execSync(`ngrok http ${API_PORT}`, { stdio: 'inherit' });
} catch (error) {
  // Ctrl+C es normal, no mostrar error
  if (error.signal !== 'SIGINT') {
    console.error('[Ngrok] Error al iniciar ngrok:', error.message);
    process.exit(1);
  }
}

