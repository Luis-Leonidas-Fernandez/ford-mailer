# Ford Mailer - Sistema Integral de Comunicación

Un sistema completo de envío de emails y chatbot de WhatsApp con IA para concesionarios Ford. Combina un potente sistema de email marketing con un asistente inteligente basado en RAG (Retrieval-Augmented Generation).

## 🚀 Características Principales

### Sistema de Email Marketing
- **Campañas masivas** con rate limiting configurable
- **Múltiples proveedores** (Resend, Gmail API)
- **Sistema de colas** robusto con BullMQ y Redis
- **Plantillas profesionales** con Handlebars
- **Modo dry-run** para pruebas seguras
- **Reintentos automáticos** con backoff exponencial

### Chatbot de WhatsApp con IA
- **Integración con WhatsApp Business API**
- **IA conversacional** con modelo Qwen
- **Sistema RAG** para respuestas contextuales
- **Procesamiento idempotente** de mensajes
- **Reintentos automáticos** para APIs externas

## 📁 Estructura del Proyecto

```
FORD-MAILER/
├── config.js                          # Configuración principal del sistema
├── send-test.js                       # Script de prueba rápida
├── package.json                       # Dependencias y scripts NPM
├── data/
│   └── clientes.xlsx                  # Archivo de ejemplo con contactos
├── mailer/                            # Sistema de email marketing
│   ├── index.js                       # Punto de entrada principal
│   ├── gmail.js                       # Proveedor Gmail con OAuth2
│   ├── mime.js                        # Generador de mensajes MIME
│   ├── queue.js                       # Sistema de colas BullMQ
│   ├── worker.js                      # Worker para procesamiento asíncrono
│   ├── templates.js                   # Sistema de plantillas Handlebars
│   ├── providers/
│   │   ├── factory.js                 # Factory de proveedores de email
│   │   └── resend.js                  # Proveedor Resend
│   ├── campaign/
│   │   ├── core.js                    # Motor principal de campañas
│   │   └── loaders/
│   │       ├── array.js               # Cargador desde arrays
│   │       └── xlsx.js                # Cargador desde archivos Excel
│   ├── examples/                      # Ejemplos de uso
│   │   ├── enqueue-campaing.js        # Campaña desde array
│   │   ├── enqueue-from-xlsx.js       # Campaña desde Excel
│   │   ├── enqueue-later.js           # Envío programado
│   │   ├── enqueue-now.js             # Envío inmediato
│   │   ├── enqueue.js                 # Campaña manual avanzada
│   │   └── send-fancy.js              # Envío directo con plantillas
│   └── templates/
│       ├── reminder.html.hbs          # Plantilla HTML de recordatorios
│       ├── reminder.txt.hbs           # Plantilla texto de recordatorios
│       ├── promo.html.hbs             # Plantilla HTML promocional
│       └── promo.txt.hbs              # Plantilla texto promocional
└── whatsapp/                          # Sistema de WhatsApp con IA
    └── src/
        ├── orchestrator.js            # Coordinador principal IA + RAG
        ├── webhook.js                 # Servidor webhook de WhatsApp
        ├── providers/
        │   ├── whatsapp.js            # Cliente WhatsApp Business API
        │   ├── qwen.js                # Cliente modelo Qwen IA
        │   └── rag.js                 # Cliente sistema RAG
        └── utils/
            ├── idempotency.js         # Utilidades de idempotencia
            ├── redis.js               # Cliente Redis singleton
            └── retry.js               # Sistema de reintentos robusto
```

## 📋 Descripción Detallada de Archivos

### Configuración Principal

#### `config.js`
Archivo de configuración central que maneja todas las variables de entorno y configuraciones del sistema:
- **Proveedores de email**: Configuración para Resend y Gmail
- **Redis**: URL de conexión para colas y cache
- **Rate limiting**: Límites de envío por segundo
- **Modo dry-run**: Para pruebas sin envío real
- **Timezone**: Configuración de zona horaria

#### `send-test.js`
Script de prueba rápida para verificar el funcionamiento del sistema:
- **Envío simple**: Email de prueba básico
- **Configuración mínima**: Solo requiere TEST_TO
- **Validación rápida**: Verifica proveedores y configuración

#### `package.json`
Define las dependencias del proyecto y scripts NPM disponibles:
- **Scripts de campaña**: Para ejecutar diferentes tipos de campañas
- **Scripts de WhatsApp**: Para iniciar el webhook
- **Scripts de desarrollo**: Worker, pruebas, linting
- **Dependencias principales**: Express, BullMQ, Handlebars, Resend, etc.

### Sistema de Email Marketing

#### `mailer/index.js`
Punto de entrada principal del sistema de emails:
- **Función sendReminder**: API principal para envío de emails
- **Modo dry-run**: Simulación de envíos para pruebas
- **Delegación a proveedores**: Utiliza el factory pattern

#### `mailer/providers/factory.js`
Factory que selecciona el proveedor de email apropiado:
- **Soporte múltiple**: Resend y Gmail API
- **Importación dinámica**: Carga proveedores bajo demanda
- **Configuración centralizada**: Basada en variables de entorno

#### `mailer/providers/resend.js`
Implementación del proveedor Resend:
- **API moderna**: Servicio de email transaccional
- **Validación**: Verifica API keys antes del envío
- **Formato estándar**: Retorna messageId y threadId

#### `mailer/gmail.js`
Implementación del proveedor Gmail con OAuth2:
- **Autenticación OAuth2**: Utiliza credenciales de Google
- **Gmail API**: Envío a través de la API oficial
- **Cliente singleton**: Reutiliza conexiones autenticadas

#### `mailer/mime.js`
Generador de mensajes MIME para Gmail:
- **Formato multipart**: Soporte HTML + texto plano
- **Codificación base64url**: Compatible con Gmail API
- **Headers personalizados**: Soporte para headers adicionales
- **Escape HTML**: Prevención de inyecciones

#### `mailer/queue.js`
Sistema de colas asíncronas con BullMQ:
- **Cola persistente**: Almacenamiento en Redis
- **Configuración flexible**: Delays, prioridades, reintentos
- **Rate limiting**: Control de velocidad de envío

#### `mailer/worker.js`
Worker que procesa la cola de emails:
- **Procesamiento asíncrono**: Ejecuta envíos en background
- **Manejo de eventos**: Success y error callbacks
- **Conexión Redis**: Persistente para alta disponibilidad

#### `mailer/templates.js`
Sistema de plantillas con Handlebars:
- **Cache inteligente**: Almacena plantillas compiladas
- **Múltiples tipos**: Recordatorios y promociones
- **Formato dual**: HTML y texto plano
- **Contexto dinámico**: Variables personalizables

### Sistema de Campañas

#### `mailer/campaign/core.js`
Motor principal para campañas masivas:
- **Procesamiento masivo**: Maneja miles de contactos
- **Rate limiting inteligente**: Respeta límites de proveedores
- **Personalización**: Contexto único por contacto
- **Links WhatsApp**: Generación automática de enlaces
- **Desuscripción**: URLs y headers estándar

#### `mailer/campaign/loaders/array.js`
Cargador de contactos desde arrays en memoria:
- **Validación**: Filtra contactos inválidos
- **Normalización**: Formatos estándar de campos
- **Generador eficiente**: Procesamiento bajo demanda

#### `mailer/campaign/loaders/xlsx.js`
Cargador de contactos desde archivos Excel:
- **Lectura Excel**: Soporte para archivos .xlsx
- **Validación email**: Regex de formato básico
- **Deduplicación**: Elimina contactos duplicados
- **Múltiples formatos**: Soporta diferentes nombres de columnas

### Ejemplos de Uso

#### `mailer/examples/enqueue-campaing.js`
Ejemplo de campaña desde array estático:
- **Contactos en código**: Para pruebas rápidas
- **Configuración completa**: Vendedor, promociones, campaña
- **Rate limiting**: 8 emails por segundo

#### `mailer/examples/enqueue-from-xlsx.js`
Ejemplo de campaña desde archivo Excel:
- **Carga masiva**: Miles de contactos desde Excel
- **Ruta configurable**: Variable de entorno
- **Procesamiento eficiente**: Generator pattern

#### `mailer/examples/enqueue-later.js`
Ejemplo de envío programado:
- **Delay configurable**: Envío en tiempo futuro
- **BullMQ scheduling**: Utiliza capacidades de la cola
- **Email de prueba**: Utiliza TEST_TO del config

#### `mailer/examples/enqueue-now.js`
Ejemplo de envío inmediato:
- **Sin delay**: Procesamiento inmediato por worker
- **Configuración mínima**: Solo datos básicos del email

#### `mailer/examples/enqueue.js`
Ejemplo avanzado con control granular:
- **Procesamiento manual**: Email por email
- **Batching**: Pausas cada N contactos
- **Headers completos**: Desuscripción, campaña, etc.
- **Control detallado**: Configuración BullMQ completa

#### `mailer/examples/send-fancy.js`
Ejemplo de envío directo con plantillas:
- **Sin cola**: Bypass del worker para envío inmediato
- **Plantillas completas**: Contexto rico para recordatorios
- **Datos completos**: Cliente, vehículo, cita, concesionario

### Plantillas de Email

#### `mailer/templates/reminder.html.hbs`
Plantilla HTML profesional para recordatorios:
- **Diseño responsive**: Compatible con todos los clientes email
- **Branding Ford**: Colores y estilo corporativo
- **Información completa**: Cliente, vehículo, cita, concesionario
- **Call-to-action**: Botón de confirmación

#### `mailer/templates/promo.html.hbs`
Plantilla HTML para emails promocionales:
- **Grid de promociones**: Múltiples ofertas por email
- **Links de seguimiento**: UTM parameters para analytics
- **WhatsApp CTA**: Botón directo al vendedor
- **Desuscripción**: Link estándar incluido

### Sistema de WhatsApp con IA

#### `whatsapp/src/orchestrator.js`
Coordinador principal del sistema de IA:
- **Flujo RAG**: Búsqueda + contexto + generación
- **Integración completa**: RAG → Qwen → WhatsApp
- **Prompts especializados**: Sistema Ford específico
- **Fallbacks**: Respuestas por defecto si falla IA

#### `whatsapp/src/webhook.js`
Servidor Express para webhook de WhatsApp:
- **Verificación Meta**: Proceso de configuración inicial
- **Procesamiento mensajes**: Solo mensajes de texto
- **Idempotencia**: Evita procesamiento duplicado
- **Error handling**: Logging y respuestas apropiadas

#### `whatsapp/src/providers/whatsapp.js`
Cliente para WhatsApp Business API:
- **Graph API**: Integración oficial de Meta
- **Autenticación**: Bearer token automático
- **Reintentos**: Sistema robusto con backoff
- **Timeouts**: Configuración de límites de tiempo

#### `whatsapp/src/providers/qwen.js`
Cliente para modelo de IA Qwen:
- **Modelo especializado**: Qwen 2.5-1.5B Instruct
- **Formato OpenAI**: Compatible con estándares
- **Configuración IA**: Temperature, max_tokens
- **Parsing flexible**: Múltiples formatos de respuesta

#### `whatsapp/src/providers/rag.js`
Cliente para sistema RAG:
- **Búsqueda semántica**: Vectores embeddings
- **Top-K configurable**: Número de resultados
- **API key**: Autenticación segura
- **Normalización**: Formatos estándar de chunks

### Utilidades de WhatsApp

#### `whatsapp/src/utils/idempotency.js`
Sistema de idempotencia con Redis:
- **SETNX atómico**: Operaciones thread-safe
- **TTL configurable**: Limpieza automática
- **Prevención duplicados**: Mensajes únicos garantizados

#### `whatsapp/src/utils/redis.js`
Cliente Redis singleton:
- **Patrón singleton**: Una conexión por aplicación
- **Inicialización lazy**: Solo cuando se necesita
- **Configuración flexible**: URL desde environment

#### `whatsapp/src/utils/retry.js`
Sistema de reintentos robusto:
- **Backoff exponencial**: Delays incrementales
- **Jitter**: Aleatorización para evitar thundering herd
- **Error classification**: Recuperables vs definitivos
- **Callbacks**: Hooks para logging y debugging

## 🛠️ Configuración

### Variables de Entorno Requeridas

```bash
# Email Configuration
EMAIL_PROVIDER=resend                    # 'resend' o 'gmail'
RESEND_API_KEY=your_resend_key          # API key de Resend
TEST_TO=test@example.com                # Email para pruebas

# Gmail Configuration (si usas Gmail)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GMAIL_FROM=your-email@gmail.com

# Redis Configuration
REDIS_URL=redis://localhost:6379        # URL de Redis

# Rate Limiting
MAILER_RATE_LIMIT_MAX_RPS=5            # Emails por segundo
MAILER_TIMEZONE_DEFAULT=UTC            # Zona horaria
MAILER_DRY_RUN=false                   # Modo de prueba

# WhatsApp Configuration
WA_PHONE_NUMBER_ID=your_phone_id       # ID del número de WhatsApp Business
WA_ACCESS_TOKEN=your_access_token      # Token de acceso de Meta
WA_VERIFY_TOKEN=your_verify_token      # Token de verificación del webhook
PORT=3000                              # Puerto del servidor webhook

# AI Configuration
LLM_ENDPOINT=your_qwen_endpoint        # Endpoint del modelo Qwen
RAG_ENDPOINT=your_rag_endpoint         # Endpoint del sistema RAG
RAG_API_KEY=your_rag_api_key          # API key para RAG

# Campaign Configuration
UNSUB_HTTP_URL=https://example.com/unsubscribe  # URL de desuscripción
MAILER_XLSX_PATH=./data/clientes.xlsx           # Ruta del archivo Excel
```

## 🚀 Instalación y Uso

### 1. Instalación
```bash
npm install
```

### 2. Configuración
Copia el archivo `.env.example` a `.env` y configura las variables necesarias.

### 3. Iniciar Redis
```bash
# Con Docker
docker run -d -p 6379:6379 redis:alpine

# O instalar localmente
redis-server
```

### 4. Iniciar Worker (en terminal separado)
```bash
npm run dev:worker
```

### 5. Ejemplos de Uso

#### Envío de Prueba Simple
```bash
npm run send:test
```

#### Campaña desde Array
```bash
npm run enqueue:campaign
```

#### Campaña desde Excel
```bash
npm run enqueue:from-xlsx
```

#### WhatsApp Webhook
```bash
npm run whatsapp:webhook
```

## 📊 Scripts NPM Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Ejecuta prueba básica de envío |
| `npm run dev:worker` | Inicia worker para procesar cola |
| `npm run enqueue:campaign` | Ejecuta campaña desde array |
| `npm run enqueue:from-xlsx` | Ejecuta campaña desde Excel |
| `npm run enqueue:now` | Encola email inmediato |
| `npm run enqueue:later` | Encola email programado |
| `npm run send:fancy` | Envío directo con plantillas |
| `npm run whatsapp:webhook` | Inicia servidor WhatsApp |
| `npm run lint` | Ejecuta linting del código |

## 🔧 Personalización

### Agregar Nuevos Proveedores de Email
1. Crear archivo en `mailer/providers/`
2. Implementar función con firma estándar
3. Agregar al factory en `providers/factory.js`
4. Configurar en `config.js`

### Crear Nuevas Plantillas
1. Agregar archivos `.hbs` en `mailer/templates/`
2. Crear función render en `templates.js`
3. Usar en campañas o ejemplos

### Modificar Sistema de IA
1. Cambiar modelo en `providers/qwen.js`
2. Ajustar prompts en `orchestrator.js`
3. Configurar endpoint en variables de entorno

## 🐛 Troubleshooting

### Problemas Comunes

#### Emails no se envían
- Verificar API keys en `.env`
- Comprobar que Redis esté ejecutándose
- Verificar que el worker esté activo

#### WhatsApp no responde
- Verificar configuración del webhook en Meta
- Comprobar tokens de acceso
- Revisar logs del servidor

#### Errores de Rate Limiting
- Reducir `MAILER_RATE_LIMIT_MAX_RPS`
- Verificar límites del proveedor
- Usar modo dry-run para pruebas

## 📈 Monitoreo y Logs

El sistema incluye logging detallado:
- **Queue**: Estado de trabajos y procesamiento
- **Worker**: Éxito y errores de envío
- **WhatsApp**: Mensajes recibidos y respuestas
- **Retry**: Intentos y backoff timing

## 🔒 Seguridad

- **API Keys**: Nunca hardcodear en código
- **Rate Limiting**: Respeta límites de proveedores
- **Idempotencia**: Previene procesamiento duplicado
- **Validation**: Sanitización de inputs
- **Error Handling**: No expone información sensible

## 📄 Licencia

Propietario - Luis Leonidas Fernández

---

Para soporte técnico o consultas sobre implementación, contactar al desarrollador.