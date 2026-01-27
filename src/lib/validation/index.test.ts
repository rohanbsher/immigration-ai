import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  formatZodError,
  validate,
  validateSearchParams,
  schemas,
  type ValidationError,
  type ValidationResult,
} from './index';

describe('validation utilities', () => {
  describe('formatZodError', () => {
    it('should format a single field error', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      });

      const result = schema.safeParse({ name: '' });

      if (!result.success) {
        const formatted = formatZodError(result.error);

        expect(formatted.message).toBe('name: Name is required');
        expect(formatted.fieldErrors).toEqual({
          name: ['Name is required'],
        });
      }
    });

    it('should format multiple field errors', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      });

      const result = schema.safeParse({ name: '', email: 'not-an-email' });

      if (!result.success) {
        const formatted = formatZodError(result.error);

        expect(formatted.fieldErrors.name).toContain('Name is required');
        expect(formatted.fieldErrors.email).toContain('Invalid email');
      }
    });

    it('should handle nested field errors', () => {
      const schema = z.object({
        address: z.object({
          street: z.string().min(1, 'Street is required'),
          city: z.string().min(1, 'City is required'),
        }),
      });

      const result = schema.safeParse({ address: { street: '', city: '' } });

      if (!result.success) {
        const formatted = formatZodError(result.error);

        expect(formatted.fieldErrors['address.street']).toContain('Street is required');
        expect(formatted.fieldErrors['address.city']).toContain('City is required');
      }
    });

    it('should handle root-level errors', () => {
      const schema = z.string().min(5, 'Too short');
      const result = schema.safeParse('hi');

      if (!result.success) {
        const formatted = formatZodError(result.error);

        expect(formatted.fieldErrors._root).toContain('Too short');
        expect(formatted.message).toBe('Input: Too short');
      }
    });
  });

  describe('validate', () => {
    it('should return success with valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validate(schema, { name: 'John', age: 30 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 30 });
      }
    });

    it('should return failure with invalid data', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      });

      const result = validate(schema, { name: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.fieldErrors.name).toContain('Name is required');
      }
    });

    it('should handle type coercion', () => {
      const schema = z.object({
        count: z.coerce.number(),
      });

      const result = validate(schema, { count: '42' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(42);
      }
    });
  });

  describe('validateSearchParams', () => {
    it('should validate search params correctly', () => {
      const schema = z.object({
        page: z.coerce.number().default(1),
        query: z.string().optional(),
      });

      const params = new URLSearchParams('page=2&query=test');
      const result = validateSearchParams(params, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, query: 'test' });
      }
    });

    it('should handle multiple values for same key', () => {
      const schema = z.object({
        tags: z.array(z.string()).or(z.string()),
      });

      const params = new URLSearchParams('tags=a&tags=b&tags=c');
      const result = validateSearchParams(params, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(['a', 'b', 'c']);
      }
    });

    it('should return failure for invalid params', () => {
      const schema = z.object({
        page: z.coerce.number().min(1),
      });

      const params = new URLSearchParams('page=-1');
      const result = validateSearchParams(params, schema);

      expect(result.success).toBe(false);
    });
  });

  describe('schemas', () => {
    describe('uuid', () => {
      it('should validate valid UUIDs', () => {
        const validUuid = '550e8400-e29b-41d4-a716-446655440000';
        const result = schemas.uuid.safeParse(validUuid);
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUIDs', () => {
        const result = schemas.uuid.safeParse('not-a-uuid');
        expect(result.success).toBe(false);
      });
    });

    describe('email', () => {
      it('should validate valid emails', () => {
        const result = schemas.email.safeParse('test@example.com');
        expect(result.success).toBe(true);
      });

      it('should reject invalid emails', () => {
        const result = schemas.email.safeParse('not-an-email');
        expect(result.success).toBe(false);
      });
    });

    describe('pagination', () => {
      it('should provide defaults for missing fields', () => {
        const result = schemas.pagination.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({
            page: 1,
            limit: 10,
            sortOrder: 'desc',
          });
        }
      });

      it('should validate and coerce pagination params', () => {
        const result = schemas.pagination.safeParse({
          page: '5',
          limit: '20',
          sortBy: 'created_at',
          sortOrder: 'asc',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({
            page: 5,
            limit: 20,
            sortBy: 'created_at',
            sortOrder: 'asc',
          });
        }
      });

      it('should reject invalid pagination values', () => {
        const result = schemas.pagination.safeParse({
          page: 0, // must be >= 1
        });
        expect(result.success).toBe(false);
      });

      it('should enforce limit maximum', () => {
        const result = schemas.pagination.safeParse({
          limit: 500, // max is 100
        });
        expect(result.success).toBe(false);
      });
    });

    describe('dateString', () => {
      it('should validate valid date strings', () => {
        const result = schemas.dateString.safeParse('2024-01-15');
        expect(result.success).toBe(true);
      });

      it('should validate ISO date strings', () => {
        const result = schemas.dateString.safeParse('2024-01-15T10:30:00Z');
        expect(result.success).toBe(true);
      });

      it('should reject invalid date strings', () => {
        const result = schemas.dateString.safeParse('not-a-date');
        expect(result.success).toBe(false);
      });
    });

    describe('nonEmptyString', () => {
      it('should validate non-empty strings', () => {
        const result = schemas.nonEmptyString.safeParse('hello');
        expect(result.success).toBe(true);
      });

      it('should reject empty strings', () => {
        const result = schemas.nonEmptyString.safeParse('');
        expect(result.success).toBe(false);
      });
    });
  });
});
