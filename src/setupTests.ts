import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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

// Mock environment variables for testing
// Note: NODE_ENV is set by vitest automatically
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
