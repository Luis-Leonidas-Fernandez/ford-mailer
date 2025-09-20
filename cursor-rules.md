# Objetivo
Construir un módulo `mailer` en Node.js para enviar recordatorios por Gmail API.

# Stack
- Node.js 18+
- Librerías: googleapis, bullmq, handlebars, ioredis, pino

# Estructura
/mailer
  gmail.js
  mime.js
  templates.js
  worker.js
  queue.js
  index.js
/templates
  reminder.html.hbs
  reminder.txt.hbs

# Reglas
- Autenticación con Gmail API vía OAuth2 (clientId, clientSecret, refreshToken desde .env).
- Función `sendReminder({ to, subject, html, text })` que construya MIME multipart/alternative y lo envíe.
- Usar BullMQ con Redis para encolar y procesar emails (con reintentos y delays).
- Plantillas en Handlebars, soportar variables dinámicas.
- Logging con pino.
- Todo el código en ESM (import/export).


- Programación por zona horaria: `scheduleEmail({ sendAtLocal, tz, ... })` → convertir a UTC y encolar con `delay`.
- Idempotencia con Redis (SETNX por 48h) usando `idempotencyKey` para evitar duplicados.
- Rate limiting propio (p.ej. 5–10 msg/seg) para cuidar cuotas de Gmail.
- Reintentos exponenciales solo en errores transitorios (429/5xx); no reintentar 4xx de validación.
- Modo DRY-RUN habilitable por env para probar sin enviar (log del MIME).
- Logs estructurados (pino) con `jobId`, `to`, `templateId`, `attempt`, `messageId`.

