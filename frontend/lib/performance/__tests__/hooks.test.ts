import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useDebounce,
  useDebouncedCallback,
  useThrottle,
} from '../hooks';

// Mock timers for testing
jest.useFakeTimers();

describe('Performance Hooks', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('useDebounce', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 300));
      expect(result.current).toBe('initial');
    });

    it('should debounce value changes', async () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      );

      // Update value
      rerender({ value: 'updated', delay: 300 });

      // Value should not have changed yet
      expect(result.current).toBe('initial');

      // Fast-forward past the delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Now the value should be updated
      expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'v1', delay: 300 } }
      );

      // Rapid updates
      rerender({ value: 'v2', delay: 300 });
      act(() => {
        jest.advanceTimersByTime(100);
      });

      rerender({ value: 'v3', delay: 300 });
      act(() => {
        jest.advanceTimersByTime(100);
      });

      rerender({ value: 'v4', delay: 300 });

      // Still showing initial value
      expect(result.current).toBe('v1');

      // Fast-forward past the delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should show final value
      expect(result.current).toBe('v4');
    });

    it('should handle different data types', () => {
      // Number
      const { result: numberResult } = renderHook(() => useDebounce(42, 300));
      expect(numberResult.current).toBe(42);

      // Object
      const obj = { name: 'test' };
      const { result: objectResult } = renderHook(() => useDebounce(obj, 300));
      expect(objectResult.current).toBe(obj);

      // Array
      const arr = [1, 2, 3];
      const { result: arrayResult } = renderHook(() => useDebounce(arr, 300));
      expect(arrayResult.current).toBe(arr);
    });
  });

  describe('useDebouncedCallback', () => {
    it('should debounce callback execution', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      // Call multiple times
      act(() => {
        result.current('arg1');
        result.current('arg2');
        result.current('arg3');
      });

      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Callback should have been called once with last args
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg3');
    });

    it('should cancel pending callback on unmount', () => {
      const callback = jest.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current('test');
      });

      // Unmount before timer fires
      unmount();

      // Fast-forward
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Callback should not have been called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('useThrottle', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useThrottle('initial', 300));
      expect(result.current).toBe('initial');
    });

    it('should throttle value updates', () => {
      const { result, rerender } = renderHook(
        ({ value, limit }) => useThrottle(value, limit),
        { initialProps: { value: 'v1', limit: 300 } }
      );

      // First update should go through immediately if past threshold
      act(() => {
        jest.advanceTimersByTime(300);
      });

      rerender({ value: 'v2', limit: 300 });

      // Value should update since we're past the threshold
      expect(result.current).toBe('v2');

      // Rapid update within threshold
      rerender({ value: 'v3', limit: 300 });

      // Should still show v2 until throttle period passes
      expect(result.current).toBe('v2');

      // Fast-forward past throttle period
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Now should show v3
      expect(result.current).toBe('v3');
    });
  });
});

describe('Performance Optimization Tests', () => {
  it('useDebounce should reduce function calls for rapid input', () => {
    const processingFn = jest.fn();
    const { result, rerender } = renderHook(
      ({ value }) => {
        const debounced = useDebounce(value, 300);
        if (debounced) processingFn(debounced);
        return debounced;
      },
      { initialProps: { value: '' } }
    );

    // Simulate rapid typing
    for (let i = 0; i < 10; i++) {
      rerender({ value: `input${i}` });
    }

    // Only initial empty string should have triggered processing
    expect(processingFn).toHaveBeenCalledTimes(0);

    // Fast-forward
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should only process once with final value
    expect(processingFn).toHaveBeenCalledTimes(1);
    expect(processingFn).toHaveBeenCalledWith('input9');
  });
});
