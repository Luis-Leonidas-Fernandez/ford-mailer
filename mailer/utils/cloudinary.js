/**
 * Utilidades para transformar y validar URLs de Cloudinary para emails
 * 
 * Este módulo proporciona funciones para:
 * - Validar que las URLs usen HTTPS
 * - Transformar URLs de Cloudinary optimizándolas para emails
 * - Aplicar transformaciones de formato, tamaño y calidad automáticamente
 */

/**
 * Verifica si una URL es de Cloudinary
 * @param {string} url - URL a verificar
 * @returns {boolean} true si es una URL de Cloudinary
 */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com');
}

/**
 * Valida que una URL use HTTPS
 * @param {string} url - URL a validar
 * @returns {boolean} true si la URL usa HTTPS o es relativa
 * @throws {Error} Si la URL usa HTTP explícitamente
 */
function validateHttps(url) {
  if (!url || typeof url !== 'string') return false;
  
  // URLs relativas son válidas
  if (url.startsWith('/') || url.startsWith('./')) return true;
  
  // URLs que no empiezan con http:// o https:// se consideran inválidas
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  // Si usa HTTP, lanzar error
  if (url.startsWith('http://')) {
    throw new Error(`URL insegura detectada (HTTP): ${url}. Se requiere HTTPS para emails.`);
  }
  
  return url.startsWith('https://');
}

/**
 * Fuerza HTTPS en una URL si no lo tiene
 * @param {string} url - URL a normalizar
 * @returns {string} URL con HTTPS garantizado
 */
function enforceHttps(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Si ya es HTTPS, retornar tal cual
  if (url.startsWith('https://')) return url;
  
  // Si es HTTP, reemplazar por HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  // Si no tiene protocolo, asumir HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * Parsea una URL de Cloudinary en sus componentes
 * @param {string} url - URL de Cloudinary
 * @returns {Object|null} Objeto con { base, version, imagePath } o null si no es válida
 */
function parseCloudinaryUrl(url) {
  if (!isCloudinaryUrl(url)) return null;
  
  try {
    // Formato esperado: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{image_path}
    // O con transformaciones: https://res.cloudinary.com/{cloud_name}/image/upload/{transforms}/{version}/{image_path}
    
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Buscar el índice de 'image' y 'upload'
    const imageIdx = pathParts.indexOf('image');
    const uploadIdx = pathParts.indexOf('upload');
    
    if (imageIdx === -1 || uploadIdx === -1 || uploadIdx !== imageIdx + 1) {
      return null;
    }
    
    // El base es protocolo + host + cloud_name (todo antes de 'image')
    // pathParts[0] es el cloud_name
    const cloudName = pathParts[0];
    const base = `${urlObj.protocol}//${urlObj.host}/${cloudName}`;
    
    // Después de 'upload' puede haber transformaciones, versión y path
    const afterUpload = pathParts.slice(uploadIdx + 1);
    
    // La versión siempre empieza con 'v' seguido de números
    const versionIdx = afterUpload.findIndex(part => /^v\d+$/.test(part));
    
    if (versionIdx === -1) return null;
    
    const version = afterUpload[versionIdx];
    const imagePath = afterUpload.slice(versionIdx + 1).join('/');
    const transforms = afterUpload.slice(0, versionIdx);
    
    return {
      base,
      transforms: transforms.length > 0 ? transforms.join(',') : null,
      version,
      imagePath,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Construye una URL de Cloudinary desde sus componentes
 * @param {Object} components - Componentes de la URL
 * @param {string} components.base - Base de la URL (protocolo + host + cloud_name)
 * @param {string} components.version - Versión de la imagen (ej: 'v1763472209')
 * @param {string} components.imagePath - Ruta de la imagen
 * @param {string|null} components.transforms - Transformaciones (opcional)
 * @returns {string} URL de Cloudinary construida
 */
function buildCloudinaryUrl({ base, version, imagePath, transforms = null }) {
  const parts = [base, 'image', 'upload'];
  
  if (transforms) {
    parts.push(transforms);
  }
  
  parts.push(version, imagePath);
  
  return parts.join('/');
}

/**
 * Transforma una URL de Cloudinary optimizándola para emails
 * @param {string} url - URL original de Cloudinary
 * @param {Object} options - Opciones de transformación
 * @param {number} [options.width] - Ancho máximo en píxeles
 * @param {number} [options.height] - Alto máximo en píxeles (opcional)
 * @param {string} [options.format='f_jpg'] - Formato de imagen ('f_auto', 'f_jpg', 'f_png', 'f_webp')
 * @param {string} [options.quality='q_auto'] - Calidad de imagen ('q_auto', 'q_80', 'q_90', etc.)
 * @param {boolean} [options.enforceHttps=true] - Forzar HTTPS si no está presente
 * @returns {string} URL transformada y optimizada
 */
export function transformCloudinaryUrlForEmail(url, options = {}) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  const {
    width,
    height,
    format = 'f_jpg',
    quality = 'q_auto',
    enforceHttps: shouldEnforceHttps = true,
  } = options;
  
  // Si no es una URL de Cloudinary, solo validar/enforzar HTTPS
  if (!isCloudinaryUrl(url)) {
    return shouldEnforceHttps ? enforceHttps(url) : url;
  }
  
  // Enforzar HTTPS primero
  const httpsUrl = shouldEnforceHttps ? enforceHttps(url) : url;
  
  // Validar HTTPS
  try {
    validateHttps(httpsUrl);
  } catch (error) {
    console.warn('[Cloudinary] Advertencia de seguridad:', error.message);
    // Continuar con la transformación pero usar HTTPS
  }
  
  // Parsear la URL
  const parsed = parseCloudinaryUrl(httpsUrl);
  if (!parsed) {
    // Si no se puede parsear, retornar la URL con HTTPS garantizado
    console.warn('[Cloudinary] No se pudo parsear URL de Cloudinary:', url);
    return httpsUrl;
  }
  
  // Construir transformaciones
  const transforms = [];
  
  // Formato
  if (format) {
    transforms.push(format);
  }
  
  // Calidad
  if (quality) {
    transforms.push(quality);
  }
  
  // Ancho
  if (width && typeof width === 'number' && width > 0) {
    transforms.push(`w_${width}`);
  }
  
  // Alto
  if (height && typeof height === 'number' && height > 0) {
    transforms.push(`h_${height}`);
  }
  
  // Si ya había transformaciones y no agregamos nuevas, mantener las originales
  // Si agregamos nuevas, reemplazar las originales
  const finalTransforms = transforms.length > 0 ? transforms.join(',') : parsed.transforms;
  
  // Construir nueva URL
  const transformedUrl = buildCloudinaryUrl({
    base: parsed.base,
    version: parsed.version,
    imagePath: parsed.imagePath,
    transforms: finalTransforms,
  });
  
  return transformedUrl;
}

/**
 * Transforma múltiples URLs de Cloudinary
 * @param {Array<string>} urls - Array de URLs a transformar
 * @param {Object} options - Opciones de transformación (mismas que transformCloudinaryUrlForEmail)
 * @returns {Array<string>} Array de URLs transformadas
 */
export function transformCloudinaryUrlsForEmail(urls, options = {}) {
  if (!Array.isArray(urls)) {
    return [];
  }
  
  return urls
    .filter(url => url && typeof url === 'string')
    .map(url => transformCloudinaryUrlForEmail(url, options));
}

/**
 * Valida y normaliza una URL para uso en emails
 * - Verifica HTTPS
 * - Transforma URLs de Cloudinary si es necesario
 * @param {string} url - URL a validar y normalizar
 * @param {Object} [options] - Opciones de transformación (solo aplica si es Cloudinary)
 * @returns {string} URL validada y normalizada
 * @throws {Error} Si la URL es inválida o insegura
 */
export function validateAndNormalizeUrlForEmail(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL inválida: debe ser una cadena de texto no vacía');
  }
  
  // Enforzar HTTPS
  const httpsUrl = enforceHttps(url);
  
  // Validar HTTPS
  validateHttps(httpsUrl);
  
  // Si es Cloudinary, aplicar transformaciones
  if (isCloudinaryUrl(httpsUrl)) {
    return transformCloudinaryUrlForEmail(httpsUrl, options);
  }
  
  return httpsUrl;
}

