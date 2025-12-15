/**
 * Mensajes de error centralizados
 * Facilita la internacionalización y mantenimiento
 */

export const errorMessages = {
  // Errores de autenticación
  AUTH: {
    INVALID_CREDENTIALS: 'Credenciales inválidas',
    EMAIL_NOT_VERIFIED: 'Por favor verifica tu email antes de iniciar sesión',
    TOKEN_REQUIRED: 'Token de autenticación requerido',
    TOKEN_INVALID: 'Token inválido',
    TOKEN_EXPIRED: 'Token expirado',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso prohibido',
  },

  // Errores de validación
  VALIDATION: {
    REQUIRED: (field) => `${field} es requerido`,
    INVALID_EMAIL: 'Por favor ingresa un email válido',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 6 caracteres',
    PASSWORD_TOO_LONG: 'La contraseña no puede exceder 128 caracteres',
    NAME_INVALID: 'El nombre solo puede contener letras y espacios',
    NAME_TOO_SHORT: 'El nombre debe tener al menos 2 caracteres',
    NAME_TOO_LONG: 'El nombre no puede exceder 100 caracteres',
    TOKEN_INVALID: 'Token de verificación inválido o expirado',
  },

  // Errores de base de datos
  DATABASE: {
    CONNECTION_FAILED: 'Error al conectar con la base de datos',
    QUERY_FAILED: 'Error al ejecutar consulta',
    DUPLICATE_EMAIL: 'El email ya está registrado',
    USER_NOT_FOUND: 'Usuario no encontrado',
  },

  // Errores generales
  GENERAL: {
    INTERNAL_ERROR: 'Error interno del servidor',
    NOT_FOUND: 'Recurso no encontrado',
    BAD_REQUEST: 'Solicitud inválida',
  },
};

