# Checklist de Variables .env

## 🔴 OBLIGATORIAS (sin estas no funcionará la autenticación)

Verifica que tengas estas variables en tu `.env`:

- [ ] `MONGODB_URI` - Conexión a MongoDB
  - Ejemplo: `mongodb://localhost:27017/ford-mailer`
  - O para Atlas: `mongodb+srv://usuario:password@cluster.mongodb.net/ford-mailer`

- [ ] `JWT_SECRET` - Secret key para tokens JWT
  - Debe ser una cadena aleatoria segura de al menos 32 caracteres
  - Ejemplo: `my-super-secret-jwt-key-minimum-32-characters-long`

## 🟡 RECOMENDADAS (tienen valores por defecto, pero es mejor configurarlas)

- [ ] `JWT_EXPIRES_IN` - Expiración de tokens (default: `24h`)
- [ ] `API_PORT` - Puerto del servidor (default: `3001`)
- [ ] `NODE_ENV` - Entorno (default: `development`)
- [ ] `FRONTEND_URL` - URL del frontend para links de verificación (default: `http://localhost:3000`)
- [ ] `REDIS_URL` - URL de Redis para rate limiting (default: `redis://localhost:6379`)

## 🟢 OPCIONALES (solo si usas esas funcionalidades)

### Email/Mailer
- [ ] `EMAIL_PROVIDER` - 'resend' o 'gmail' (default: 'resend')
- [ ] `RESEND_API_KEY` - API key de Resend
- [ ] `RESEND_FROM` - Email remitente
- [ ] `TEST_TO` - Email de prueba
- [ ] `MAILER_DRY_RUN` - Modo dry-run (true/false)
- [ ] `MAILER_TIMEZONE_DEFAULT` - Zona horaria (default: 'UTC')
- [ ] `MAILER_RATE_LIMIT_MAX_RPS` - Emails por segundo (default: 5)
- [ ] `MAILER_XLSX_PATH` - Ruta del archivo Excel
- [ ] `UNSUB_HTTP_URL` - URL de desuscripción

### Gmail (solo si usas Gmail)
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_REFRESH_TOKEN`
- [ ] `GMAIL_FROM`

### WhatsApp (solo si usas WhatsApp)
- [ ] `WA_PHONE_NUMBER_ID` - ID del número de teléfono de WhatsApp Business
- [ ] `WA_ACCESS_TOKEN` - Token de acceso de WhatsApp Business API
- [ ] `WA_VERIFY_TOKEN` - Token de verificación para webhooks
- [ ] `PORT` - Puerto del webhook (default: 3000)
- [ ] `WHATSAPP_RATE_LIMIT_MAX_RPS` - Mensajes por segundo (default: 2)
- [ ] `WHATSAPP_TEMPLATE_NAME` - Nombre de la plantilla aprobada (default: `promo_ford_mes`)
- [ ] `WHATSAPP_LANGUAGE_CODE` - Código de idioma de la plantilla (default: `es_AR`)
- [ ] `WHATSAPP_TEMPLATE_BODY_PARAMS_COUNT` - Cantidad de variables en el cuerpo de la plantilla (default: 2)
- [ ] `DEFAULT_PHONE_COUNTRY` - País por defecto para normalización de teléfonos (default: `AR`)

### IA (solo si usas el sistema de IA)
- [ ] `LLM_ENDPOINT` - Endpoint del modelo Qwen
- [ ] `RAG_ENDPOINT` - Endpoint del sistema RAG
- [ ] `RAG_API_KEY` - API key para RAG

## 📝 Cómo verificar

Ejecuta este comando en tu terminal:
```bash
npm run check:env
```

O revisa manualmente tu archivo `.env` y marca las casillas de arriba.

## ⚠️ Problemas comunes

1. **Variables con espacios**: Asegúrate de que no haya espacios alrededor del `=`
   - ❌ `JWT_SECRET = valor`
   - ✅ `JWT_SECRET=valor`

2. **Valores con espacios**: Si el valor tiene espacios, usa comillas
   - ✅ `RESEND_FROM="Cristian Sosa <no-reply@inricompany.com>"`

3. **Comentarios**: Los comentarios deben empezar con `#`
   - ✅ `# Esto es un comentario`

4. **Variables vacías**: Si una variable está vacía, puede causar problemas
   - ❌ `JWT_SECRET=`
   - ✅ `JWT_SECRET=tu-valor-aqui`

