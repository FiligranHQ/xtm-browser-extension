import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/shared/**/*.ts',
        'src/background/**/*.ts',
        'src/content/**/*.ts',
        'src/panel/**/*.ts',
        'src/popup/**/*.ts',
        'src/options/**/*.ts',
        'src/pdf-scanner/**/*.ts',
      ],
      exclude: [
        'src/**/*.tsx',
        'src/**/*.d.ts',
        'src/**/index.html',
        'src/**/main.tsx',
        'node_modules/**',
        'dist/**',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
