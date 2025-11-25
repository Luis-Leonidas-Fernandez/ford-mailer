# Cursor Rules - Ford Mailer

## Principios de Código

### Funciones
- Una función = una responsabilidad
- Máximo 30 líneas por función
- Máximo 3 parámetros (usar objetos para más: `{ email, nombre, phone }`)
- Nombres descriptivos: `buildWhatsAppLink()` no `buildLink()`
- Early returns: `if (error) return;` en lugar de anidar
- Siempre usar `async/await`, nunca callbacks

### Variables
- Nombres que revelen intención: `delayBetweenJobsMs` no `delay`
- Constantes en UPPER_CASE: `MAX_RPS`, `DEFAULT_TIMEOUT`
- Booleanos con prefijo: `isValid`, `hasError`, `shouldRetry`
- Usar destructuring: `const { email, nombre } = contacto;`
- Default values: `const rps = options.rps ?? config.maxRps;`

### Manejo de Errores
- Siempre `try/catch` en funciones async
- Logging estructurado: `console.error('[Worker] Job failed:', { jobId, error })`
- No silenciar errores: si no puedes manejarlo, propágalo
- Validar inputs al inicio: fail fast

### Async/Await
- Siempre `await` en funciones async
- Paralelizar independientes: `await Promise.all([...])`
- Timeouts en llamadas externas: `axios.post(url, data, { timeout: 8000 })`
- Evitar `await` en loops: usar `Promise.all()` o `for await...of`

## Stack Específico

### ESM (ES Modules)
- Siempre `import/export`, nunca `require/module.exports`
- Imports al inicio, agrupados: built-in → externos → internos
- Named exports preferidos sobre default exports

### BullMQ
- Siempre configurar `removeOnComplete` y `removeOnFail` para evitar acumulación
- Usar `backoff` exponencial: `{ type: 'exponential', delay: 15000 }`
- Configurar `attempts` (default: 3)
- Rate limiting: calcular `delayBetweenJobsMs = 1000 / rps`

### Redis
- Singleton pattern para conexiones: una instancia por app
- Lazy initialization: crear solo cuando se necesita
- Siempre configurar TTL en keys temporales
- Usar `SETNX` para operaciones atómicas (idempotencia)

### Handlebars
- Templates en `/templates` con extensión `.hbs`
- Cache de templates compilados (no recompilar cada vez)
- Contexto limpio: solo pasar datos necesarios
- Helpers personalizados si se repiten lógicas

### Express
- Middleware de error al final: `app.use((err, req, res, next) => {...})`
- Validar inputs antes de procesar
- Respuestas consistentes: `{ success, data, error }`
- Logging de requests importantes

### Axios
- Siempre configurar `timeout`
- Usar `retry` utility para reintentos
- Headers de autenticación: `Authorization: Bearer ${token}`
- Manejar errores HTTP específicos (4xx vs 5xx)

## Arquitectura del Proyecto

### Patrón: Arquitectura Modular por Capas
- **Routes/Controllers**: Punto de entrada (Express routes en `webhook.js`)
- **Services**: Lógica de negocio (`orchestrator.js`, `campaign/core.js`, `index.js`)
- **Providers/Adapters**: Adaptadores para servicios externos (Factory pattern en `providers/`)
- **Infrastructure**: Colas, Redis, workers (`queue.js`, `worker.js`, `utils/redis.js`)
- **Templates**: Vistas/plantillas (Handlebars en `templates/`)

### Principios Arquitectónicos
- **Separación de responsabilidades**: Cada capa tiene una responsabilidad clara
- **Factory Pattern**: Para seleccionar proveedores (`providers/factory.js`)
- **Dependency Injection**: Configuración centralizada en `config.js`
- **Service Layer**: Lógica de negocio en servicios, no en routes
- **Adapters**: Proveedores externos como adaptadores intercambiables
- **Modularidad**: `/mailer` y `/whatsapp` son módulos independientes

### Estructura de Carpetas
- `/mailer` - Sistema de email (módulo independiente)
  - `/providers` - Adaptadores de email (Resend, Gmail)
  - `/campaign` - Lógica de campañas
  - `/templates` - Plantillas Handlebars
  - `/utils` - Utilidades del módulo
- `/whatsapp` - Sistema de WhatsApp (módulo independiente)
  - `/providers` - Clientes de APIs (WhatsApp, Qwen, RAG)
  - `/utils` - Utilidades (idempotency, retry, redis)
- `/scripts` - Scripts de utilidad
- `/data` - Datos estáticos (Excel, etc.)

### Reglas de Organización
- **Un módulo = una responsabilidad**: `/mailer` solo emails, `/whatsapp` solo WhatsApp
- **Providers intercambiables**: Agregar nuevos proveedores sin cambiar lógica de negocio
- **Configuración centralizada**: Todo en `config.js`, no `process.env` disperso
- **Services puros**: Lógica de negocio sin dependencias de infraestructura directas
- **Adapters aislados**: Cada provider es independiente y testeable

## Estructura de Datos

### Reglas de Validación
- **Validar emails**: Usar regex antes de enviar: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Validar teléfonos**: Formato E.164 requerido: `/^\+[1-9]\d{1,14}$/`
- **Validar objetos**: Verificar propiedades requeridas antes de usar
- **Fail fast**: Si falta algo crítico, lanzar error inmediatamente
- **Usar destructuring**: `const { email, nombre } = contacto;` para acceso seguro

### Contactos
```javascript
{ email: string, nombre?: string }
```

### Vendedor
```javascript
{ nombre: string, phoneE164: string } // E.164: +5493624169463
```

### Campaña
```javascript
{
  subject: string,
  brandTitle: string,
  brandSubtitle: string,
  brandLogoUrl: string,
  dealershipName: string,
  dealershipAddress: string,
  contactPhone: string,
  ctaLabel: string
}
```

### Promociones
```javascript
// Opción 1: Solo imagen
{ imageUrl: string }

// Opción 2: Completo
{ titulo: string, descripcion: string, precio: string, url: string }
```

## Configuración

- Nunca hardcodear: todo en variables de entorno
- Valores por defecto sensatos: `process.env.REDIS_URL || 'redis://localhost:6379'`
- Validar config crítica al inicio: fallar rápido si falta algo
- Usar `config.js` centralizado, no `process.env` disperso

## Performance

### Procesamiento de Archivos Grandes
- **Usar generadores**: `function*` para procesar Excel sin cargar todo en memoria
- **Streams para archivos grandes**: Si Excel > 10MB, considerar `xlsx.stream` o procesar por chunks
- **Validación temprana**: Filtrar datos inválidos antes de procesar (fail fast)
- **Deduplicación eficiente**: Usar `Set` para O(1) lookup, no arrays

### Loops y Procesamiento Masivo
- **Evitar `await` en loops**: Usar `Promise.all()` para operaciones independientes
- **Batch processing**: Procesar en lotes (ej: 200 contactos) con pausas entre batches
- **Rate limiting**: Respetar `delayBetweenJobsMs = 1000 / rps` para no saturar APIs
- **Generadores para iterables**: `for await...of` para procesar streams/generadores
- **Early exits**: Usar `continue` o `break` temprano en loops cuando sea posible

### Cache y Memoria
- **Cache de templates**: Templates Handlebars compilados (ya implementado)
- **Singleton para conexiones**: Redis, HTTP clients (una instancia reutilizable)
- **Lazy loading**: Cargar módulos solo cuando se necesitan (`import()` dinámico)
- **Limpiar referencias**: No mantener referencias a objetos grandes innecesariamente
- **TTL en Redis**: Configurar TTL para keys temporales (evitar acumulación)

### Operaciones Asíncronas
- **Paralelizar independientes**: `await Promise.all([...])` para operaciones no dependientes
- **Timeouts en llamadas externas**: Siempre configurar `timeout` en Axios (ej: 8000ms)
- **Colas para tareas pesadas**: Usar BullMQ para procesamiento asíncrono, no bloquear el event loop
- **Worker separado**: Procesar emails en worker, no en el proceso principal

### Optimizaciones Específicas
- **Excel**: Usar generadores (`yield`) para no cargar todo en memoria
- **Handlebars**: Cache de templates compilados, no recompilar cada vez
- **Redis**: Connection pooling (ya con singleton), pipeline para múltiples operaciones
- **HTTP**: Reutilizar instancias de Axios con `axios.create()`, no crear nuevos cada vez
- **Regex**: Compilar regex una vez si se usa repetidamente: `const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### Métricas a Monitorear
- **Memory usage**: Verificar que no haya memory leaks en workers
- **Queue size**: Monitorear tamaño de cola BullMQ para detectar cuellos de botella
- **Processing time**: Loggear tiempo de procesamiento de batches grandes
- **API response times**: Monitorear tiempos de respuesta de APIs externas (Resend, WhatsApp, etc.)

### Anti-Patrones de Performance
- ❌ Cargar archivo Excel completo en memoria: usar generadores
- ❌ `await` en loops síncronos: usar `Promise.all()` o `for await...of`
- ❌ Recompilar templates cada vez: cache de templates compilados
- ❌ Crear nuevas conexiones en cada request: usar singleton/pooling
- ❌ Procesar todo síncronamente: usar colas y workers
- ❌ Sin timeouts en llamadas externas: siempre configurar timeout

## Code Smells a Evitar

- ❌ Funciones de 100+ líneas
- ❌ Parámetros mágicos: `sleep(5000)` → `sleep(DELAY_MS)`
- ❌ Código duplicado: extraer a funciones
- ❌ Nested ternaries: usar if/else
- ❌ Try/catch que solo loguea: manejar o propagar
- ❌ Variables globales: usar módulos
- ❌ `any` en TypeScript (si se migra): tipar siempre

## Comentarios

- Código autoexplicativo > comentarios
- JSDoc solo en funciones públicas/exportadas
- Comentarios de "por qué" no "qué"
- Eliminar código comentado

## Ejemplo de Función Bien Escrita

```javascript
/**
 * Genera link de WhatsApp con mensaje pre-llenado
 * @param {Object} params
 * @param {string} params.phoneE164 - Teléfono en formato E.164
 * @param {string} params.clienteNombre - Nombre del cliente
 * @param {string} params.vendedorNombre - Nombre del vendedor
 * @returns {string} URL de WhatsApp con mensaje codificado
 */
export function buildWhatsAppLink({ phoneE164, clienteNombre, vendedorNombre }) {
  const mensaje = `Hola ${vendedorNombre}, soy ${clienteNombre} y estoy interesado en las promociones de Ford.`;
  const mensajeCodificado = encodeURIComponent(mensaje);
  const phoneNumber = phoneE164.replace(/[^0-9]/g, '');
  return `https://wa.me/${phoneNumber}?text=${mensajeCodificado}`;
}
```

---

**Nota**: Este archivo es para reglas de código. Para documentación del proyecto, ver `README.md`.