/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },

  // Test patterns
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Verbose output
  verbose: true,
};

module.exports = config;
