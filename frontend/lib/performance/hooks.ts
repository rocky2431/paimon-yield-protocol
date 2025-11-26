'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounce hook - Delays function execution until after wait milliseconds
 * Optimizes INP by reducing excessive function calls
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook - Returns a debounced version of the callback
 * Useful for search inputs, form validation, etc.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttle hook - Limits function execution to once per wait milliseconds
 * Useful for scroll handlers, resize events
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now - lastRan.current >= limit) {
      lastRan.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastRan.current = Date.now();
        setThrottledValue(value);
      }, limit - (now - lastRan.current));

      return () => clearTimeout(timer);
    }
  }, [value, limit]);

  return throttledValue;
}

/**
 * Intersection Observer hook - Lazy load components when they enter viewport
 * Reduces initial bundle size and improves LCP
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, no need to observe
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options]);

  return [elementRef, isVisible];
}

/**
 * Idle callback hook - Defers non-critical work to idle periods
 * Improves INP by not blocking main thread
 */
export function useIdleCallback(
  callback: () => void,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    } else {
      // Fallback for Safari
      const id = setTimeout(callback, 1);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Preload image hook - Preloads an image in the background
 * Improves LCP for above-the-fold images
 */
export function usePreloadImage(src: string): boolean {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.src = src;

    if (img.complete) {
      setIsLoaded(true);
    } else {
      img.onload = () => setIsLoaded(true);
      img.onerror = () => setIsLoaded(false);
    }

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return isLoaded;
}

// Type declarations for requestIdleCallback
declare global {
  interface Window {
    requestIdleCallback: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback: (handle: number) => void;
  }
}
