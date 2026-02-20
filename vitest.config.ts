import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**', 'services/**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'services/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/setupTests.ts',
        'src/__mocks__/**',
        'src/lib/jobs/connection.ts',
        'src/lib/jobs/queues.ts',
      ],
      thresholds: {
        statements: 75,
        branches: 69,
        functions: 75,
        lines: 75,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
