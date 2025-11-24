/**
 * Vitest Global Test Setup
 *
 * This file runs before all tests and sets up the test environment.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// =============================================================================
// Environment Variables
// =============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/paimon_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3002'; // Use different port for tests

// =============================================================================
// Global Setup
// =============================================================================

beforeAll(async () => {
  // Setup that runs once before all tests
  console.log('🧪 Test suite starting...');
});

afterAll(async () => {
  // Cleanup that runs once after all tests
  console.log('✅ Test suite completed');
});

// =============================================================================
// Per-Test Setup
// =============================================================================

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// =============================================================================
// Global Test Utilities
// =============================================================================

// Add any global test utilities here
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      // Add global types if needed
    }
  }
}
