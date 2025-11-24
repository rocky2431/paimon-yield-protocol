/**
 * Contract ABIs for Paimon Yield Protocol
 */

// ERC20 ABI - approve and allowance functions
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// PNGYVault ABI - deposit and related functions
export const PNGY_VAULT_ABI = [
  // ERC4626 deposit function
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  // ERC4626 previewDeposit function
  {
    name: 'previewDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  // ERC4626 maxDeposit function
  {
    name: 'maxDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'receiver', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ERC4626 totalAssets function
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ERC4626 totalSupply function
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ERC4626 balanceOf function (shares)
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ERC4626 convertToShares function
  {
    name: 'convertToShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  // ERC4626 convertToAssets function
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  // Constants
  {
    name: 'MIN_DEPOSIT',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Pausable
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Events
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Minimum deposit amount (500 USDT with 18 decimals)
export const MIN_DEPOSIT = BigInt('500000000000000000000'); // 500e18

// Maximum withdrawal amount (100,000 USDT with 18 decimals)
export const MAX_WITHDRAWAL = BigInt('100000000000000000000000'); // 100_000e18

// Withdrawal delay (1 day in seconds)
export const WITHDRAWAL_DELAY = 86400; // 1 day

// Extended PNGYVault ABI for withdraw functions
export const PNGY_VAULT_WITHDRAW_ABI = [
  // Request withdraw (T+1 queue)
  {
    name: 'requestWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  // Claim withdraw after delay
  {
    name: 'claimWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
  },
  // Get user's pending request IDs
  {
    name: 'getUserPendingRequests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
  },
  // Get withdraw request details
  {
    name: 'withdrawRequests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'requestTime', type: 'uint256' },
      { name: 'claimed', type: 'bool' },
    ],
  },
  // Preview redeem
  {
    name: 'previewRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  // Max redeem
  {
    name: 'maxRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // User balance (PNGY shares)
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Get user's locked shares
  {
    name: 'getUserLockedShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'locked', type: 'uint256' }],
  },
  // Constants
  {
    name: 'MAX_WITHDRAWAL',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'WITHDRAWAL_DELAY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Pausable
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Events
  {
    name: 'WithdrawRequested',
    type: 'event',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'claimableTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'WithdrawClaimed',
    type: 'event',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'caller', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Export type for contract addresses
export type ContractAddresses = {
  pngyVault: `0x${string}`;
  usdt: `0x${string}`;
};
