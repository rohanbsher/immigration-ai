import { describe, it, expect } from 'vitest';

import {
  requiredText,
  optionalText,
  dateField,
  selectField,
  yesNoField,
} from './types';

describe('requiredText', () => {
  it('sets correct defaults', () => {
    const field = requiredText('first_name', 'First Name');
    expect(field.id).toBe('first_name');
    expect(field.name).toBe('first_name');
    expect(field.label).toBe('First Name');
    expect(field.type).toBe('text');
    expect(field.aiMappable).toBe(true);
  });

  it('has required validation', () => {
    const field = requiredText('first_name', 'First Name');
    expect(field.validation).toEqual({ required: true });
  });

  it('merges extra options over defaults', () => {
    const field = requiredText('first_name', 'First Name', {
      placeholder: 'Enter name',
      aiMappable: false,
    });
    expect(field.placeholder).toBe('Enter name');
    expect(field.aiMappable).toBe(false);
  });
});

describe('optionalText', () => {
  it('has no validation property', () => {
    const field = optionalText('middle_name', 'Middle Name');
    expect(field.validation).toBeUndefined();
  });

  it('has aiMappable set to true', () => {
    const field = optionalText('middle_name', 'Middle Name');
    expect(field.aiMappable).toBe(true);
  });
});

describe('dateField', () => {
  it('has no validation when required is false', () => {
    const field = dateField('dob', 'Date of Birth', false);
    expect(field.type).toBe('date');
    expect(field.validation).toBeUndefined();
  });

  it('has required validation when required is true', () => {
    const field = dateField('dob', 'Date of Birth', true);
    expect(field.validation).toEqual({ required: true });
  });
});

describe('selectField', () => {
  const opts = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ];

  it('has the correct options array', () => {
    const field = selectField('country', 'Country', opts);
    expect(field.type).toBe('select');
    expect(field.options).toEqual(opts);
  });

  it('has no validation when optional', () => {
    const field = selectField('country', 'Country', opts, false);
    expect(field.validation).toBeUndefined();
  });

  it('has required validation when required', () => {
    const field = selectField('country', 'Country', opts, true);
    expect(field.validation).toEqual({ required: true });
  });
});

describe('yesNoField', () => {
  it('has Yes and No options', () => {
    const field = yesNoField('is_citizen', 'Are you a citizen?');
    expect(field.type).toBe('radio');
    expect(field.options).toEqual([
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]);
  });

  it('has no validation when optional', () => {
    const field = yesNoField('is_citizen', 'Are you a citizen?', false);
    expect(field.validation).toBeUndefined();
  });

  it('has required validation when required', () => {
    const field = yesNoField('is_citizen', 'Are you a citizen?', true);
    expect(field.validation).toEqual({ required: true });
  });

  it('allows options to override defaults', () => {
    const field = yesNoField('is_citizen', 'Are you a citizen?', false, {
      helpText: 'Select one',
    });
    expect(field.helpText).toBe('Select one');
  });
});
