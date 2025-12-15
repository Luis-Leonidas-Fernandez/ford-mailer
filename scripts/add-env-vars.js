/**
 * Script para agregar variables de entorno necesarias al archivo .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// Variables a agregar (solo si no existen)
const newVariables = `
# =============================================================================
# MONGODB - BASE DE DATOS
# =============================================================================

# URL de conexión a MongoDB
# Formato local: mongodb://localhost:27017/ford-mailer
# Formato Atlas: mongodb+srv://usuario:password@cluster.mongodb.net/ford-mailer?retryWrites=true&w=majority
# Formato con auth: mongodb://usuario:password@localhost:27017/ford-mailer?authSource=admin
MONGODB_URI=mongodb://localhost:27017/ford-mailer

# =============================================================================
# JWT - AUTENTICACIÓN
# =============================================================================

# Secret key para firmar tokens JWT (¡CAMBIA ESTO EN PRODUCCIÓN!)
JWT_SECRET=your-secret-key-change-in-production-minimum-32-characters

# Tiempo de expiración del token JWT
JWT_EXPIRES_IN=24h

# =============================================================================
# CONFIGURACIÓN DEL SERVIDOR
# =============================================================================

# Entorno de ejecución (development, production, staging)
NODE_ENV=development

# Puerto del servidor API
API_PORT=3001

# URL del frontend (para links en emails de verificación)
FRONTEND_URL=http://localhost:3000
`;

try {
  let envContent = '';
  
  // Leer archivo .env si existe
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Verificar qué variables ya existen
  const existingVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'NODE_ENV',
    'API_PORT',
    'FRONTEND_URL',
  ];

  const missingVars = existingVars.filter(varName => {
    const regex = new RegExp(`^${varName}=`, 'm');
    return !regex.test(envContent);
  });

  if (missingVars.length === 0) {
    console.log('✅ Todas las variables necesarias ya existen en .env');
    process.exit(0);
  }

  // Agregar nuevas variables
  const separator = envContent.trim().endsWith('\n') ? '' : '\n';
  fs.appendFileSync(envPath, separator + newVariables, 'utf8');
  
  console.log('✅ Variables agregadas al archivo .env:');
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log('\n📝 Por favor completa los valores en tu archivo .env');
  
} catch (error) {
  console.error('❌ Error al agregar variables:', error.message);
  process.exit(1);
}

