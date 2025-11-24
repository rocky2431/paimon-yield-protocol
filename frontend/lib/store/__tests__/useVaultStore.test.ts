/**
 * Vault Store Tests
 */

import { useVaultStore } from '../useVaultStore';
import { act, renderHook } from '@testing-library/react';

describe('useVaultStore', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useVaultStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useVaultStore());

      expect(result.current.usdtBalance).toBe(0n);
      expect(result.current.pngyBalance).toBe(0n);
      expect(result.current.totalAssets).toBe(0n);
      expect(result.current.totalShares).toBe(0n);
      expect(result.current.sharePrice).toBe(0n);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('setBalances', () => {
    it('should update usdt and pngy balances', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setBalances(1000n, 500n);
      });

      expect(result.current.usdtBalance).toBe(1000n);
      expect(result.current.pngyBalance).toBe(500n);
    });

    it('should handle large balances', () => {
      const { result } = renderHook(() => useVaultStore());
      const largeAmount = BigInt('1000000000000000000000000'); // 1M tokens with 18 decimals

      act(() => {
        result.current.setBalances(largeAmount, largeAmount);
      });

      expect(result.current.usdtBalance).toBe(largeAmount);
      expect(result.current.pngyBalance).toBe(largeAmount);
    });
  });

  describe('setVaultInfo', () => {
    it('should update vault information', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setVaultInfo(1000000n, 1000000n, 1000000000000000000n);
      });

      expect(result.current.totalAssets).toBe(1000000n);
      expect(result.current.totalShares).toBe(1000000n);
      expect(result.current.sharePrice).toBe(1000000000000000000n);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setLoading(true);
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setError('Connection failed');
      });

      expect(result.current.error).toBe('Connection failed');
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useVaultStore());

      act(() => {
        result.current.setError('Error');
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useVaultStore());

      // Set some values
      act(() => {
        result.current.setBalances(1000n, 500n);
        result.current.setVaultInfo(1000000n, 1000000n, 1000000000000000000n);
        result.current.setLoading(true);
        result.current.setError('Error');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all values are reset
      expect(result.current.usdtBalance).toBe(0n);
      expect(result.current.pngyBalance).toBe(0n);
      expect(result.current.totalAssets).toBe(0n);
      expect(result.current.totalShares).toBe(0n);
      expect(result.current.sharePrice).toBe(0n);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Dashboard actions', () => {
    describe('setDashboardData', () => {
      it('should update dashboard data correctly', () => {
        const { result } = renderHook(() => useVaultStore());

        act(() => {
          result.current.setDashboardData(
            BigInt('10000000000000000000000'), // 10000 USDT
            BigInt('500000000000000000000'),   // 500 USDT yield
            5.26                                // 5.26% APY
          );
        });

        expect(result.current.userAssetValue).toBe(BigInt('10000000000000000000000'));
        expect(result.current.accumulatedYield).toBe(BigInt('500000000000000000000'));
        expect(result.current.currentApy).toBe(5.26);
      });
    });

    describe('setInitialDeposit', () => {
      it('should set initial deposit amount', () => {
        const { result } = renderHook(() => useVaultStore());

        act(() => {
          result.current.setInitialDeposit(BigInt('5000000000000000000000')); // 5000 USDT
        });

        expect(result.current.initialDeposit).toBe(BigInt('5000000000000000000000'));
      });
    });

    describe('setLastUpdated', () => {
      it('should set last updated timestamp', () => {
        const { result } = renderHook(() => useVaultStore());
        const now = new Date();

        act(() => {
          result.current.setLastUpdated(now);
        });

        expect(result.current.lastUpdated).toEqual(now);
      });
    });
  });
});
