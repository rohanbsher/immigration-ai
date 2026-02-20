import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { safeParseBody } from './safe-parse-body';

function createJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createRawRequest(body: string, contentType = 'application/json'): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

describe('safeParseBody', () => {
  describe('valid JSON parsing', () => {
    it('should parse a valid JSON object', async () => {
      const request = createJsonRequest({ name: 'Test', age: 25 });

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'Test', age: 25 });
      }
    });

    it('should parse a valid JSON array', async () => {
      const request = createJsonRequest([1, 2, 3]);

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should parse a valid JSON string value', async () => {
      const request = createRawRequest('"hello"');

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('should parse a valid JSON number value', async () => {
      const request = createRawRequest('42');

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should parse null JSON value', async () => {
      const request = createRawRequest('null');

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should parse nested JSON objects', async () => {
      const nested = {
        user: { name: 'Test', address: { city: 'NYC' } },
        tags: ['a', 'b'],
      };
      const request = createJsonRequest(nested);

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(nested);
      }
    });

    it('should parse JSON with unicode characters', async () => {
      const request = createJsonRequest({ name: '\u00e9\u00e8\u00ea', emoji: '\ud83c\udf1f' });

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, string>;
        expect(data.name).toBe('\u00e9\u00e8\u00ea');
      }
    });

    it('should parse empty JSON object', async () => {
      const request = createJsonRequest({});

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });

  describe('invalid JSON handling', () => {
    it('should return error response for invalid JSON', async () => {
      const request = createRawRequest('this is not json');

      const result = await safeParseBody(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const body = await result.response.json();
        expect(body.error).toBe('Invalid JSON in request body');
      }
    });

    it('should return error response for truncated JSON', async () => {
      const request = createRawRequest('{"name": "test"');

      const result = await safeParseBody(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });

    it('should return error response for empty body', async () => {
      const request = createRawRequest('');

      const result = await safeParseBody(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });

    it('should return error response for malformed JSON with trailing comma', async () => {
      const request = createRawRequest('{"name": "test",}');

      const result = await safeParseBody(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });
  });

  describe('type parameter', () => {
    it('should return typed data when generic is provided', async () => {
      interface TestData {
        name: string;
        value: number;
      }
      const request = createJsonRequest({ name: 'test', value: 42 });

      const result = await safeParseBody<TestData>(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test');
        expect(result.data.value).toBe(42);
      }
    });
  });

  describe('discriminated union shape', () => {
    it('success branch should have data property', async () => {
      const request = createJsonRequest({ ok: true });

      const result = await safeParseBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(result).not.toHaveProperty('response');
      }
    });

    it('failure branch should have response property', async () => {
      const request = createRawRequest('bad');

      const result = await safeParseBody(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result).toHaveProperty('response');
        expect(result).not.toHaveProperty('data');
      }
    });
  });
});
