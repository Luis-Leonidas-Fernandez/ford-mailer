/**
 * Sistema de plantillas para emails Ford Mailer
 * 
 * Este módulo maneja el renderizado de plantillas de email utilizando Handlebars.
 * Proporciona plantillas predefinidas para diferentes tipos de emails:
 * - Recordatorios de servicio
 * - Promociones de Ford
 * 
 * Funciones principales:
 * - loadTemplate: Carga y compila plantillas con caché
 * - renderReminder: Renderiza emails de recordatorio
 * - renderFordPromos: Renderiza emails promocionales de Ford
 * 
 * Las plantillas se almacenan en caché para mejorar el rendimiento.
 */

// mailer/templates.js
import fs from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'node:url';

// Configuración de rutas para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio donde se encuentran las plantillas Handlebars
const TPL_DIR = path.resolve(__dirname, './templates');

// Cache para almacenar plantillas compiladas y mejorar rendimiento
const cache = new Map();

/**
 * Carga y compila una plantilla Handlebars con caché
 * @param {string} name - Nombre de la plantilla (sin extensión .hbs)
 * @returns {Promise<Function>} Plantilla compilada de Handlebars
 */
async function loadTemplate(name) {
  // Verifica si la plantilla ya está en caché
  if (cache.has(name)) return cache.get(name);
  
  // Lee el archivo de plantilla desde el sistema de archivos
  const file = await fs.readFile(path.join(TPL_DIR, `${name}.hbs`), 'utf8');
  
  // Compila la plantilla con Handlebars (noEscape permite HTML sin escapar)
  const tpl = Handlebars.compile(file, { noEscape: true });
  
  // Almacena en caché para futuras consultas
  cache.set(name, tpl);
  return tpl;
}

/**
 * Renderiza un email de recordatorio utilizando plantillas HTML y texto
 * @param {Object} ctx - Contexto con datos para la plantilla
 * @returns {Promise<Object>} Objeto con html y text renderizados
 */
export async function renderReminder(ctx) {
  const htmlTpl = await loadTemplate('reminder.html');
  const txtTpl = await loadTemplate('reminder.txt');
  return {
    html: htmlTpl(ctx),
    text: txtTpl(ctx),
  };
}

/**
 * Renderiza un email promocional de Ford utilizando plantillas HTML y texto
 * @param {Object} ctx - Contexto con datos para la plantilla (promos, cliente, etc.)
 * @returns {Promise<Object>} Objeto con html y text renderizados
 */
export async function renderFordPromos(ctx) {
  const htmlTpl = await loadTemplate('promo.html');
  const txtTpl = await loadTemplate('promo.txt');
  return { html: htmlTpl(ctx), text: txtTpl(ctx) };
}

