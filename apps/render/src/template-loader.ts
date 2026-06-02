import fs from 'fs';
import path from 'path';
import { TemplateSchema } from './types';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates-html');

export function loadTemplateHtml(templateId: string): string {
  const htmlPath = path.join(TEMPLATES_DIR, templateId, 'template.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Template not found: "${templateId}". Available: ${listTemplates().join(', ')}`);
  }
  return fs.readFileSync(htmlPath, 'utf-8');
}

export function loadSchema(templateId: string): TemplateSchema {
  const schemaPath = path.join(TEMPLATES_DIR, templateId, 'schema.json');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found for template: "${templateId}"`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as TemplateSchema;
}

export function listTemplates(): string[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((d) => fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory());
}

export function getDimensions(templateId: string): { width: number; height: number } {
  try {
    const schema = loadSchema(templateId);
    return getDimensionsFromSchema(schema);
  } catch {
    return { width: 1080, height: 1350 };
  }
}

export function getDimensionsFromSchema(schema: TemplateSchema): { width: number; height: number } {
  if (typeof schema.format === 'string') {
    const [w, h] = schema.format.split('x').map(Number);
    return { width: w || 1080, height: h || 1350 };
  }
  return {
    width: schema.format.width || 1080,
    height: schema.format.height || 1350,
  };
}
