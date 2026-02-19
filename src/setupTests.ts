import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfill Blob.prototype.arrayBuffer for jsdom
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/headers for server components
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Map(),
}));

// Mock @/lib/config for modules that import it
// This prevents serverEnv access errors in jsdom environment
vi.mock('@/lib/config', async () => {
  const actual = await import('./__mocks__/config');
  return actual;
});

// Mock environment variables for testing
// Note: NODE_ENV is set by vitest automatically
// These are required for modules that import @/lib/config
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-12345';
}
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = '0'.repeat(64); // Test encryption key
}

// Suppress console warnings in tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('[Crypto] WARNING') ||
        message.includes('ReactDOM.render'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}
