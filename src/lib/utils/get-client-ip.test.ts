import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getClientIp } from './get-client-ip';

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'GET',
    headers: new Headers(headers),
  });
}

describe('getClientIp', () => {
  describe('X-Forwarded-For header', () => {
    it('should return the single IP from X-Forwarded-For', () => {
      const request = createRequest({ 'x-forwarded-for': '192.168.1.1' });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('should return the first IP from a comma-separated X-Forwarded-For list', () => {
      const request = createRequest({
        'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
      });

      expect(getClientIp(request)).toBe('203.0.113.50');
    });

    it('should trim whitespace from the first IP in X-Forwarded-For', () => {
      const request = createRequest({
        'x-forwarded-for': '  10.0.0.1  , 192.168.0.1',
      });

      expect(getClientIp(request)).toBe('10.0.0.1');
    });

    it('should handle IPv6 addresses in X-Forwarded-For', () => {
      const request = createRequest({
        'x-forwarded-for': '2001:db8::1, 192.168.1.1',
      });

      expect(getClientIp(request)).toBe('2001:db8::1');
    });

    it('should handle ::1 (IPv6 localhost) in X-Forwarded-For', () => {
      const request = createRequest({
        'x-forwarded-for': '::1',
      });

      expect(getClientIp(request)).toBe('::1');
    });
  });

  describe('X-Real-IP header', () => {
    it('should return X-Real-IP when X-Forwarded-For is absent', () => {
      const request = createRequest({ 'x-real-ip': '172.16.0.1' });

      expect(getClientIp(request)).toBe('172.16.0.1');
    });

    it('should return X-Real-IP when X-Forwarded-For is absent (IPv6)', () => {
      const request = createRequest({ 'x-real-ip': '::ffff:192.168.1.1' });

      expect(getClientIp(request)).toBe('::ffff:192.168.1.1');
    });
  });

  describe('header priority', () => {
    it('should prefer X-Forwarded-For over X-Real-IP', () => {
      const request = createRequest({
        'x-forwarded-for': '10.0.0.1',
        'x-real-ip': '10.0.0.2',
      });

      expect(getClientIp(request)).toBe('10.0.0.1');
    });
  });

  describe('fallback behavior', () => {
    it('should return "anonymous" when no IP headers are present', () => {
      const request = createRequest({});

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" when only unrelated headers are present', () => {
      const request = createRequest({
        'user-agent': 'Mozilla/5.0',
        'accept': 'application/json',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });
  });

  describe('X-Real-IP trimming', () => {
    it('should trim whitespace from X-Real-IP', () => {
      const request = createRequest({ 'x-real-ip': ' 192.168.1.1 ' });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });
  });

  describe('empty / whitespace X-Forwarded-For', () => {
    it('should return "anonymous" when X-Forwarded-For is only commas', () => {
      const request = createRequest({ 'x-forwarded-for': ',' });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" when X-Forwarded-For is empty string', () => {
      const request = createRequest({ 'x-forwarded-for': '' });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" when X-Forwarded-For is only whitespace', () => {
      const request = createRequest({ 'x-forwarded-for': '   ' });

      expect(getClientIp(request)).toBe('anonymous');
    });
  });

  describe('sanitization / non-IP values', () => {
    it('should return "anonymous" for XSS payload in X-Forwarded-For', () => {
      const request = createRequest({
        'x-forwarded-for': '<script>alert(1)</script>',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return first valid IP even if later entries are invalid', () => {
      const request = createRequest({
        'x-forwarded-for': '192.168.1.1, <script>',
      });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('should return "anonymous" for non-IP string in X-Forwarded-For', () => {
      const request = createRequest({
        'x-forwarded-for': 'not-an-ip',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" for non-IP string in X-Real-IP', () => {
      const request = createRequest({
        'x-real-ip': 'not-an-ip',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });
  });

  describe('edge cases', () => {
    it('should handle X-Forwarded-For with single space-separated IP', () => {
      // Split is on comma, so a single entry with no comma returns whole string
      const request = createRequest({
        'x-forwarded-for': '192.168.1.100',
      });

      expect(getClientIp(request)).toBe('192.168.1.100');
    });

    it('should handle a loopback address', () => {
      const request = createRequest({
        'x-forwarded-for': '127.0.0.1',
      });

      expect(getClientIp(request)).toBe('127.0.0.1');
    });

    it('should accept a full IPv6 address in X-Real-IP', () => {
      const request = createRequest({
        'x-real-ip': '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });

      expect(getClientIp(request)).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should return "anonymous" for digit-only string that looks like an IP but has no dots', () => {
      const request = createRequest({
        'x-forwarded-for': '1234567890',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" for dots-only string', () => {
      const request = createRequest({
        'x-forwarded-for': '...',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" for colons-only string', () => {
      const request = createRequest({
        'x-forwarded-for': '::::',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });

    it('should return "anonymous" for hex-only string without colons', () => {
      const request = createRequest({
        'x-forwarded-for': 'aFaFaFaF',
      });

      expect(getClientIp(request)).toBe('anonymous');
    });
  });
});
