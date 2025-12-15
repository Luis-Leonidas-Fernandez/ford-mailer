import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

try {
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(content);
} catch (error) {
  console.error('Error leyendo .env:', error.message);
  process.exit(1);
}

