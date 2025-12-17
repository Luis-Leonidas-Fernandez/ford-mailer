# Guía de Configuración de Ngrok para WhatsApp Webhook

## ¿Qué es ngrok?

Ngrok es una herramienta que crea un túnel seguro desde internet hacia tu servidor local. Es necesario porque Meta/Facebook necesita poder acceder a tu webhook desde internet, pero tu servidor está corriendo en `localhost`.

## Instalación de ngrok

### Opción 1: Descarga directa (Recomendado)

1. Ve a https://ngrok.com/download
2. Descarga la versión para tu sistema operativo (macOS, Windows, Linux)
3. Descomprime el archivo
4. Mueve `ngrok` a una carpeta en tu PATH (ej: `/usr/local/bin` en macOS/Linux)

### Opción 2: Con Homebrew (macOS)

```bash
brew install ngrok/ngrok/ngrok
```

### Opción 3: Con npm (si prefieres)

```bash
npm install -g ngrok
```

## Configuración inicial

1. **Crea una cuenta gratuita en ngrok**: https://dashboard.ngrok.com/signup
2. **Obtén tu authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configura ngrok con tu token**:

```bash
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

## Uso básico

### 1. Inicia tu servidor API

```bash
# Si usas Docker
docker compose up -d api

# O si corres directamente
npm run dev
```

Tu API debería estar corriendo en el puerto configurado (por defecto `3001` según `API_PORT`).

### 2. Inicia ngrok apuntando a tu API

```bash
# Si tu API corre en puerto 3001
ngrok http 3001

# O si usas el puerto por defecto del docker-compose (3000)
ngrok http 3000
```

### 3. Copia la URL de ngrok

Ngrok te mostrará algo como:

```
Forwarding   https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:3001
```

**Copia la URL HTTPS** (la que empieza con `https://`).

## Configuración en Meta/Facebook

1. Ve a tu app de Meta: https://developers.facebook.com/apps
2. Selecciona tu app de WhatsApp Business
3. Ve a **WhatsApp > Configuration**
4. En la sección **Webhook**, haz clic en **Edit**
5. Ingresa:
   - **Callback URL**: `https://xxxx-xxxx-xxxx.ngrok-free.app/wa/webhook`
   - **Verify token**: El mismo valor que tienes en `WA_VERIFY_TOKEN` en tu `.env`
6. Haz clic en **Verify and Save**

Meta intentará verificar tu webhook. Si todo está bien, verás un check verde ✅.

## Variables de entorno necesarias

Asegúrate de tener en tu `.env`:

```env
WA_VERIFY_TOKEN=tu_token_secreto_aqui
API_PORT=3001  # O el puerto que uses
```

**Importante**: El `WA_VERIFY_TOKEN` debe ser el mismo que configuraste en Meta.

## Scripts útiles

### Script npm para iniciar ngrok automáticamente

Ya está agregado en `package.json`:

```bash
npm run ngrok
```

Este script:
1. Verifica que ngrok esté instalado
2. Inicia ngrok apuntando al puerto correcto
3. Muestra la URL que debes usar

### Ver logs del webhook

```bash
# Ver logs de la API
docker compose logs -f api

# O si corres directamente
npm run dev
```

Busca logs que empiecen con `[WA Webhook]` para ver los eventos.

## Solución de problemas

### Error: "ngrok: command not found"

- Asegúrate de que ngrok esté en tu PATH
- O usa la ruta completa: `/ruta/completa/a/ngrok http 3001`

### Error: "authtoken required"

```bash
ngrok config add-authtoken TU_AUTHTOKEN
```

### El webhook no se verifica

1. Verifica que tu servidor esté corriendo
2. Verifica que ngrok esté corriendo y apuntando al puerto correcto
3. Verifica que `WA_VERIFY_TOKEN` en `.env` coincida con el de Meta
4. Revisa los logs: `docker compose logs -f api`

### La URL de ngrok cambia cada vez

- **Plan gratuito**: La URL cambia cada vez que reinicias ngrok
- **Plan pago**: Puedes tener una URL fija (reserved domain)

Para desarrollo, esto está bien. Solo necesitas actualizar la URL en Meta cada vez que reinicies ngrok.

## Alternativas a ngrok

- **Cloudflare Tunnel** (gratis, URL fija)
- **localtunnel** (npm, gratis pero menos estable)
- **serveo.net** (gratis, sin instalación)

## Próximos pasos

Una vez configurado, podrás:
- ✅ Recibir statuses de mensajes (sent, delivered, read, failed)
- ✅ Recibir mensajes entrantes de usuarios
- ✅ Actualizar métricas de campañas en tiempo real

