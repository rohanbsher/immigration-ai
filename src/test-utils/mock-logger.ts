import { vi } from 'vitest';

export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  };
}

// For use with vi.mock('@/lib/logger')
export const mockLoggerModule = {
  createLogger: () => createMockLogger(),
};
