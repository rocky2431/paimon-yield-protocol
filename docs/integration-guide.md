# PNGYVault Integration Guide

This guide provides comprehensive documentation for integrating with the Paimon Yield Protocol's PNGYVault contract. The vault implements the ERC-4626 tokenized vault standard, making it easy to integrate with existing DeFi protocols.

## Table of Contents

1. [Overview](#overview)
2. [ERC-4626 Standard Interface](#erc-4626-standard-interface)
3. [PNGYVault Specific Features](#pngyvault-specific-features)
4. [Solidity Integration Examples](#solidity-integration-examples)
5. [TypeScript/JavaScript SDK Examples](#typescriptjavascript-sdk-examples)
6. [Testnet Deployment](#testnet-deployment)
7. [Security Considerations](#security-considerations)

---

## Overview

PNGYVault is an ERC-4626 compliant tokenized vault that aggregates yield from Real World Assets (RWA) on BSC. Users deposit USDT and receive PNGY shares representing their proportional ownership of the vault's assets.

### Key Features

- **ERC-4626 Compliant**: Standard tokenized vault interface
- **RWA Yield Aggregation**: Automatic investment in diversified RWA tokens
- **T+1 Withdrawal Queue**: Large withdrawals processed through a queue system
- **Circuit Breaker**: Automatic protection during extreme market conditions
- **Multi-sig Governance**: Admin operations require Gnosis Safe approval

### Contract Addresses

See [Testnet Deployment](#testnet-deployment) section for current addresses.

---

## ERC-4626 Standard Interface

PNGYVault implements the full ERC-4626 interface. Here's a quick reference:

### View Functions

```solidity
// Returns the address of the underlying asset (USDT)
function asset() external view returns (address);

// Returns total assets managed by the vault
function totalAssets() external view returns (uint256);

// Convert assets to shares
function convertToShares(uint256 assets) external view returns (uint256 shares);

// Convert shares to assets
function convertToAssets(uint256 shares) external view returns (uint256 assets);

// Preview deposit (how many shares for assets)
function previewDeposit(uint256 assets) external view returns (uint256 shares);

// Preview mint (how many assets for shares)
function previewMint(uint256 shares) external view returns (uint256 assets);

// Preview withdraw (how many shares to burn for assets)
function previewWithdraw(uint256 assets) external view returns (uint256 shares);

// Preview redeem (how many assets for shares)
function previewRedeem(uint256 shares) external view returns (uint256 assets);

// Maximum deposit amount
function maxDeposit(address receiver) external view returns (uint256);

// Maximum mint amount
function maxMint(address receiver) external view returns (uint256);

// Maximum withdraw amount
function maxWithdraw(address owner) external view returns (uint256);

// Maximum redeem amount
function maxRedeem(address owner) external view returns (uint256);
```

### Mutative Functions

```solidity
// Deposit assets and receive shares
function deposit(uint256 assets, address receiver) external returns (uint256 shares);

// Mint specific amount of shares
function mint(uint256 shares, address receiver) external returns (uint256 assets);

// Withdraw assets by burning shares (instant for small amounts)
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

// Redeem shares for assets (instant for small amounts)
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
```

---

## PNGYVault Specific Features

### Constants

```solidity
uint256 public constant MIN_DEPOSIT = 500e18;              // Minimum deposit: $500
uint256 public constant MAX_WITHDRAWAL = 100_000e18;       // Maximum withdrawal: $100,000
uint256 public constant INSTANT_WITHDRAWAL_LIMIT = 10_000e18; // Instant limit: $10,000
uint256 public constant WITHDRAWAL_DELAY = 1 days;         // T+1 delay for large withdrawals
uint256 public constant CIRCUIT_BREAKER_LIMIT = 10_000e18; // Limit when circuit breaker active
```

### T+1 Withdrawal Queue

For withdrawals exceeding `INSTANT_WITHDRAWAL_LIMIT` ($10,000), use the queue system:

```solidity
// Request a withdrawal (locks shares, processes after WITHDRAWAL_DELAY)
function requestWithdraw(uint256 shares, address receiver) external returns (uint256 requestId);

// Claim a withdrawal after delay
function claimWithdraw(uint256 requestId) external;

// Get user's pending request IDs
function getUserPendingRequests(address user) external view returns (uint256[] memory);

// Get user's locked shares
function getUserLockedShares(address user) external view returns (uint256 locked);
```

### Share Price

```solidity
// Get current share price (1e18 precision)
function sharePrice() external view returns (uint256);
```

### RWA Holdings

```solidity
// Get all RWA holdings
function getRWAHoldings() external view returns (RWAHolding[] memory);

// Get current RWA value
function getRWAValue() external view returns (uint256);

// Check if asset is in holdings
function isRWAHolding(address tokenAddress) external view returns (bool);
```

### Events

```solidity
event DepositProcessed(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);
event WithdrawProcessed(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
event WithdrawRequested(uint256 indexed requestId, address indexed owner, address receiver, uint256 shares, uint256 assets, uint256 claimableTime);
event WithdrawClaimed(uint256 indexed requestId, address indexed owner, address receiver, uint256 assets);
event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);
event CircuitBreakerTriggered(uint256 currentNav, uint256 referenceNav, uint256 dropBasisPoints);
```

---

## Solidity Integration Examples

### Basic Integration Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PNGYIntegration {
    using SafeERC20 for IERC20;

    IERC4626 public immutable pngyVault;
    IERC20 public immutable usdt;

    constructor(address _pngyVault) {
        pngyVault = IERC4626(_pngyVault);
        usdt = IERC20(pngyVault.asset());
    }

    /// @notice Deposit USDT into PNGYVault
    /// @param amount Amount of USDT to deposit
    /// @return shares Amount of PNGY shares received
    function depositToVault(uint256 amount) external returns (uint256 shares) {
        // Transfer USDT from user to this contract
        usdt.safeTransferFrom(msg.sender, address(this), amount);

        // Approve vault to spend USDT
        usdt.safeIncreaseAllowance(address(pngyVault), amount);

        // Deposit and receive shares
        shares = pngyVault.deposit(amount, msg.sender);
    }

    /// @notice Preview how many shares user would receive
    /// @param assets Amount of USDT
    /// @return shares Expected PNGY shares
    function previewDeposit(uint256 assets) external view returns (uint256 shares) {
        return pngyVault.previewDeposit(assets);
    }

    /// @notice Get current vault share price
    /// @return price Share price (1e18 precision)
    function getSharePrice() external view returns (uint256 price) {
        uint256 totalSupply = IERC20(address(pngyVault)).totalSupply();
        if (totalSupply == 0) return 1e18;
        return (pngyVault.totalAssets() * 1e18) / totalSupply;
    }

    /// @notice Get user's position value in USDT
    /// @param user User address
    /// @return value Position value in USDT
    function getUserPositionValue(address user) external view returns (uint256 value) {
        uint256 shares = IERC20(address(pngyVault)).balanceOf(user);
        return pngyVault.convertToAssets(shares);
    }
}
```

### Yield Strategy Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title YieldAggregator
/// @notice Example of a protocol that uses PNGYVault as one of its yield sources
contract YieldAggregator {
    using SafeERC20 for IERC20;

    struct VaultInfo {
        address vault;
        uint256 allocation; // Allocation in basis points (10000 = 100%)
        bool isActive;
    }

    mapping(uint256 => VaultInfo) public vaults;
    uint256 public vaultCount;
    IERC20 public usdt;

    constructor(address _usdt) {
        usdt = IERC20(_usdt);
    }

    /// @notice Add PNGYVault as a yield source
    function addVault(address vault, uint256 allocation) external returns (uint256 vaultId) {
        require(IERC4626(vault).asset() == address(usdt), "Asset mismatch");

        vaultId = vaultCount++;
        vaults[vaultId] = VaultInfo({
            vault: vault,
            allocation: allocation,
            isActive: true
        });
    }

    /// @notice Deposit into specific vault
    function depositToVault(uint256 vaultId, uint256 amount) external returns (uint256 shares) {
        VaultInfo memory info = vaults[vaultId];
        require(info.isActive, "Vault not active");

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        usdt.safeIncreaseAllowance(info.vault, amount);

        shares = IERC4626(info.vault).deposit(amount, address(this));
    }

    /// @notice Withdraw from specific vault
    function withdrawFromVault(uint256 vaultId, uint256 shares) external returns (uint256 assets) {
        VaultInfo memory info = vaults[vaultId];
        require(info.isActive, "Vault not active");

        assets = IERC4626(info.vault).redeem(shares, msg.sender, address(this));
    }

    /// @notice Get total value across all vaults
    function getTotalValue() external view returns (uint256 total) {
        for (uint256 i = 0; i < vaultCount; i++) {
            if (vaults[i].isActive) {
                uint256 shares = IERC20(vaults[i].vault).balanceOf(address(this));
                total += IERC4626(vaults[i].vault).convertToAssets(shares);
            }
        }
    }
}
```

### Lending Protocol Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PNGYCollateralManager
/// @notice Example of using PNGY shares as collateral in a lending protocol
contract PNGYCollateralManager {
    IERC4626 public immutable pngyVault;

    // Collateral factor: 80% (8000 basis points)
    uint256 public constant COLLATERAL_FACTOR = 8000;
    uint256 public constant BASIS_POINTS = 10000;

    mapping(address => uint256) public collateralDeposits; // PNGY shares
    mapping(address => uint256) public borrowedAmount;     // USDT borrowed

    constructor(address _pngyVault) {
        pngyVault = IERC4626(_pngyVault);
    }

    /// @notice Deposit PNGY shares as collateral
    function depositCollateral(uint256 shares) external {
        IERC20(address(pngyVault)).transferFrom(msg.sender, address(this), shares);
        collateralDeposits[msg.sender] += shares;
    }

    /// @notice Calculate maximum borrow amount based on collateral
    function maxBorrowAmount(address user) public view returns (uint256) {
        uint256 shares = collateralDeposits[user];
        uint256 collateralValue = pngyVault.convertToAssets(shares);
        return (collateralValue * COLLATERAL_FACTOR) / BASIS_POINTS - borrowedAmount[user];
    }

    /// @notice Check if position is healthy (not liquidatable)
    function isHealthy(address user) public view returns (bool) {
        uint256 shares = collateralDeposits[user];
        uint256 collateralValue = pngyVault.convertToAssets(shares);
        uint256 maxBorrow = (collateralValue * COLLATERAL_FACTOR) / BASIS_POINTS;
        return borrowedAmount[user] <= maxBorrow;
    }

    /// @notice Liquidate unhealthy position
    function liquidate(address user) external {
        require(!isHealthy(user), "Position is healthy");

        uint256 shares = collateralDeposits[user];
        uint256 debt = borrowedAmount[user];

        // Redeem collateral
        uint256 assets = pngyVault.redeem(shares, address(this), address(this));

        // Clear user position
        collateralDeposits[user] = 0;
        borrowedAmount[user] = 0;

        // Transfer remaining to liquidator (simplified)
        if (assets > debt) {
            IERC20(pngyVault.asset()).transfer(msg.sender, assets - debt);
        }
    }
}
```

---

## TypeScript/JavaScript SDK Examples

### Installation

```bash
npm install viem wagmi @tanstack/react-query
```

### Basic Setup

```typescript
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { bscTestnet } from 'viem/chains';

// Contract addresses (see Testnet Deployment section)
const PNGY_VAULT_ADDRESS = '0x...'; // Replace with actual address
const USDT_ADDRESS = '0x...';       // Replace with actual address

// ERC4626 ABI (subset)
const VAULT_ABI = parseAbi([
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',
  'function maxDeposit(address) view returns (uint256)',
  'function maxWithdraw(address) view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function sharePrice() view returns (uint256)',
  'event DepositProcessed(address indexed sender, address indexed receiver, uint256 assets, uint256 shares)',
  'event WithdrawProcessed(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
]);

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

// Create client
const client = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});
```

### Reading Vault Data

```typescript
// Get vault information
async function getVaultInfo() {
  const [totalAssets, totalSupply, sharePrice] = await Promise.all([
    client.readContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'totalAssets',
    }),
    client.readContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'totalSupply',
    }),
    client.readContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'sharePrice',
    }),
  ]);

  return {
    totalAssets: formatUnits(totalAssets, 18),
    totalSupply: formatUnits(totalSupply, 18),
    sharePrice: formatUnits(sharePrice, 18),
  };
}

// Get user position
async function getUserPosition(userAddress: `0x${string}`) {
  const [shares, maxWithdraw] = await Promise.all([
    client.readContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }),
    client.readContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'maxWithdraw',
      args: [userAddress],
    }),
  ]);

  const assets = await client.readContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: [shares],
  });

  return {
    shares: formatUnits(shares, 18),
    assets: formatUnits(assets, 18),
    maxWithdraw: formatUnits(maxWithdraw, 18),
  };
}

// Preview deposit
async function previewDeposit(amount: bigint) {
  const shares = await client.readContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'previewDeposit',
    args: [amount],
  });

  return formatUnits(shares, 18);
}
```

### Writing Transactions (with Wagmi)

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

// Hook for depositing
function useDeposit() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  async function deposit(amount: string, receiver: `0x${string}`) {
    const assets = parseUnits(amount, 18);

    // First approve USDT spending
    writeContract({
      address: USDT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PNGY_VAULT_ADDRESS, assets],
    });

    // Then deposit (call after approval confirmed)
    writeContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'deposit',
      args: [assets, receiver],
    });
  }

  return { deposit, isPending, isConfirming, isSuccess, hash };
}

// Hook for redeeming
function useRedeem() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  async function redeem(shares: string, receiver: `0x${string}`, owner: `0x${string}`) {
    const sharesAmount = parseUnits(shares, 18);

    writeContract({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'redeem',
      args: [sharesAmount, receiver, owner],
    });
  }

  return { redeem, isPending, isConfirming, isSuccess, hash };
}
```

### Event Listening

```typescript
import { watchContractEvent } from 'viem';

// Watch for deposit events
function watchDeposits(onDeposit: (log: any) => void) {
  return client.watchContractEvent({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    eventName: 'DepositProcessed',
    onLogs: (logs) => logs.forEach(onDeposit),
  });
}

// Watch for withdrawal events
function watchWithdrawals(onWithdraw: (log: any) => void) {
  return client.watchContractEvent({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    eventName: 'WithdrawProcessed',
    onLogs: (logs) => logs.forEach(onWithdraw),
  });
}

// Usage
const unwatch = watchDeposits((log) => {
  console.log('New deposit:', {
    sender: log.args.sender,
    receiver: log.args.receiver,
    assets: formatUnits(log.args.assets, 18),
    shares: formatUnits(log.args.shares, 18),
  });
});

// Stop watching
// unwatch();
```

### Complete React Hook Example

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

export function usePNGYVault(userAddress?: `0x${string}`) {
  // Read vault stats
  const { data: totalAssets } = useReadContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  });

  const { data: sharePrice } = useReadContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'sharePrice',
  });

  // Read user position
  const { data: userShares } = useReadContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    enabled: !!userAddress,
  });

  const { data: userAssets } = useReadContract({
    address: PNGY_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: userShares ? [userShares] : undefined,
    enabled: !!userShares,
  });

  // Write functions
  const { writeContract: write, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const deposit = async (amount: string) => {
    const assets = parseUnits(amount, 18);
    write({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'deposit',
      args: [assets, userAddress!],
    });
  };

  const redeem = async (shares: string) => {
    const sharesAmount = parseUnits(shares, 18);
    write({
      address: PNGY_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'redeem',
      args: [sharesAmount, userAddress!, userAddress!],
    });
  };

  return {
    // Vault stats
    totalAssets: totalAssets ? formatUnits(totalAssets, 18) : '0',
    sharePrice: sharePrice ? formatUnits(sharePrice, 18) : '1',

    // User position
    userShares: userShares ? formatUnits(userShares, 18) : '0',
    userAssets: userAssets ? formatUnits(userAssets, 18) : '0',

    // Actions
    deposit,
    redeem,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
```

---

## Testnet Deployment

### BSC Testnet (Chain ID: 97)

| Contract | Address | Verified |
|----------|---------|----------|
| PNGYVault | `0x...` | Yes |
| USDT (Mock) | `0x...` | Yes |
| AssetRegistry | `0x...` | Yes |
| OracleAdapter | `0x...` | Yes |
| SwapHelper | `0x...` | Yes |
| RebalanceStrategy | `0x...` | Yes |

> **Note**: Contract addresses will be updated after testnet deployment (Task #81).

### Getting Testnet Tokens

1. **BNB**: Use the [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
2. **Mock USDT**: Mint from our test token contract

```typescript
// Mint test USDT
const MOCK_USDT_ADDRESS = '0x...';
const MINT_ABI = parseAbi(['function mint(address to, uint256 amount)']);

// Mint 10,000 USDT for testing
writeContract({
  address: MOCK_USDT_ADDRESS,
  abi: MINT_ABI,
  functionName: 'mint',
  args: [userAddress, parseUnits('10000', 18)],
});
```

### ABI Files

Full ABI files are available in the repository:

- `contracts/out/PNGYVault.sol/PNGYVault.json`
- `contracts/out/AssetRegistry.sol/AssetRegistry.json`
- `contracts/out/OracleAdapter.sol/OracleAdapter.json`

---

## Security Considerations

### For Integrators

1. **Always check `maxDeposit` and `maxWithdraw`** before transactions
2. **Handle the T+1 withdrawal queue** for large amounts (>$10,000)
3. **Monitor the `circuitBreakerActive` flag** - withdrawals may be limited
4. **Use `previewDeposit`/`previewRedeem`** for accurate UI estimates
5. **Consider slippage** when integrating with DEX-related operations

### Error Handling

```typescript
try {
  await deposit('1000');
} catch (error: any) {
  if (error.message.includes('DepositBelowMinimum')) {
    console.error('Deposit must be at least $500');
  } else if (error.message.includes('VaultPaused')) {
    console.error('Vault is currently paused');
  } else if (error.message.includes('ExceedsInstantLimit')) {
    console.error('Use requestWithdraw for amounts > $10,000');
  }
}
```

### Audits

PNGYVault has been audited by [Auditor Name]. See [Security Audit Report](/docs/security-audit-report.md) for details.

---

## Support

- **Documentation**: [https://docs.paimon.finance](https://docs.paimon.finance)
- **GitHub**: [https://github.com/paimon-protocol/paimon-yield-protocol](https://github.com/paimon-protocol/paimon-yield-protocol)
- **Discord**: [https://discord.gg/paimon](https://discord.gg/paimon)
- **Twitter**: [@PaimonFinance](https://twitter.com/PaimonFinance)

---

*Last updated: 2024-11*
