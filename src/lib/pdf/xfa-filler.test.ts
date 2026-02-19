/**
 * Unit tests for the XFA PDF filler engine.
 *
 * Mocks `fetch` to test the HTTP client wrapper logic without
 * requiring the Railway PDF service or real USCIS PDF templates.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AcroFormFieldMap } from './acroform-filler';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Import AFTER mocks are set up
import { fillXFAPdf, buildFieldData, deriveFormType, flattenRepeatingFields } from './xfa-filler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

function mockFetchSuccess(filled: number, total: number, errors: string[] = []) {
  const statsHeader = JSON.stringify({ filled, total, errors });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'X-Fill-Stats': statsHeader }),
    arrayBuffer: () => Promise.resolve(FAKE_PDF_BYTES.buffer.slice(0)),
  }));
}

function mockFetchHttpError(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(body),
  }));
}

function mockFetchNetworkError(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

const SAMPLE_FIELD_MAPS: AcroFormFieldMap[] = [
  { formFieldName: 'form1.LastName', dataPath: 'applicant.lastName', type: 'text' },
  { formFieldName: 'form1.FirstName', dataPath: 'applicant.firstName', type: 'text' },
  { formFieldName: 'form1.DOB', dataPath: 'applicant.dateOfBirth', type: 'date' },
  { formFieldName: 'form1.SSN', dataPath: 'applicant.ssn', type: 'ssn' },
  { formFieldName: 'form1.Phone', dataPath: 'applicant.phone', type: 'phone' },
  { formFieldName: 'form1.AlienNum', dataPath: 'applicant.alienNumber', type: 'alien_number' },
];

const SAMPLE_DATA = {
  applicant: {
    lastName: 'Doe',
    firstName: 'John',
    dateOfBirth: '1990-06-15',
    ssn: '123456789',
    phone: '5551234567',
    alienNumber: '12345',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XFA Filler Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for the service
    process.env.PDF_SERVICE_URL = 'https://pdf-service.test.railway.app';
    process.env.PDF_SERVICE_SECRET = 'test-secret-token-1234';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PDF_SERVICE_URL;
    delete process.env.PDF_SERVICE_SECRET;
  });

  // -----------------------------------------------------------------------
  // flattenRepeatingFields — unit tests for array flattening
  // -----------------------------------------------------------------------
  describe('flattenRepeatingFields', () => {
    test('flattens address_history array into numbered keys', () => {
      const data = {
        name: 'John',
        address_history: [
          { street: '123 Main St', city: 'Boston', state: 'MA' },
          { street: '456 Oak Ave', city: 'Cambridge', state: 'MA' },
        ],
      };
      const flat = flattenRepeatingFields(data);
      expect(flat.address_history_0_street).toBe('123 Main St');
      expect(flat.address_history_0_city).toBe('Boston');
      expect(flat.address_history_1_street).toBe('456 Oak Ave');
      expect(flat.address_history_1_city).toBe('Cambridge');
      expect(flat.name).toBe('John');
    });

    test('flattens employment_history array', () => {
      const data = {
        employment_history: [
          { employer_name: 'Acme Corp', job_title: 'Engineer' },
        ],
      };
      const flat = flattenRepeatingFields(data);
      expect(flat.employment_history_0_employer_name).toBe('Acme Corp');
      expect(flat.employment_history_0_job_title).toBe('Engineer');
    });

    test('handles missing arrays gracefully', () => {
      const flat = flattenRepeatingFields({ name: 'John' });
      expect(flat.name).toBe('John');
      expect(Object.keys(flat)).toEqual(['name']);
    });

    test('handles empty arrays', () => {
      const flat = flattenRepeatingFields({ address_history: [] });
      expect(flat.address_history).toEqual([]);
    });

    test('skips null values in entries', () => {
      const data = {
        address_history: [
          { street: '123 Main St', apt: null, city: 'Boston' },
        ],
      };
      const flat = flattenRepeatingFields(data as Record<string, unknown>);
      expect(flat.address_history_0_street).toBe('123 Main St');
      expect(flat.address_history_0_city).toBe('Boston');
      expect(flat).not.toHaveProperty('address_history_0_apt');
    });
  });

  // -----------------------------------------------------------------------
  // buildFieldData — unit tests for the field mapping logic
  // -----------------------------------------------------------------------
  describe('buildFieldData', () => {
    test('formats text fields to uppercase', () => {
      const { fieldData } = buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA);
      expect(fieldData['form1.LastName']).toBe('DOE');
      expect(fieldData['form1.FirstName']).toBe('JOHN');
    });

    test('formats date fields to MM/DD/YYYY', () => {
      const { fieldData } = buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA);
      expect(fieldData['form1.DOB']).toBe('06/15/1990');
    });

    test('formats SSN fields to XXX-XX-XXXX', () => {
      const { fieldData } = buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA);
      expect(fieldData['form1.SSN']).toBe('123-45-6789');
    });

    test('formats phone fields to (XXX) XXX-XXXX', () => {
      const { fieldData } = buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA);
      expect(fieldData['form1.Phone']).toBe('(555) 123-4567');
    });

    test('formats alien number fields with A- prefix and padding', () => {
      const { fieldData } = buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA);
      expect(fieldData['form1.AlienNum']).toBe('A-000012345');
    });

    test('skips fields with missing data', () => {
      const { fieldData, skippedFields } = buildFieldData(
        SAMPLE_FIELD_MAPS,
        { applicant: { lastName: 'Doe' } }
      );
      expect(fieldData['form1.LastName']).toBe('DOE');
      expect(skippedFields).toContain('form1.FirstName');
      expect(skippedFields).toContain('form1.DOB');
    });

    test('skips fields with empty string data', () => {
      const { skippedFields } = buildFieldData(
        [{ formFieldName: 'form1.Name', dataPath: 'name', type: 'text' }],
        { name: '' }
      );
      expect(skippedFields).toContain('form1.Name');
    });

    test('skips fields with null data', () => {
      const { skippedFields } = buildFieldData(
        [{ formFieldName: 'form1.Name', dataPath: 'name', type: 'text' }],
        { name: null }
      );
      expect(skippedFields).toContain('form1.Name');
    });

    test('uses custom format function when provided', () => {
      const maps: AcroFormFieldMap[] = [
        {
          formFieldName: 'form1.Amount',
          dataPath: 'salary',
          type: 'text',
          format: (v) => `$${Number(v).toLocaleString()}`,
        },
      ];
      const { fieldData } = buildFieldData(maps, { salary: 85000 });
      expect(fieldData['form1.Amount']).toBe('$85,000');
    });

    test('handles checkbox type as pass-through', () => {
      const maps: AcroFormFieldMap[] = [
        { formFieldName: 'form1.Check', dataPath: 'agree', type: 'checkbox' },
      ];
      const { fieldData } = buildFieldData(maps, { agree: 'Yes' });
      expect(fieldData['form1.Check']).toBe('Yes');
    });

    test('handles dropdown type as pass-through', () => {
      const maps: AcroFormFieldMap[] = [
        { formFieldName: 'form1.Country', dataPath: 'country', type: 'dropdown' },
      ];
      const { fieldData } = buildFieldData(maps, { country: 'USA' });
      expect(fieldData['form1.Country']).toBe('USA');
    });

    test('returns empty fieldData for completely missing data', () => {
      const { fieldData, skippedFields } = buildFieldData(SAMPLE_FIELD_MAPS, {});
      expect(Object.keys(fieldData)).toHaveLength(0);
      expect(skippedFields).toHaveLength(SAMPLE_FIELD_MAPS.length);
    });
  });

  // -----------------------------------------------------------------------
  // deriveFormType — edge case tests
  // -----------------------------------------------------------------------
  describe('deriveFormType', () => {
    test('derives I-130 from standard path', () => {
      expect(deriveFormType('/path/to/templates/i-130.pdf')).toBe('I-130');
    });

    test('derives N-400 from standard path', () => {
      expect(deriveFormType('/path/to/templates/n-400.pdf')).toBe('N-400');
    });

    test('derives G-1145 from standard path', () => {
      expect(deriveFormType('/path/to/templates/g-1145.pdf')).toBe('G-1145');
    });

    test('handles uppercase template filename', () => {
      expect(deriveFormType('/path/to/templates/I-485.pdf')).toBe('I-485');
    });

    test('handles deeply nested path', () => {
      expect(deriveFormType('/var/data/uscis/forms/archive/i-765.pdf')).toBe('I-765');
    });

    test('returns uppercased basename for unknown form types (logs warning)', () => {
      // Unknown form types are still derived, just with a warning logged
      expect(deriveFormType('/path/to/templates/x-999.pdf')).toBe('X-999');
    });

    test('handles path with no directory', () => {
      expect(deriveFormType('i-131.pdf')).toBe('I-131');
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — successful fill via HTTP
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — successful fill', () => {
    test('returns success with correct stats from service', async () => {
      mockFetchSuccess(4, 6);

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.filledFieldCount).toBe(4);
      expect(result.totalFieldCount).toBe(SAMPLE_FIELD_MAPS.length);
      expect(result.errors).toHaveLength(0);
    });

    test('sends correct request to PDF service', async () => {
      mockFetchSuccess(6, 6);

      await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://pdf-service.test.railway.app/fill-pdf');
      expect(options?.method).toBe('POST');
      expect((options?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-secret-token-1234');

      const body = JSON.parse(options?.body as string);
      expect(body.form_type).toBe('I-130');
      expect(body.field_data['form1.LastName']).toBe('DOE');
      expect(body.field_data['form1.DOB']).toBe('06/15/1990');
      expect(body.field_data['form1.SSN']).toBe('123-45-6789');
    });

    test('passes service errors through to FillResult.errors', async () => {
      mockFetchSuccess(5, 6, ['form1.BadField: element not found']);

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(true);
      expect(result.errors).toContain('form1.BadField: element not found');
    });

    test('derives form type from template path', async () => {
      mockFetchSuccess(1, 1);

      await fillXFAPdf('/path/to/templates/n-400.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(body.form_type).toBe('N-400');
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — service not configured
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — service not configured', () => {
    test('returns failure when PDF_SERVICE_URL is not set', async () => {
      delete process.env.PDF_SERVICE_URL;

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not configured');
    });

    test('returns failure when PDF_SERVICE_SECRET is not set', async () => {
      delete process.env.PDF_SERVICE_SECRET;

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not configured');
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — HTTP error handling
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — HTTP error handling', () => {
    test('returns failure on 401 auth error', async () => {
      mockFetchHttpError(401, 'Invalid service token');

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('401');
      expect(result.errors[0]).toContain('Invalid service token');
    });

    test('returns failure on 422 validation error', async () => {
      mockFetchHttpError(422, 'Unknown form type: X-999');

      const result = await fillXFAPdf('/tmp/uscis-templates/x-999.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('422');
    });

    test('returns failure on 500 server error', async () => {
      mockFetchHttpError(500, 'Internal server error');

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('500');
    });

    test('returns failure on network error', async () => {
      mockFetchNetworkError('fetch failed');

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('PDF service unavailable');
      expect(result.errors[0]).toContain('fetch failed');
    });

    test('returns failure on abort/timeout', async () => {
      mockFetchNetworkError('The operation was aborted');

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('PDF service unavailable');
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — skipped fields
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — skipped fields', () => {
    test('reports skipped fields for missing data', async () => {
      mockFetchSuccess(1, 1);

      const result = await fillXFAPdf(
        '/tmp/uscis-templates/i-130.pdf',
        SAMPLE_FIELD_MAPS,
        { applicant: { lastName: 'Smith' } }
      );

      expect(result.skippedFields).toContain('form1.FirstName');
      expect(result.skippedFields).toContain('form1.DOB');
      expect(result.skippedFields).toContain('form1.SSN');
    });

    test('reports all fields skipped for empty data', async () => {
      mockFetchSuccess(0, 0);

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, {});

      expect(result.skippedFields).toHaveLength(SAMPLE_FIELD_MAPS.length);
      expect(result.totalFieldCount).toBe(SAMPLE_FIELD_MAPS.length);
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — edge cases
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — edge cases', () => {
    test('handles empty response body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Fill-Stats': JSON.stringify({ filled: 0, total: 0, errors: [] }) }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }));

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('empty response');
    });

    test('handles missing X-Fill-Stats header gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(FAKE_PDF_BYTES.buffer.slice(0)),
      }));

      const result = await fillXFAPdf('/tmp/uscis-templates/i-130.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      // Falls back to counting field_data keys
      expect(result.filledFieldCount).toBe(Object.keys(buildFieldData(SAMPLE_FIELD_MAPS, SAMPLE_DATA).fieldData).length);
    });
  });
});
