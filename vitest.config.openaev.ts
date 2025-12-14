import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/openaev/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/shared/api/openaev-client.ts',
        'src/shared/detection/**/*.ts',
        'src/shared/utils/storage.ts',
      ],
    },
    // Longer timeout for integration tests with real OpenAEV instance
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run tests sequentially to avoid race conditions with OpenAEV
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Environment variables for OpenAEV connection
    env: {
      OPENAEV_URL: process.env.OPENAEV_URL || 'http://localhost:8080',
      OPENAEV_TOKEN: process.env.OPENAEV_TOKEN || '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
