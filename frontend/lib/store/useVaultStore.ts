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

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setBalances: (usdt: bigint, pngy: bigint) => void;
  setVaultInfo: (totalAssets: bigint, totalShares: bigint, sharePrice: bigint) => void;
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
