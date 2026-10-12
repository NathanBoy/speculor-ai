import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli/index.ts'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 90,
        branches: 80,
      },
    },
  },
});
