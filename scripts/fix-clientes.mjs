import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const PROJECT_ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const FILE_NAME = 'clientes.xlsx';
const FILE_PATH = path.join(DATA_DIR, FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
  console.error(`❌ No se encontró el archivo ${FILE_NAME} en ${DATA_DIR}`);
  process.exit(1);
}

console.log(`📄 Leyendo ${FILE_NAME}...`);
const workbook = xlsx.readFile(FILE_PATH, { cellDates: false, cellNF: false, cellText: false });
const [firstSheetName] = workbook.SheetNames;

if (!firstSheetName) {
  console.error('❌ El archivo XLSX no contiene hojas.');
  process.exit(1);
}

const sheet = workbook.Sheets[firstSheetName];
const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

if (!rawRows.length) {
  console.error('❌ El archivo XLSX no tiene registros.');
  process.exit(1);
}

const EMAIL_KEYS = ['email', 'correo', 'mail', 'e-mail', 'email address'];
const NAME_KEYS = ['nombre', 'name', 'full name', 'cliente', 'contacto'];

const normalizeKey = (key) => key?.toString().trim().toLowerCase();
const normalizeValue = (value) => (typeof value === 'string' ? value.trim() : value ?? '');

const seenEmails = new Set();
const normalizedRows = [];

for (const row of rawRows) {
  const normalizedEntry = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedEntry[normalizeKey(key)] = normalizeValue(value);
  }

  let email =
    EMAIL_KEYS.map((key) => normalizedEntry[key]).find((value) => typeof value === 'string' && value.length) || '';
  email = email.toString().trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn('⚠️  Registro omitido por email inválido:', row);
    continue;
  }

  if (seenEmails.has(email)) {
    console.warn(`ℹ️  Email duplicado omitido (${email}).`);
    continue;
  }

  seenEmails.add(email);

  const nombre =
    NAME_KEYS.map((key) => normalizedEntry[key]).find((value) => typeof value === 'string' && value.length) || '';

  normalizedRows.push({
    Email: email,
    Nombre: nombre,
  });
}

const requiredContacts = [
  { email: 'cristianesosa@gmail.com', nombre: 'Cristian Sosa' },
];

for (const contact of requiredContacts) {
  const { email, nombre } = contact;
  if (!seenEmails.has(email)) {
    console.log(`➕ Agregando contacto faltante: ${email}`);
    normalizedRows.push({ Email: email, Nombre: nombre ?? '' });
    seenEmails.add(email);
  }
}

if (!normalizedRows.length) {
  console.error('❌ No quedaron contactos válidos para escribir.');
  process.exit(1);
}

const newSheet = xlsx.utils.json_to_sheet(normalizedRows, { header: ['Email', 'Nombre'] });
workbook.Sheets[firstSheetName] = newSheet;
workbook.SheetNames = [firstSheetName];

xlsx.writeFile(workbook, FILE_PATH, { bookType: 'xlsx' });
console.log(`✅ Archivo ${FILE_NAME} normalizado correctamente (${normalizedRows.length} contactos).`);

