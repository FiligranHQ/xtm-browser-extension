import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/opencti/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/shared/**/*.ts',
        'src/background/**/*.ts',
      ],
      exclude: [
        'src/**/*.tsx',
        'src/**/*.d.ts',
        'node_modules/**',
      ],
    },
    // Longer timeout for integration tests with real OpenCTI instance
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run tests sequentially to avoid race conditions with OpenCTI
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Environment variables for OpenCTI connection
    env: {
      OPENCTI_URL: process.env.OPENCTI_URL || 'http://localhost:8080',
      OPENCTI_TOKEN: process.env.OPENCTI_TOKEN || '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
