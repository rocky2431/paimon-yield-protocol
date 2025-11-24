# Feature: BSC Testnet Deployment & Validation

**Task ID**: 26
**Status**: In Progress
**Branch**: feat/task-26-bsc-testnet

## Overview

Deploy the complete Paimon Yield Protocol to BSC Testnet and validate the full RWA asset buy/sell flow through comprehensive fork testing.

## Rationale

Before mainnet deployment, we need to:
1. Validate contract deployment sequence and configuration
2. Test the complete user flow (deposit → RWA purchase → withdraw → RWA sale)
3. Verify gas costs for different transaction sizes
4. Test slippage scenarios with various amounts ($1K/$10K/$100K)

## Deliverables

1. **Deploy.s.sol** - Foundry deployment script with proper sequencing
2. **BSCTestnetFork.t.sol** - Fork test simulating real testnet conditions
3. **Gas report** - Documented gas costs for all operations
4. **Deployment documentation** - Contract addresses and configuration

## Deployment Order

```
1. AssetRegistry
2. OracleAdapter (with mock oracle for testnet)
3. SwapHelper (with PancakeSwap testnet or mock)
4. RebalanceStrategy
5. PNGYVault (configured with all dependencies)
```

## Test Scenarios

1. **Basic Flow**: Register RWA → Deposit USDT → Verify RWA purchase → Withdraw
2. **Slippage Test**: Test with $1K, $10K, $100K amounts
3. **Rebalance Flow**: Execute rebalance with allocation changes
4. **Edge Cases**: Min deposit, max withdrawal, circuit breaker

## Impact Assessment

- **User Stories Affected**: user-story-65 (Test RWA buy/sell flow)
- **Architecture Changes**: No - validation only
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/product.md#user-story-65-测试-rwa-资产买卖流程

---

## Implementation Results

### Test Summary

All 9 BSC Testnet Simulation tests passed:

| Test | Status | Description |
|------|--------|-------------|
| test_FullFlow_Deposit_Withdraw | PASS | Full deposit → RWA purchase → withdraw → RWA sale flow |
| test_Slippage_1K_Deposit | PASS | $1K deposit slippage test (0 bps) |
| test_Slippage_10K_Deposit | PASS | $10K deposit slippage test (0 bps) |
| test_Slippage_100K_Deposit | PASS | $100K deposit slippage test (0 bps) |
| test_Rebalance_Flow | PASS | Rebalance: sell bonds → buy stocks |
| test_MinDeposit | PASS | Minimum $500 deposit |
| test_MaxWithdrawal | PASS | $100K max withdrawal limit enforcement |
| test_MultipleUsers_Concurrent | PASS | Multi-user proportional share allocation |
| test_GasReport | PASS | Gas cost analysis |

### Gas Report (BSC Testnet Simulation)

| Operation | Gas Used | Est. Cost (5 gwei) |
|-----------|----------|-------------------|
| Deposit ($10K) | ~400K | ~2 mBNB ($0.60) |
| Withdraw (50%) | ~320K | ~1.6 mBNB ($0.48) |
| Rebalance | ~250K | ~1.25 mBNB ($0.37) |

*Note: Costs estimated at BNB price ~$300*

### Files Created

1. **`contracts/script/Deploy.s.sol`** - Complete deployment script with:
   - Mock tokens (USDT, RWA Bond, RWA Stock)
   - Mock infrastructure (Oracle, PancakeRouter)
   - Protocol contracts deployment and configuration
   - Initial state setup and token minting

2. **`contracts/test/integration/BSCTestnetSimulation.t.sol`** - Comprehensive test suite with:
   - Full user flow tests (deposit/withdraw with RWA swaps)
   - Slippage tests at multiple amounts ($1K/$10K/$100K)
   - Rebalance flow validation
   - Edge case testing (min/max limits)
   - Gas reporting
