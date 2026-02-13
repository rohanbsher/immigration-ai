/**
 * Unit tests for the XFA PDF filler engine.
 *
 * Mocks `child_process.execFile` and `fs/promises` to test the wrapper
 * logic without requiring Python or real USCIS PDF templates.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
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

// Mock child_process.execFile
const mockExecFile = vi.fn();
vi.mock(import('child_process'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual, execFile: (...args: unknown[]) => mockExecFile(...args) },
    execFile: ((...args: unknown[]) => mockExecFile(...args)) as typeof actual.execFile,
  };
});

// Track temp file operations
const writtenFiles = new Map<string, string>();
const unlinkedFiles: string[] = [];

vi.mock(import('fs/promises'), async (importOriginal) => {
  const actual = await importOriginal();
  const mockModule = {
    ...actual,
    access: vi.fn(async () => undefined), // output file always "exists" in tests
    writeFile: vi.fn(async (filePath: string, content: string) => {
      writtenFiles.set(filePath, content);
    }),
    readFile: vi.fn(async (filePath: string) => {
      // For the output PDF, return fake bytes
      if (typeof filePath === 'string' && filePath.includes('xfa-output')) {
        return Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      }
      // Delegate to real readFile for anything else (e.g. acroform-filler template loading)
      return actual.readFile(filePath);
    }),
    unlink: vi.fn(async (filePath: string) => {
      unlinkedFiles.push(filePath);
    }),
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

// Import AFTER mocks are set up
import { fillXFAPdf, buildFieldData } from './xfa-filler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulatePythonSuccess(filled: number, total: number, errors: string[] = []) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      cb(null, JSON.stringify({ filled, total, errors }), '');
    }
  );
}

function simulatePythonError(message: string) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      cb(new Error(message), '', message);
    }
  );
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
    writtenFiles.clear();
    unlinkedFiles.length = 0;
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
  // fillXFAPdf — successful fill
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — successful fill', () => {
    test('returns success with correct stats from Python', async () => {
      simulatePythonSuccess(4, 6);

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.filledFieldCount).toBe(4);
      expect(result.totalFieldCount).toBe(SAMPLE_FIELD_MAPS.length);
      expect(result.errors).toHaveLength(0);
    });

    test('writes correct JSON data to temp file', async () => {
      simulatePythonSuccess(6, 6);

      await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      // Find the data JSON that was written
      const jsonEntry = [...writtenFiles.entries()].find(([k]) => k.includes('xfa-data'));
      expect(jsonEntry).toBeDefined();

      const written = JSON.parse(jsonEntry![1]);
      expect(written['form1.LastName']).toBe('DOE');
      expect(written['form1.DOB']).toBe('06/15/1990');
      expect(written['form1.SSN']).toBe('123-45-6789');
    });

    test('calls Python with correct arguments', async () => {
      simulatePythonSuccess(6, 6);

      await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(mockExecFile).toHaveBeenCalledTimes(1);
      const [cmd, args] = mockExecFile.mock.calls[0];
      expect(cmd).toBe('python3');
      expect(args[0]).toContain('fill-xfa-pdf.py');
      expect(args[1]).toBe('/tmp/template.pdf');
      expect(args[2]).toContain('xfa-data');
      expect(args[3]).toContain('xfa-output');
    });

    test('passes Python errors through to FillResult.errors', async () => {
      simulatePythonSuccess(5, 6, ['form1.BadField: element not found']);

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(true);
      expect(result.errors).toContain('form1.BadField: element not found');
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — Python error handling
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — Python error handling', () => {
    test('returns failure when Python script errors', async () => {
      simulatePythonError('python3: command not found');

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.filledFieldCount).toBe(0);
      expect(result.errors[0]).toContain('Python fill failed');
      expect(result.errors[0]).toContain('python3: command not found');
    });

    test('returns failure when Python exits with non-zero', async () => {
      simulatePythonError('Exit code 1: No such file or directory');

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('handles malformed Python JSON output gracefully', async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
          cb(null, 'not-valid-json', '');
        }
      );

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      // Should still succeed (uses fallback stats)
      expect(result.success).toBe(true);
      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — temp file cleanup
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — temp file cleanup', () => {
    test('cleans up temp files after successful fill', async () => {
      simulatePythonSuccess(6, 6);

      await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      // Both data JSON and output PDF should be unlinked
      const dataUnlinked = unlinkedFiles.some((f) => f.includes('xfa-data'));
      const outputUnlinked = unlinkedFiles.some((f) => f.includes('xfa-output'));
      expect(dataUnlinked).toBe(true);
      expect(outputUnlinked).toBe(true);
    });

    test('cleans up temp files even when Python fails', async () => {
      simulatePythonError('script crashed');

      await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, SAMPLE_DATA);

      const dataUnlinked = unlinkedFiles.some((f) => f.includes('xfa-data'));
      const outputUnlinked = unlinkedFiles.some((f) => f.includes('xfa-output'));
      expect(dataUnlinked).toBe(true);
      expect(outputUnlinked).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // fillXFAPdf — skipped fields
  // -----------------------------------------------------------------------
  describe('fillXFAPdf — skipped fields', () => {
    test('reports skipped fields for missing data', async () => {
      simulatePythonSuccess(1, 1);

      const result = await fillXFAPdf(
        '/tmp/template.pdf',
        SAMPLE_FIELD_MAPS,
        { applicant: { lastName: 'Smith' } }
      );

      expect(result.skippedFields).toContain('form1.FirstName');
      expect(result.skippedFields).toContain('form1.DOB');
      expect(result.skippedFields).toContain('form1.SSN');
    });

    test('reports all fields skipped for empty data', async () => {
      simulatePythonSuccess(0, 0);

      const result = await fillXFAPdf('/tmp/template.pdf', SAMPLE_FIELD_MAPS, {});

      expect(result.skippedFields).toHaveLength(SAMPLE_FIELD_MAPS.length);
      expect(result.totalFieldCount).toBe(SAMPLE_FIELD_MAPS.length);
    });
  });
});
