import { describe, it, expect } from 'vitest';
import { buildAddressHistory, buildEmploymentHistory, buildEducationHistory } from './history-builder';

describe('buildAddressHistory', () => {
  it('extracts addresses from utility bills', () => {
    const docs = [{
      extracted_fields: [
        { field_name: 'service_address_street', value: '123 Main St' },
        { field_name: 'service_address_city', value: 'Boston' },
        { field_name: 'service_address_state', value: 'MA' },
        { field_name: 'service_address_zip', value: '02101' },
        { field_name: 'bill_date', value: '2024-03-15' },
      ],
    }];
    const result = buildAddressHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].street).toBe('123 Main St');
    expect(result[0].city).toBe('Boston');
    expect(result[0].country).toBe('United States');
  });

  it('extracts addresses from tax returns', () => {
    const docs = [{
      extracted_fields: [
        { field_name: 'filing_address_street', value: '456 Oak Ave' },
        { field_name: 'filing_address_city', value: 'Cambridge' },
        { field_name: 'filing_address_state', value: 'MA' },
        { field_name: 'filing_address_zip', value: '02139' },
        { field_name: 'tax_year', value: '2023' },
      ],
    }];
    const result = buildAddressHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].from_date).toBe('2023-01');
    expect(result[0].to_date).toBe('2023-12');
  });

  it('deduplicates same address from multiple bills', () => {
    const docs = [
      {
        extracted_fields: [
          { field_name: 'service_address_street', value: '123 Main St' },
          { field_name: 'service_address_city', value: 'Boston' },
          { field_name: 'service_address_state', value: 'MA' },
          { field_name: 'service_address_zip', value: '02101' },
          { field_name: 'service_start_date', value: '2023-01-01' },
        ],
      },
      {
        extracted_fields: [
          { field_name: 'service_address_street', value: '123 Main St' },
          { field_name: 'service_address_city', value: 'Boston' },
          { field_name: 'service_address_state', value: 'MA' },
          { field_name: 'service_address_zip', value: '02101' },
          { field_name: 'service_start_date', value: '2024-01-01' },
        ],
      },
    ];
    const result = buildAddressHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].from_date).toBe('2023-01'); // keeps earliest
  });

  it('sorts by from_date descending', () => {
    const docs = [
      {
        extracted_fields: [
          { field_name: 'service_address_street', value: '123 Main' },
          { field_name: 'service_address_city', value: 'A' },
          { field_name: 'service_address_state', value: 'MA' },
          { field_name: 'service_start_date', value: '2020-01-01' },
        ],
      },
      {
        extracted_fields: [
          { field_name: 'service_address_street', value: '456 Oak' },
          { field_name: 'service_address_city', value: 'B' },
          { field_name: 'service_address_state', value: 'NY' },
          { field_name: 'service_start_date', value: '2023-06-01' },
        ],
      },
    ];
    const result = buildAddressHistory(docs);
    expect(result[0].city).toBe('B'); // 2023 comes first
    expect(result[1].city).toBe('A'); // 2020 second
  });

  it('returns empty array when no address data', () => {
    const docs = [{ extracted_fields: [{ field_name: 'name', value: 'John' }] }];
    expect(buildAddressHistory(docs)).toEqual([]);
  });

  it('handles documents with no extracted_fields', () => {
    expect(buildAddressHistory([{}, { extracted_fields: undefined }])).toEqual([]);
  });
});

describe('buildEmploymentHistory', () => {
  it('extracts employment from W-2s', () => {
    const docs = [{
      extracted_fields: [
        { field_name: 'employer_name', value: 'Acme Corp' },
        { field_name: 'job_title', value: 'Engineer' },
        { field_name: 'employer_city', value: 'NYC' },
        { field_name: 'employment_start_date', value: '2022-03' },
        { field_name: 'employment_end_date', value: '2024-01' },
      ],
    }];
    const result = buildEmploymentHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].employer_name).toBe('Acme Corp');
    expect(result[0].employer_city).toBe('NYC');
  });

  it('deduplicates same employer across years', () => {
    const docs = [
      {
        extracted_fields: [
          { field_name: 'employer_name', value: 'Acme Corp' },
          { field_name: 'job_title', value: 'Engineer' },
          { field_name: 'tax_year', value: '2022' },
        ],
      },
      {
        extracted_fields: [
          { field_name: 'employer_name', value: 'Acme Corp' },
          { field_name: 'job_title', value: 'Engineer' },
          { field_name: 'tax_year', value: '2023' },
        ],
      },
    ];
    const result = buildEmploymentHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].from_date).toBe('2022-01');
  });
});

describe('buildEducationHistory', () => {
  it('extracts education from diplomas', () => {
    const docs = [{
      extracted_fields: [
        { field_name: 'institution_name', value: 'MIT' },
        { field_name: 'degree_type', value: 'Master of Science' },
        { field_name: 'field_of_study', value: 'Computer Science' },
        { field_name: 'graduation_date', value: '2020-05-15' },
        { field_name: 'institution_city', value: 'Cambridge' },
        { field_name: 'institution_country', value: 'United States' },
      ],
    }];
    const result = buildEducationHistory(docs);
    expect(result).toHaveLength(1);
    expect(result[0].institution_name).toBe('MIT');
    expect(result[0].degree_type).toBe('Master of Science');
    expect(result[0].graduation_date).toBe('2020-05');
  });

  it('returns empty for documents without education data', () => {
    const docs = [{ extracted_fields: [{ field_name: 'name', value: 'John' }] }];
    expect(buildEducationHistory(docs)).toEqual([]);
  });
});
