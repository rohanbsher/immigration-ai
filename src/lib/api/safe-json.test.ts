import { describe, it, expect } from 'vitest';
import { safeParseErrorJson, getErrorMessage } from './safe-json';

/**
 * Helper to create a mock Response object with configurable body and headers.
 */
function createMockResponse(
  body: string | null,
  init: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  const { status = 500, statusText = 'Internal Server Error', headers = {} } = init;
  return new Response(body, {
    status,
    statusText,
    headers: new Headers(headers),
  });
}

describe('safe-json', () => {
  describe('safeParseErrorJson', () => {
    it('should parse valid JSON response with application/json content-type', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Something went wrong' }),
        { headers: { 'content-type': 'application/json' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Something went wrong' });
    });

    it('should parse JSON with charset in content-type', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Bad request', message: 'Invalid input' }),
        { headers: { 'content-type': 'application/json; charset=utf-8' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Bad request', message: 'Invalid input' });
    });

    it('should return fallback when content-type is not JSON', async () => {
      const response = createMockResponse(
        '<html><body>502 Bad Gateway</body></html>',
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'content-type': 'text/html' },
        }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Bad Gateway' });
    });

    it('should return fallback when content-type header is missing', async () => {
      const response = createMockResponse('not json', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Internal Server Error' });
    });

    it('should return fallback when JSON parsing fails despite JSON content-type', async () => {
      const response = createMockResponse('this is not valid json {{{', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
      });

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Internal Server Error' });
    });

    it('should use status code fallback when statusText is empty', async () => {
      const response = createMockResponse('', {
        status: 503,
        statusText: '',
        headers: { 'content-type': 'text/plain' },
      });

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Request failed with status 503' });
    });

    it('should handle JSON with message field only', async () => {
      const response = createMockResponse(
        JSON.stringify({ message: 'Not found' }),
        { headers: { 'content-type': 'application/json' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ message: 'Not found' });
    });

    it('should handle JSON with both error and message fields', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Validation error', message: 'Name is required' }),
        { headers: { 'content-type': 'application/json' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({ error: 'Validation error', message: 'Name is required' });
    });

    it('should handle JSON with unicode characters', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Erreur: caract\u00e8res sp\u00e9ciaux' }),
        { headers: { 'content-type': 'application/json' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result.error).toContain('sp\u00e9ciaux');
    });

    it('should handle empty JSON object', async () => {
      const response = createMockResponse(
        '{}',
        { headers: { 'content-type': 'application/json' } }
      );

      const result = await safeParseErrorJson(response);

      expect(result).toEqual({});
    });
  });

  describe('getErrorMessage', () => {
    it('should extract error field from JSON response', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        }
      );

      const message = await getErrorMessage(response);

      expect(message).toBe('Unauthorized');
    });

    it('should extract message field when error is absent', async () => {
      const response = createMockResponse(
        JSON.stringify({ message: 'Resource not found' }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
        }
      );

      const message = await getErrorMessage(response);

      expect(message).toBe('Resource not found');
    });

    it('should prefer error field over message field', async () => {
      const response = createMockResponse(
        JSON.stringify({ error: 'Primary error', message: 'Secondary message' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );

      const message = await getErrorMessage(response);

      expect(message).toBe('Primary error');
    });

    it('should fall back to status text for non-JSON response', async () => {
      const response = createMockResponse(
        '<html>Gateway Error</html>',
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'content-type': 'text/html' },
        }
      );

      const message = await getErrorMessage(response);

      expect(message).toBe('Bad Gateway');
    });

    it('should fall back to status code when everything else is absent', async () => {
      const response = createMockResponse(null, {
        status: 503,
        statusText: '',
      });

      const message = await getErrorMessage(response);

      expect(message).toBe('Request failed with status 503');
    });

    it('should fall back to status code when JSON has neither error nor message', async () => {
      const response = createMockResponse(
        JSON.stringify({ code: 'ERR_001' }),
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/json' },
        }
      );

      const message = await getErrorMessage(response);

      expect(message).toBe('Request failed with status 422');
    });
  });
});
