import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface VaultState {
  // User balances
  usdtBalance: bigint;
  pngyBalance: bigint;

  // Vault info
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint; // 1e18 precision

  // Dashboard specific
  userAssetValue: bigint; // User's PNGY converted to USDT value
  accumulatedYield: bigint; // Profit in USDT (current value - initial deposit)
  currentApy: number; // APY percentage (e.g., 5.26 for 5.26%)
  lastUpdated: Date | null;
  initialDeposit: bigint; // Track initial deposit for yield calculation

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setBalances: (usdt: bigint, pngy: bigint) => void;
  setVaultInfo: (totalAssets: bigint, totalShares: bigint, sharePrice: bigint) => void;
  setDashboardData: (userAssetValue: bigint, accumulatedYield: bigint, currentApy: number) => void;
  setInitialDeposit: (amount: bigint) => void;
  setLastUpdated: (date: Date) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  usdtBalance: 0n,
  pngyBalance: 0n,
  totalAssets: 0n,
  totalShares: 0n,
  sharePrice: 0n,
  userAssetValue: 0n,
  accumulatedYield: 0n,
  currentApy: 0,
  lastUpdated: null as Date | null,
  initialDeposit: 0n,
  isLoading: false,
  error: null,
};

export const useVaultStore = create<VaultState>()(
  devtools(
    (set) => ({
      ...initialState,

      setBalances: (usdt, pngy) =>
        set({ usdtBalance: usdt, pngyBalance: pngy }, false, 'setBalances'),

      setVaultInfo: (totalAssets, totalShares, sharePrice) =>
        set({ totalAssets, totalShares, sharePrice }, false, 'setVaultInfo'),

      setDashboardData: (userAssetValue, accumulatedYield, currentApy) =>
        set({ userAssetValue, accumulatedYield, currentApy }, false, 'setDashboardData'),

      setInitialDeposit: (initialDeposit) =>
        set({ initialDeposit }, false, 'setInitialDeposit'),

      setLastUpdated: (lastUpdated) =>
        set({ lastUpdated }, false, 'setLastUpdated'),

      setLoading: (isLoading) =>
        set({ isLoading }, false, 'setLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      reset: () =>
        set(initialState, false, 'reset'),
    }),
    { name: 'vault-store' }
  )
);
