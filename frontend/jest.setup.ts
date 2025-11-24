/**
 * Jest Global Test Setup for Next.js
 */

// TextEncoder/TextDecoder polyfill for viem compatibility
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// =============================================================================
// Mock Environment Variables
// =============================================================================

process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'test-project-id';
process.env.NEXT_PUBLIC_PNGY_VAULT_ADDRESS = '0x0000000000000000000000000000000000000000';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';

// =============================================================================
// Mock window.matchMedia
// =============================================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// =============================================================================
// Mock IntersectionObserver
// =============================================================================

const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

// =============================================================================
// Mock ResizeObserver
// =============================================================================

window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as unknown as typeof ResizeObserver;

// =============================================================================
// Suppress console warnings in tests
// =============================================================================

const originalError = console.error;
console.error = (...args) => {
  // Suppress specific React warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render') ||
      args[0].includes('Warning: An update to'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
