/**
 * Configuración de conexión a MongoDB
 */

import 'dotenv/config';

export const databaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ford-mailer',
  options: {
    // Opciones de conexión recomendadas para Mongoose 8.x
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};

