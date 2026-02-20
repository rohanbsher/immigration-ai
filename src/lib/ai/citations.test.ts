import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

const mockCreate = vi.fn();

vi.mock('./client', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
}));

vi.mock('./circuit-breaker', () => ({
  anthropicBreaker: {
    execute: (fn: () => Promise<unknown>) => fn(),
  },
}));

vi.mock('@/lib/utils/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  AI_RETRY_OPTIONS: { maxRetries: 2 },
}));

import {
  parseCitationsFromResponse,
  mapCitationsToFields,
  hasCitations,
  countCitations,
  generateFieldCitations,
} from './citations';
import type { FormFieldWithCitations } from './types';

// ---------------------------------------------------------------------------
// parseCitationsFromResponse
// ---------------------------------------------------------------------------

describe('parseCitationsFromResponse', () => {
  it('parses char_location citations', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'Some text',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'John Doe',
              document_index: 0,
              start_char_index: 10,
              end_char_index: 18,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'document',
      citedText: 'John Doe',
      startIndex: 10,
      endIndex: 18,
      documentId: undefined,
      documentType: undefined,
    });
  });

  it('parses page_location citations', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'Some text',
          citations: [
            {
              type: 'page_location' as const,
              cited_text: 'Passport Number: AB123',
              document_index: 0,
              start_page_number: 1,
              end_page_number: 1,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'document',
      citedText: 'Passport Number: AB123',
      pageNumber: 1,
      documentId: undefined,
      documentType: undefined,
    });
  });

  it('parses content_block_location citations', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'Some text',
          citations: [
            {
              type: 'content_block_location' as const,
              cited_text: 'Date of Birth: 1990-01-15',
              document_index: 0,
              start_block_index: 0,
              end_block_index: 1,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'document',
      citedText: 'Date of Birth: 1990-01-15',
      documentId: undefined,
      documentType: undefined,
    });
    // content_block_location does not map to startIndex/endIndex/pageNumber
    expect(result[0].startIndex).toBeUndefined();
    expect(result[0].endIndex).toBeUndefined();
    expect(result[0].pageNumber).toBeUndefined();
  });

  it('returns empty array for empty response', () => {
    expect(parseCitationsFromResponse({})).toEqual([]);
    expect(parseCitationsFromResponse({ content: [] })).toEqual([]);
  });

  it('skips text blocks without citations', () => {
    const response = {
      content: [
        { type: 'text', text: 'No citations here' },
        {
          type: 'text',
          text: 'Has citation',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'Jane Smith',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 10,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].citedText).toBe('Jane Smith');
  });

  it('skips non-text blocks', () => {
    const response = {
      content: [
        { type: 'tool_use', id: 'tool_1' },
        {
          type: 'text',
          text: 'Has citation',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'found it',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 8,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);
    expect(result).toHaveLength(1);
  });

  it('resolves document info from documentMap', () => {
    const docMap = new Map([
      [0, { documentId: 'doc-abc', documentType: 'passport' }],
    ]);

    const response = {
      content: [
        {
          type: 'text',
          text: 'Text',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'John Doe',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 8,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response, docMap);
    expect(result[0].documentId).toBe('doc-abc');
    expect(result[0].documentType).toBe('passport');
  });

  it('falls back to document_title when no docMap entry', () => {
    const docMap = new Map<number, { documentId: string; documentType: string }>();

    const response = {
      content: [
        {
          type: 'text',
          text: 'Text',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'Some data',
              document_index: 5,
              document_title: 'employment_letter.pdf',
              start_char_index: 0,
              end_char_index: 9,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response, docMap);
    expect(result[0].documentId).toBeUndefined();
    expect(result[0].documentType).toBe('employment_letter.pdf');
  });

  it('handles multiple citations on a single text block', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'Response referencing multiple passages',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: 'First passage',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 13,
            },
            {
              type: 'page_location' as const,
              cited_text: 'Second passage',
              document_index: 1,
              start_page_number: 2,
              end_page_number: 3,
            },
            {
              type: 'content_block_location' as const,
              cited_text: 'Third passage',
              document_index: 0,
              start_block_index: 1,
              end_block_index: 2,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);
    expect(result).toHaveLength(3);
    expect(result[0].citedText).toBe('First passage');
    expect(result[0].startIndex).toBe(0);
    expect(result[1].citedText).toBe('Second passage');
    expect(result[1].pageNumber).toBe(2);
    expect(result[2].citedText).toBe('Third passage');
  });

  it('skips citations with empty cited_text', () => {
    const response = {
      content: [
        {
          type: 'text',
          text: 'Text',
          citations: [
            {
              type: 'char_location' as const,
              cited_text: '',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 0,
            },
            {
              type: 'char_location' as const,
              cited_text: 'Valid text',
              document_index: 0,
              start_char_index: 5,
              end_char_index: 15,
            },
          ],
        },
      ],
    };

    const result = parseCitationsFromResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].citedText).toBe('Valid text');
  });
});

// ---------------------------------------------------------------------------
// mapCitationsToFields
// ---------------------------------------------------------------------------

describe('mapCitationsToFields', () => {
  const makeField = (
    id: string,
    value?: string
  ): FormFieldWithCitations => ({
    field_id: id,
    field_name: id,
    field_type: 'text',
    suggested_value: value,
  });

  it('returns fields unchanged when no citations', () => {
    const fields = [makeField('f1', 'John')];
    const result = mapCitationsToFields([], fields);
    expect(result).toEqual(fields);
  });

  it('matches citation to field by substring', () => {
    const citations = [
      { type: 'document' as const, citedText: 'John Doe', documentId: 'd1' },
    ];
    const fields = [makeField('name', 'John Doe')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
    expect(result[0].citations![0].citedText).toBe('John Doe');
  });

  it('skips fields with no suggested_value', () => {
    const citations = [
      { type: 'document' as const, citedText: 'John Doe' },
    ];
    const fields = [makeField('name')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('skips values shorter than 3 characters', () => {
    const citations = [
      { type: 'document' as const, citedText: 'NY is great' },
    ];
    const fields = [makeField('state', 'NY')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('rejects matches where ratio is too low', () => {
    const citations = [
      { type: 'document' as const, citedText: 'Johnson & Johnson LLC International' },
    ];
    const fields = [makeField('name', 'John')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toBeUndefined();
  });

  it('matches when field value is substring of cited text', () => {
    const citations = [
      { type: 'document' as const, citedText: 'Name: Jane Smith' },
    ];
    const fields = [makeField('name', 'Jane Smith')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
  });

  it('matches when cited text is substring of field value', () => {
    const citations = [
      { type: 'document' as const, citedText: 'Jane Smith' },
    ];
    const fields = [makeField('name', 'Jane Smith Doe')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
  });

  it('is case insensitive', () => {
    const citations = [
      { type: 'document' as const, citedText: 'JOHN DOE' },
    ];
    const fields = [makeField('name', 'john doe')];

    const result = mapCitationsToFields(citations, fields);
    expect(result[0].citations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// hasCitations / countCitations
// ---------------------------------------------------------------------------

describe('hasCitations', () => {
  it('returns false when no fields have citations', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'f1', field_name: 'f1', field_type: 'text' },
    ];
    expect(hasCitations(fields)).toBe(false);
  });

  it('returns true when at least one field has citations', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'f1', field_name: 'f1', field_type: 'text' },
      {
        field_id: 'f2',
        field_name: 'f2',
        field_type: 'text',
        citations: [{ type: 'document', citedText: 'Cited' }],
      },
    ];
    expect(hasCitations(fields)).toBe(true);
  });

  it('returns false when citations array is empty', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'f1', field_name: 'f1', field_type: 'text', citations: [] },
    ];
    expect(hasCitations(fields)).toBe(false);
  });
});

describe('countCitations', () => {
  it('returns 0 when no citations', () => {
    const fields: FormFieldWithCitations[] = [
      { field_id: 'f1', field_name: 'f1', field_type: 'text' },
    ];
    expect(countCitations(fields)).toBe(0);
  });

  it('sums citations across fields', () => {
    const fields: FormFieldWithCitations[] = [
      {
        field_id: 'f1',
        field_name: 'f1',
        field_type: 'text',
        citations: [
          { type: 'document', citedText: 'A' },
          { type: 'document', citedText: 'B' },
        ],
      },
      {
        field_id: 'f2',
        field_name: 'f2',
        field_type: 'text',
        citations: [{ type: 'document', citedText: 'C' }],
      },
    ];
    expect(countCitations(fields)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// generateFieldCitations
// ---------------------------------------------------------------------------

describe('generateFieldCitations', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('calls API with document content blocks and citations enabled', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'The name is John Doe.',
          citations: [
            {
              type: 'char_location',
              cited_text: 'John Doe',
              document_index: 0,
              start_char_index: 15,
              end_char_index: 23,
            },
          ],
        },
      ],
    });

    const result = await generateFieldCitations({
      documents: [
        {
          documentId: 'doc-1',
          documentType: 'passport',
          rawText: 'Full Name: John Doe, DOB: 1990-01-15',
        },
      ],
      fields: [
        { fieldId: 'name', fieldName: 'Full Name', suggestedValue: 'John Doe' },
      ],
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
    expect(callArgs.max_tokens).toBe(4096);

    // First content block should be the document
    const userContent = callArgs.messages[0].content;
    expect(userContent[0].type).toBe('document');
    expect(userContent[0].source.type).toBe('text');
    expect(userContent[0].source.media_type).toBe('text/plain');
    expect(userContent[0].source.data).toContain('John Doe');
    expect(userContent[0].citations).toEqual({ enabled: true });
    expect(userContent[0].cache_control).toEqual({ type: 'ephemeral' });

    // Last content block should be the text prompt
    const lastBlock = userContent[userContent.length - 1];
    expect(lastBlock.type).toBe('text');
    expect(lastBlock.text).toContain('Full Name');
    expect(lastBlock.text).toContain('John Doe');

    // Should return parsed citations
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].citedText).toBe('John Doe');
    expect(result.citations[0].documentId).toBe('doc-1');
    expect(result.citations[0].documentType).toBe('passport');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns empty citations without API call when no documents', async () => {
    const result = await generateFieldCitations({
      documents: [],
      fields: [
        { fieldId: 'name', fieldName: 'Name', suggestedValue: 'John' },
      ],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
  });

  it('returns empty citations without API call when no fields', async () => {
    const result = await generateFieldCitations({
      documents: [
        { documentId: 'doc-1', documentType: 'passport', rawText: 'content' },
      ],
      fields: [],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
  });

  it('filters out documents with empty rawText', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'No citations found.' }],
    });

    await generateFieldCitations({
      documents: [
        { documentId: 'doc-1', documentType: 'passport', rawText: '' },
        { documentId: 'doc-2', documentType: 'passport', rawText: '   ' },
        { documentId: 'doc-3', documentType: 'letter', rawText: 'Valid content' },
      ],
      fields: [
        { fieldId: 'name', fieldName: 'Name', suggestedValue: 'John' },
      ],
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    // Only one document block (doc-3)
    const docBlocks = userContent.filter(
      (b: { type: string }) => b.type === 'document'
    );
    expect(docBlocks).toHaveLength(1);
    expect(docBlocks[0].source.data).toBe('Valid content');
  });

  it('returns empty citations when all documents have empty rawText', async () => {
    const result = await generateFieldCitations({
      documents: [
        { documentId: 'doc-1', documentType: 'passport', rawText: '' },
        { documentId: 'doc-2', documentType: 'letter', rawText: '  ' },
      ],
      fields: [
        { fieldId: 'name', fieldName: 'Name', suggestedValue: 'John' },
      ],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
  });

  it('returns empty citations on API error (best-effort)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

    const result = await generateFieldCitations({
      documents: [
        { documentId: 'doc-1', documentType: 'passport', rawText: 'Some text' },
      ],
      fields: [
        { fieldId: 'name', fieldName: 'Name', suggestedValue: 'John' },
      ],
    });

    expect(result.citations).toEqual([]);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('maps multiple documents to correct document indices', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Found references.',
          citations: [
            {
              type: 'char_location',
              cited_text: 'John Doe',
              document_index: 0,
              start_char_index: 0,
              end_char_index: 8,
            },
            {
              type: 'char_location',
              cited_text: 'Acme Corp',
              document_index: 1,
              start_char_index: 0,
              end_char_index: 9,
            },
          ],
        },
      ],
    });

    const result = await generateFieldCitations({
      documents: [
        { documentId: 'doc-passport', documentType: 'passport', rawText: 'John Doe ...' },
        { documentId: 'doc-letter', documentType: 'employment_letter', rawText: 'Acme Corp ...' },
      ],
      fields: [
        { fieldId: 'name', fieldName: 'Name', suggestedValue: 'John Doe' },
        { fieldId: 'employer', fieldName: 'Employer', suggestedValue: 'Acme Corp' },
      ],
    });

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0].documentId).toBe('doc-passport');
    expect(result.citations[0].documentType).toBe('passport');
    expect(result.citations[1].documentId).toBe('doc-letter');
    expect(result.citations[1].documentType).toBe('employment_letter');
  });
});
