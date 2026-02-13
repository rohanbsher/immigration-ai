#!/usr/bin/env node
/**
 * Inspect AcroForm field names in a USCIS PDF template.
 * Usage: node scripts/inspect-pdf-fields.mjs <path-to-pdf>
 *
 * Outputs every field with its name, type, and options (for dropdowns/radios).
 */

import { readFile } from 'fs/promises';
import { PDFDocument } from 'pdf-lib';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/inspect-pdf-fields.mjs <path-to-pdf>');
  process.exit(1);
}

const bytes = await readFile(pdfPath);
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();
const fields = form.getFields();

console.log(`\n=== ${pdfPath} ===`);
console.log(`Total fields: ${fields.length}\n`);

const summary = { text: 0, checkbox: 0, radio: 0, dropdown: 0, other: 0 };

for (const field of fields) {
  const name = field.getName();
  const constructor = field.constructor.name;

  let type = 'unknown';
  let extra = '';

  if (constructor === 'PDFTextField') {
    type = 'text';
    summary.text++;
  } else if (constructor === 'PDFCheckBox') {
    type = 'checkbox';
    summary.checkbox++;
  } else if (constructor === 'PDFRadioGroup') {
    type = 'radio';
    const rg = form.getRadioGroup(name);
    const opts = rg.getOptions();
    extra = ` options=[${opts.join(', ')}]`;
    summary.radio++;
  } else if (constructor === 'PDFDropdown') {
    type = 'dropdown';
    const dd = form.getDropdown(name);
    const opts = dd.getOptions();
    extra = ` options=[${opts.slice(0, 10).join(', ')}${opts.length > 10 ? '...' : ''}]`;
    summary.dropdown++;
  } else {
    summary.other++;
  }

  console.log(`[${type}] ${name}${extra}`);
}

console.log(`\n--- Summary ---`);
console.log(`Text: ${summary.text}, Checkbox: ${summary.checkbox}, Radio: ${summary.radio}, Dropdown: ${summary.dropdown}, Other: ${summary.other}`);
console.log(`Total: ${fields.length}`);
