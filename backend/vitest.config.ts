import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],

    // Include/exclude patterns
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/__tests__/**',
        'src/index.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Test timeout
    testTimeout: 10000,

    // Reporter
    reporters: ['default'],

    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests serially for database tests
      },
    },
  },
});
