import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function to merge class names with clsx
 * Used throughout the app for conditional styling
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format number with locale-aware separators
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/**
 * Format currency with $ symbol
 */
export function formatCurrency(value: number): string {
  return `$${formatNumber(value)}`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
