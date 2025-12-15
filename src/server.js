/**
 * Servidor principal
 * Inicia la conexión a MongoDB y el servidor Express
 */

import app from './app.js';
import mongoose from 'mongoose';
import { databaseConfig } from './config/database.js';
import 'dotenv/config';

const PORT = Number(process.env.API_PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Conecta a MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(databaseConfig.uri, databaseConfig.options);
    console.log('[MongoDB] Conectado exitosamente');
    
    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Error de conexión:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Desconectado');
    });
  } catch (error) {
    console.error('[MongoDB] Error de conexión:', error);
    process.exit(1);
  }
}

/**
 * Inicializa el servidor
 */
async function startServer() {
  try {
    // Conectar a MongoDB primero
    await connectDB();
    
    // Luego iniciar servidor Express
    app.listen(PORT, () => {
      console.log(`[Server] Iniciado en puerto ${PORT}`);
      console.log(`[Server] Entorno: ${NODE_ENV}`);
      console.log(`[Server] Estado disponible en: http://localhost:${PORT}`);
      console.log(`[Server] API Status: http://localhost:${PORT}/api/status`);
      console.log(`[Server] Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Server] Error al iniciar:', error);
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM recibido, cerrando servidor...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT recibido, cerrando servidor...');
  await mongoose.connection.close();
  process.exit(0);
});

// Iniciar servidor
startServer();

