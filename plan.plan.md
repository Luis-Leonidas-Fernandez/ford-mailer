# Plan: Configuración de Servidor Express para Inri Servicios Digitales API

## Objetivos

1. Verificar y actualizar dependencias del proyecto
2. Crear servidor Express separado con CORS, dotenv y middleware esencial
3. Generar página HTML optimizada mostrando estado del servidor
4. Configurar PM2 para gestión de procesos en Digital Ocean VPS

## Archivos a Crear/Modificar

### 1. Verificación de Dependencias

- **Archivo**: `package.json`
  - Agregar `cors` como dependencia
  - Agregar `morgan` (opcional, para logging HTTP)
  - Verificar versiones actualizadas de `express` y `dotenv`
  - Agregar script `check:deps` para verificar dependencias desactualizadas

### 2. Servidor Express Principal

- **Archivo**: `server.js` (nuevo, en raíz del proyecto)
  - Configurar Express con middleware: CORS, dotenv, JSON parser
  - Puerto desde variable de entorno `API_PORT` (default: 3001)
  - Ruta GET `/` que sirva el HTML de estado
  - Ruta GET `/api/status` que retorne JSON con estado del servidor
  - Middleware de manejo de errores
  - Logging básico de requests

### 3. Página de Estado

- **Archivo**: `public/index.html` (nuevo)
  - HTML5 optimizado y responsive
  - Título: "Inri Servicios Digitales API"
  - Muestra estado del servidor (activo/inactivo)
  - Información del servidor (uptime, versión Node.js, etc.)
  - Diseño moderno y profesional
  - CSS inline para optimización
  - JavaScript mínimo para actualizar estado dinámicamente

### 4. Configuración PM2

- **Archivo**: `ecosystem.config.js` (nuevo)
  - Configuración PM2 para producción
  - Variables de entorno
  - Auto-restart y logs
  - Configuración para Digital Ocean VPS
  - Listo para uso manual (sin scripts de despliegue automatizado)

## Estructura de Carpetas Resultante

```
FORD-MAILER/
├── server.js                    # Servidor Express principal
├── ecosystem.config.js          # Configuración PM2
├── public/
│   └── index.html              # Página de estado optimizada
└── package.json                # Dependencias actualizadas
```

## Dependencias a Agregar

- `cors`: ^2.8.5 (middleware CORS)
- `morgan`: ^1.10.0 (opcional, logging HTTP)

## Variables de Entorno

- `API_PORT`: Puerto del servidor API (default: 3001)
- `NODE_ENV`: Entorno de ejecución (development/production)

## Scripts NPM a Agregar

- `server`: Inicia el servidor Express
- `check:deps`: Verifica dependencias desactualizadas
- `pm2:start`: Inicia con PM2
- `pm2:stop`: Detiene PM2
- `pm2:restart`: Reinicia con PM2

## Consideraciones

- El servidor será independiente del webhook de WhatsApp existente
- No se requiere conexión a base de datos por el momento
- El HTML será optimizado (CSS inline, JS mínimo)
- PM2 manejará el proceso en producción
- El despliegue se realizará manualmente en el VPS de Digital Ocean
- La configuración PM2 está lista para uso manual con comandos PM2 estándar

