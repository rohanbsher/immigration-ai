import { describe, it, expect } from 'vitest';
import { filterPiiFromExtractedData, filterPiiFromRecord } from './pii-filter';
import type { ExtractedField } from './types';

// ---------------------------------------------------------------------------
// filterPiiFromExtractedData
// ---------------------------------------------------------------------------

describe('filterPiiFromExtractedData', () => {
  const makeField = (
    fieldName: string,
    value: string | null,
    confidence = 0.9
  ): ExtractedField => ({
    field_name: fieldName,
    value,
    confidence,
    requires_verification: false,
  });

  describe('redacts sensitive fields', () => {
    it('redacts passport_number', () => {
      const fields = [makeField('passport_number', 'AB1234567')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:passport_number]');
    });

    it('redacts social_security_number', () => {
      const fields = [makeField('social_security_number', '123-45-6789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:social_security_number]');
    });

    it('redacts ssn', () => {
      const fields = [makeField('ssn', '123456789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:ssn]');
    });

    it('redacts date_of_birth', () => {
      const fields = [makeField('date_of_birth', '1990-01-15')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:date_of_birth]');
    });

    it('redacts dob', () => {
      const fields = [makeField('dob', '1990-01-15')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:dob]');
    });

    it('redacts alien_number', () => {
      const fields = [makeField('alien_number', 'A123456789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:alien_number]');
    });

    it('redacts driver_license_number', () => {
      const fields = [makeField('driver_license_number', 'D1234567')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:driver_license_number]');
    });

    it('redacts bank_account_number', () => {
      const fields = [makeField('bank_account_number', '9876543210')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:bank_account_number]');
    });

    it('redacts credit_card_number', () => {
      const fields = [makeField('credit_card_number', '4111111111111111')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:credit_card_number]');
    });

    it('redacts tax_id', () => {
      const fields = [makeField('tax_id', '12-3456789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:tax_id]');
    });

    it('redacts itin', () => {
      const fields = [makeField('itin', '900-70-1234')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:itin]');
    });

    it('redacts visa_number', () => {
      const fields = [makeField('visa_number', 'V12345678')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:visa_number]');
    });

    it('redacts i94_number', () => {
      const fields = [makeField('i94_number', '12345678901')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:i94_number]');
    });

    it('redacts mother_maiden_name', () => {
      const fields = [makeField('mother_maiden_name', 'Smith')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:mother_maiden_name]');
    });

    it('redacts uscis_receipt_number', () => {
      const fields = [makeField('uscis_receipt_number', 'IOE0123456789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:uscis_receipt_number]');
    });

    it('redacts ein', () => {
      const fields = [makeField('ein', '12-3456789')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:ein]');
    });

    it('redacts national_id_number', () => {
      const fields = [makeField('national_id_number', 'NID123456')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:national_id_number]');
    });

    it('redacts travel_document_number', () => {
      const fields = [makeField('travel_document_number', 'TD123456')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('[REDACTED:travel_document_number]');
    });
  });

  describe('preserves non-sensitive fields', () => {
    it('does not redact full_name', () => {
      const fields = [makeField('full_name', 'John Doe')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('John Doe');
    });

    it('does not redact employer_name', () => {
      const fields = [makeField('employer_name', 'ACME Corp')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('ACME Corp');
    });

    it('does not redact job_title', () => {
      const fields = [makeField('job_title', 'Software Engineer')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('Software Engineer');
    });

    it('does not redact nationality', () => {
      const fields = [makeField('nationality', 'United States')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('United States');
    });

    it('does not redact place_of_birth', () => {
      const fields = [makeField('place_of_birth', 'New York, USA')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBe('New York, USA');
    });
  });

  describe('preserves metadata', () => {
    it('keeps field_name unchanged when redacting', () => {
      const fields = [makeField('passport_number', 'AB123')];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].field_name).toBe('passport_number');
    });

    it('keeps confidence unchanged when redacting', () => {
      const fields = [makeField('ssn', '123456789', 0.95)];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].confidence).toBe(0.95);
    });

    it('keeps requires_verification unchanged when redacting', () => {
      const fields: ExtractedField[] = [
        {
          field_name: 'passport_number',
          value: 'AB123',
          confidence: 0.8,
          requires_verification: true,
          source_location: 'page 1',
        },
      ];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].requires_verification).toBe(true);
      expect(result[0].source_location).toBe('page 1');
    });
  });

  describe('edge cases', () => {
    it('does not redact null values even for sensitive fields', () => {
      const fields = [makeField('passport_number', null)];
      const result = filterPiiFromExtractedData(fields);
      expect(result[0].value).toBeNull();
    });

    it('handles empty array', () => {
      const result = filterPiiFromExtractedData([]);
      expect(result).toEqual([]);
    });

    it('handles mix of sensitive and non-sensitive fields', () => {
      const fields = [
        makeField('full_name', 'John Doe'),
        makeField('passport_number', 'AB123'),
        makeField('nationality', 'United States'),
        makeField('ssn', '123-45-6789'),
      ];
      const result = filterPiiFromExtractedData(fields);

      expect(result[0].value).toBe('John Doe');
      expect(result[1].value).toBe('[REDACTED:passport_number]');
      expect(result[2].value).toBe('United States');
      expect(result[3].value).toBe('[REDACTED:ssn]');
    });

    it('does not mutate the original array', () => {
      const fields = [makeField('passport_number', 'AB123')];
      filterPiiFromExtractedData(fields);
      expect(fields[0].value).toBe('AB123');
    });
  });
});

// ---------------------------------------------------------------------------
// filterPiiFromRecord
// ---------------------------------------------------------------------------

describe('filterPiiFromRecord', () => {
  describe('redacts sensitive string values', () => {
    it('redacts passport_number', () => {
      const record = { passport_number: 'AB123' };
      const result = filterPiiFromRecord(record);
      expect(result.passport_number).toBe('[REDACTED:passport_number]');
    });

    it('redacts ssn', () => {
      const record = { ssn: '123-45-6789' };
      const result = filterPiiFromRecord(record);
      expect(result.ssn).toBe('[REDACTED:ssn]');
    });

    it('redacts date_of_birth', () => {
      const record = { date_of_birth: '1990-01-15' };
      const result = filterPiiFromRecord(record);
      expect(result.date_of_birth).toBe('[REDACTED:date_of_birth]');
    });
  });

  describe('preserves non-sensitive values', () => {
    it('preserves full_name', () => {
      const record = { full_name: 'John Doe' };
      const result = filterPiiFromRecord(record);
      expect(result.full_name).toBe('John Doe');
    });

    it('preserves employer_name', () => {
      const record = { employer_name: 'ACME Corp' };
      const result = filterPiiFromRecord(record);
      expect(result.employer_name).toBe('ACME Corp');
    });
  });

  describe('nested objects', () => {
    it('recurses into nested objects', () => {
      const record = {
        petitioner: {
          full_name: 'John Doe',
          passport_number: 'AB123',
        },
      };
      const result = filterPiiFromRecord(record);
      const nested = result.petitioner as Record<string, unknown>;
      expect(nested.full_name).toBe('John Doe');
      expect(nested.passport_number).toBe('[REDACTED:passport_number]');
    });

    it('recurses into deeply nested objects', () => {
      const record = {
        level1: {
          level2: {
            ssn: '123-45-6789',
            name: 'John',
          },
        },
      };
      const result = filterPiiFromRecord(record);
      const level2 = (result.level1 as Record<string, unknown>)
        .level2 as Record<string, unknown>;
      expect(level2.ssn).toBe('[REDACTED:ssn]');
      expect(level2.name).toBe('John');
    });
  });

  describe('non-string primitives', () => {
    it('passes through numbers unchanged', () => {
      const record = { age: 30, ssn: '123-45-6789' };
      const result = filterPiiFromRecord(record);
      expect(result.age).toBe(30);
      expect(result.ssn).toBe('[REDACTED:ssn]');
    });

    it('passes through booleans unchanged', () => {
      const record = { active: true };
      const result = filterPiiFromRecord(record);
      expect(result.active).toBe(true);
    });

    it('passes through null unchanged', () => {
      const record = { passport_number: null };
      const result = filterPiiFromRecord(record);
      expect(result.passport_number).toBeNull();
    });

    it('passes through arrays unchanged (no recursion into arrays)', () => {
      const record = { items: ['a', 'b', 'c'] };
      const result = filterPiiFromRecord(record);
      expect(result.items).toEqual(['a', 'b', 'c']);
    });
  });

  describe('edge cases', () => {
    it('handles empty record', () => {
      const result = filterPiiFromRecord({});
      expect(result).toEqual({});
    });

    it('does not mutate the original record', () => {
      const record = { passport_number: 'AB123' };
      filterPiiFromRecord(record);
      expect(record.passport_number).toBe('AB123');
    });

    it('handles mixed sensitive and non-sensitive with nulls', () => {
      const record = {
        full_name: 'John Doe',
        passport_number: 'AB123',
        ssn: null,
        employer_name: 'ACME',
        dob: '1990-01-15',
      };
      const result = filterPiiFromRecord(record);
      expect(result.full_name).toBe('John Doe');
      expect(result.passport_number).toBe('[REDACTED:passport_number]');
      expect(result.ssn).toBeNull();
      expect(result.employer_name).toBe('ACME');
      expect(result.dob).toBe('[REDACTED:dob]');
    });
  });
});
