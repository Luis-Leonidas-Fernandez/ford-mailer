/**
 * Exportación centralizada de errores y utilidades
 */

export { AppError } from './AppError.js';
export { ValidationError } from './ValidationError.js';
export {
  AuthError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from './AuthError.js';
export {
  DatabaseError,
  DuplicateKeyError,
  handleMongooseError,
} from './DatabaseError.js';
export { errorMessages } from './errorMessages.js';
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from './errorHandler.js';

