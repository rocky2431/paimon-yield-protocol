# Smart Contract Audit Scope - Paimon Yield Protocol

**Version**: 1.0
**Date**: 2025-11-25
**Prepared By**: Paimon Yield Protocol Team

---

## 1. Executive Summary

Paimon Yield Protocol is an ERC4626-compliant tokenized vault designed for RWA (Real World Asset) yield aggregation on BNB Smart Chain. This document provides the audit scope, contract specifications, and security context for external auditors.

### Target Network
- **Primary**: BNB Smart Chain (BSC) Mainnet
- **Testnet**: BSC Testnet (for pre-deployment validation)

### Token Standards
- **Vault Token**: ERC4626 (PNGY shares)
- **Underlying Asset**: USDT (18 decimals on BSC)

---

## 2. Contracts in Scope

| Contract | LOC | Solidity Version | Description |
|----------|-----|-----------------|-------------|
| **PNGYVault.sol** | ~1,400 | ^0.8.24 | Core ERC4626 yield vault with RWA integration |
| **AssetRegistry.sol** | ~370 | ^0.8.24 | RWA asset registration and management |
| **OracleAdapter.sol** | ~330 | ^0.8.24 | Dual oracle with automatic failover |
| **SwapHelper.sol** | ~180 | ^0.8.24 | DEX integration (PancakeSwap V2) |
| **RebalanceStrategy.sol** | ~260 | ^0.8.24 | Portfolio rebalancing calculations |

### Contracts Out of Scope
- `Counter.sol` (example contract)
- Deployment scripts (`script/`)
- Test files (`test/`)
- Oracle implementations (`src/oracles/`) - reference only

---

## 3. Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Users                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                    deposit/withdraw/redeem
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PNGYVault                                │
│   ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐    │
│   │  ERC4626    │  │ AccessCtrl │  │  Pausable/Reentrancy │    │
│   └─────────────┘  └────────────┘  └──────────────────────┘    │
│                                                                  │
│   Features: T+1 Queue, Circuit Breaker, RWA Holdings            │
└─────────────────────────────────────────────────────────────────┘
        │              │                    │
        │              │                    │
        ▼              ▼                    ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────┐
│AssetRegistry │ │OracleAdapter │ │  SwapHelper    │
│              │ │              │ │                │
│ RWA Token    │ │ Primary +    │ │ PancakeSwap V2 │
│ Management   │ │ Backup       │ │ Integration    │
└──────────────┘ └──────────────┘ └────────────────┘
                        │
                        ▼
              ┌────────────────┐
              │RebalanceStrategy│
              │                │
              │ APY-based      │
              │ Allocation     │
              └────────────────┘
```

---

## 4. Core Functions to Audit

### 4.1 PNGYVault.sol - Critical Functions

#### User-Facing Functions
| Function | Risk Level | Description |
|----------|------------|-------------|
| `deposit()` | HIGH | Accepts USDT, purchases RWA tokens, mints shares |
| `withdraw()` | HIGH | Burns shares, sells RWA tokens, returns USDT |
| `redeem()` | HIGH | Burns exact shares, returns proportional assets |
| `requestWithdraw()` | MEDIUM | Queues T+1 withdrawal request |
| `claimWithdraw()` | MEDIUM | Claims queued withdrawal after delay |
| `emergencyWithdraw()` | HIGH | Bypasses limits when paused |

#### Admin Functions
| Function | Risk Level | Description |
|----------|------------|-------------|
| `addRWAAsset()` | MEDIUM | Adds RWA token to vault holdings |
| `removeRWAAsset()` | MEDIUM | Removes RWA token from holdings |
| `removeRWAAssetWithLiquidation()` | HIGH | Sells all holdings and removes |
| `rebalance()` | HIGH | Executes buy/sell orders for rebalancing |
| `rebalanceWithNewAllocations()` | HIGH | Updates allocations and rebalances |
| `setCircuitBreakerThreshold()` | MEDIUM | Configures NAV drop protection |

### 4.2 AssetRegistry.sol
| Function | Risk Level | Description |
|----------|------------|-------------|
| `registerAsset()` | LOW | Registers new RWA token |
| `removeAsset()` | LOW | Removes RWA token from registry |
| `setAssetStatus()` | LOW | Activates/deactivates asset |
| `markAssetForRemoval()` | MEDIUM | Signals pending liquidation |

### 4.3 OracleAdapter.sol
| Function | Risk Level | Description |
|----------|------------|-------------|
| `getPrice()` | HIGH | Returns asset price with failover |
| `configureOracle()` | MEDIUM | Sets primary/backup oracles |
| `isPriceStale()` | MEDIUM | Checks staleness threshold |

### 4.4 SwapHelper.sol
| Function | Risk Level | Description |
|----------|------------|-------------|
| `buyRWAAsset()` | HIGH | Swaps USDT for RWA token |
| `sellRWAAsset()` | HIGH | Swaps RWA token for USDT |
| `getAmountOut()` | MEDIUM | Estimates swap output |

---

## 5. Security Mechanisms

### 5.1 Access Control
- **DEFAULT_ADMIN_ROLE**: Contract owner (multisig recommended)
- **ADMIN_ROLE**: Administrative operations
- **REBALANCER_ROLE**: Rebalancing operations

### 5.2 Protection Mechanisms
| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| Reentrancy Guard | OpenZeppelin `nonReentrant` | Prevents reentrant calls |
| Pausable | OpenZeppelin `Pausable` | Emergency stop |
| Circuit Breaker | NAV-based threshold | Limits withdrawals on price drop |
| T+1 Withdrawal Queue | Time-locked requests | Large withdrawal protection |
| Slippage Protection | Configurable max (2%) | DEX swap protection |

### 5.3 Constants and Limits
```solidity
MIN_DEPOSIT = 500e18;              // 500 USDT minimum
MAX_WITHDRAWAL = 100_000e18;       // 100K USDT per transaction
INSTANT_WITHDRAWAL_LIMIT = 10_000e18;  // 10K USDT instant
WITHDRAWAL_DELAY = 1 days;         // T+1 queue delay
CIRCUIT_BREAKER_THRESHOLD = 500;   // 5% NAV drop triggers
MAX_SWAP_SLIPPAGE = 200;           // 2% maximum slippage
MAX_RWA_ASSETS = 20;               // Maximum RWA holdings
CACHE_DURATION = 5 minutes;        // Price cache validity
```

---

## 6. Known Risks and Design Decisions

### 6.1 Accepted Risks

#### Divide-Before-Multiply Precision
- **Location**: `PNGYVault._calculateRWAValue()`, `_sellRWATokens()`
- **Description**: Standard DeFi decimal normalization pattern
- **Impact**: < 1 wei precision loss per calculation
- **Mitigation**: USDT uses 18 decimals on BSC, minimizing edge cases

#### Block Timestamp Usage
- **Location**: `OracleAdapter.sol`, `SwapHelper.sol`
- **Description**: Used for staleness checks
- **Impact**: Miners can manipulate by ~15 seconds
- **Mitigation**: 1-hour default staleness threshold provides sufficient buffer

### 6.2 External Dependencies

| Dependency | Version | Usage |
|------------|---------|-------|
| OpenZeppelin Contracts | 5.0.x | ERC4626, AccessControl, Pausable, ReentrancyGuard |
| PancakeSwap V2 Router | - | RWA token swaps |
| Chainlink / API3 | - | Price feeds (via OracleAdapter) |

### 6.3 Trust Assumptions
1. **Multisig Admin**: Admin role should be controlled by multisig (Gnosis Safe)
2. **Oracle Accuracy**: Primary oracle provides accurate prices
3. **DEX Liquidity**: PancakeSwap has sufficient liquidity for RWA tokens
4. **RWA Token Validity**: Registered RWA tokens are legitimate ERC20s

---

## 7. Attack Vectors to Consider

### 7.1 High Priority
1. **Share Price Manipulation**: First depositor attack, inflation attack
2. **Oracle Manipulation**: Flash loan price manipulation
3. **Reentrancy**: Despite guards, verify all external call sequences
4. **Withdrawal Queue Bypass**: Edge cases in T+1 queue logic

### 7.2 Medium Priority
1. **Slippage Exploitation**: Sandwich attacks on large deposits/withdrawals
2. **Circuit Breaker Gaming**: Triggering/resetting for advantage
3. **Role Privilege Escalation**: Unauthorized role grants

### 7.3 Economic Attacks
1. **Flash Loan Attacks**: Borrow → Manipulate → Exploit → Repay
2. **Griefing Attacks**: Dust deposits to increase gas costs
3. **Front-running**: MEV extraction on rebalance transactions

---

## 8. Test Coverage Summary

### Coverage by Contract

| Contract | Line Coverage | Branch Coverage | Function Coverage |
|----------|--------------|-----------------|-------------------|
| PNGYVault.sol | 97.16% | 85.71% | 100% |
| AssetRegistry.sol | 97.78% | 80.95% | 100% |
| OracleAdapter.sol | 97.70% | 86.96% | 100% |
| SwapHelper.sol | 94.44% | 78.57% | 100% |
| RebalanceStrategy.sol | 99.00% | 81.82% | 100% |

### Test Categories
- **Unit Tests**: 400+ individual function tests
- **Fuzz Tests**: Property-based testing for edge cases
- **Invariant Tests**: 10 protocol invariants verified
- **Integration Tests**: Multi-contract flow tests

---

## 9. Internal Security Review Summary

### Static Analysis (Slither)
- **Critical**: 0
- **High**: 1 (false positive in OpenZeppelin Math.sol)
- **Medium**: 8 (analyzed - acceptable risk or false positives)
- **Low**: 102 (documented)

### Symbolic Execution (Mythril)
- **PNGYVault.sol**: 0 issues
- **SwapHelper.sol**: 0 issues
- **OracleAdapter.sol**: 0 issues

### Fixed Issues
- Variable shadowing in `AssetRegistry.setAssetStatus()` - Fixed

---

## 10. Deliverables for Auditors

### Code Repository
- All contracts in `contracts/src/`
- Interfaces in `contracts/src/interfaces/`
- Tests in `contracts/test/`

### Reports Provided
1. **coverage-summary.txt**: Full Forge coverage report
2. **gas-report.txt**: Forge gas usage report
3. **slither-report.json**: Full Slither JSON output
4. **mythril-*.json**: Mythril reports for each contract
5. **security-audit-report.md**: Internal security analysis

### Contact
For questions during the audit, please contact the development team.

---

## 11. Audit Focus Recommendations

### Must Verify
1. ERC4626 compliance (share/asset conversions)
2. Access control correctness
3. Reentrancy protection completeness
4. Oracle failover logic
5. Withdrawal queue edge cases

### Economic Review
1. Share price calculation accuracy
2. Circuit breaker effectiveness
3. Slippage protection adequacy
4. First depositor vulnerability

### Gas Optimization Review
1. Loop bounds in batch operations
2. Storage vs. memory usage
3. External call efficiency

---

*Document Version: 1.0 | Last Updated: 2025-11-25*
