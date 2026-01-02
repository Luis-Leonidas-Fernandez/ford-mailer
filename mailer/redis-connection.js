// mailer/redis-connection.js
/**
 * Convierte una URL de Redis en un objeto de conexión para BullMQ (ioredis).
 *
 * Soporta:
 * - redis://localhost:6379
 * - redis://password@host:6379
 * - redis://user:password@host:6379
 * - redis://host:6379/2  (db index)
 */
export function bullmqConnectionFromUrl(redisUrl) {
  if (!redisUrl) throw new Error('REDIS_URL no está definida');

  let url;
  try {
    url = new URL(redisUrl);
  } catch (e) {
    throw new Error(`REDIS_URL inválida: ${e.message}`);
  }

  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
  };

  // Password:
  // - redis://:pass@host:6379  -> url.password
  // - redis://pass@host:6379   -> url.username (password "en username")
  if (url.password) connection.password = url.password;
  else if (url.username && !url.username.includes(':')) connection.password = url.username;

  // DB index desde pathname: /0 /1 /2 ...
  if (url.pathname && url.pathname !== '/') {
    const dbIndex = Number(url.pathname.slice(1));
    if (!Number.isNaN(dbIndex)) connection.db = dbIndex;
  }

  return connection;
}
