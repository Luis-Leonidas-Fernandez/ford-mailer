/**
 * Script para verificar que todas las variables necesarias estén en .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

// Variables obligatorias para autenticación
const requiredVars = {
  'MONGODB_URI': 'Conexión a MongoDB',
  'JWT_SECRET': 'Secret key para JWT',
};

// Variables recomendadas
const recommendedVars = {
  'JWT_EXPIRES_IN': 'Expiración de tokens JWT',
  'API_PORT': 'Puerto del servidor',
  'NODE_ENV': 'Entorno de ejecución',
  'FRONTEND_URL': 'URL del frontend para verificación',
  'REDIS_URL': 'URL de Redis (para rate limiting)',
};

// Variables opcionales (según funcionalidades)
const optionalVars = {
  'EMAIL_PROVIDER': 'Proveedor de email',
  'RESEND_API_KEY': 'API key de Resend',
  'RESEND_FROM': 'Email remitente Resend',
  'TEST_TO': 'Email de prueba',
  'MAILER_DRY_RUN': 'Modo dry-run para mailer',
  'WA_PHONE_NUMBER_ID': 'ID de WhatsApp Business',
  'WA_ACCESS_TOKEN': 'Token de WhatsApp',
  'WA_VERIFY_TOKEN': 'Token de verificación WhatsApp',
  'LLM_ENDPOINT': 'Endpoint del modelo Qwen',
  'RAG_ENDPOINT': 'Endpoint del sistema RAG',
  'RAG_API_KEY': 'API key para RAG',
};

try {
  if (!fs.existsSync(envPath)) {
    console.error('❌ El archivo .env no existe');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  // Extraer variables definidas (ignorar comentarios y líneas vacías)
  const definedVars = new Set();
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) {
        definedVars.add(match[1]);
      }
    }
  });

  console.log('📋 Verificación de variables en .env\n');
  console.log('='.repeat(60));

  // Verificar variables obligatorias
  console.log('\n🔴 OBLIGATORIAS (sin estas no funcionará la autenticación):');
  let missingRequired = [];
  Object.keys(requiredVars).forEach(varName => {
    if (definedVars.has(varName)) {
      console.log(`  ✅ ${varName} - ${requiredVars[varName]}`);
    } else {
      console.log(`  ❌ ${varName} - ${requiredVars[varName]} - FALTA`);
      missingRequired.push(varName);
    }
  });

  // Verificar variables recomendadas
  console.log('\n🟡 RECOMENDADAS (tienen valores por defecto, pero es mejor configurarlas):');
  let missingRecommended = [];
  Object.keys(recommendedVars).forEach(varName => {
    if (definedVars.has(varName)) {
      console.log(`  ✅ ${varName} - ${recommendedVars[varName]}`);
    } else {
      console.log(`  ⚠️  ${varName} - ${recommendedVars[varName]} - No configurada (tiene default)`);
      missingRecommended.push(varName);
    }
  });

  // Mostrar variables opcionales configuradas
  console.log('\n🟢 OPCIONALES (solo si usas esas funcionalidades):');
  let configuredOptional = [];
  Object.keys(optionalVars).forEach(varName => {
    if (definedVars.has(varName)) {
      console.log(`  ✅ ${varName} - ${optionalVars[varName]}`);
      configuredOptional.push(varName);
    }
  });

  if (configuredOptional.length === 0) {
    console.log('  (Ninguna configurada - está bien si no las necesitas)');
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMEN:');
  console.log(`  Total de variables definidas: ${definedVars.size}`);
  console.log(`  Obligatorias configuradas: ${Object.keys(requiredVars).length - missingRequired.length}/${Object.keys(requiredVars).length}`);
  console.log(`  Recomendadas configuradas: ${Object.keys(recommendedVars).length - missingRecommended.length}/${Object.keys(recommendedVars).length}`);
  console.log(`  Opcionales configuradas: ${configuredOptional.length}`);

  if (missingRequired.length > 0) {
    console.log('\n❌ PROBLEMAS ENCONTRADOS:');
    console.log('   Faltan variables obligatorias. Agrega estas variables:');
    missingRequired.forEach(v => {
      console.log(`   - ${v}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ Tu .env está bien configurado para autenticación!');
    if (missingRecommended.length > 0) {
      console.log('\n💡 RECOMENDACIONES:');
      console.log('   Considera agregar estas variables recomendadas:');
      missingRecommended.forEach(v => {
        console.log(`   - ${v}`);
      });
    }
    process.exit(0);
  }

} catch (error) {
  console.error('❌ Error al verificar .env:', error.message);
  process.exit(1);
}

