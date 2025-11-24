# Feature: RebalanceStrategy Dynamic Rebalancing Contract

**Task ID**: 34
**Status**: In Progress
**Branch**: feat/task-34-rebalance-strategy

## Overview

Implement a dynamic rebalancing strategy contract that calculates optimal asset allocations based on APY and generates rebalance transactions for the vault.

## Rationale

Dynamic rebalancing is essential for:
- Maximizing yield by allocating more to higher APY assets
- Managing risk through diversification
- Automated portfolio optimization
- Transparent on-chain rebalancing logic

## Technical Design

### Core Functions

1. **calculateOptimalAllocation(assets, apys)**
   - Input: Array of assets with their current APYs
   - Output: Optimal target allocations (basis points)
   - Algorithm: Weight assets by APY with risk constraints

2. **generateRebalanceTx(currentAllocations, targetAllocations)**
   - Input: Current and target allocations
   - Output: Buy/sell instructions (which assets, amounts)
   - Considers: Minimum trade size, slippage tolerance

### Allocation Algorithm

```
For each asset:
  weight = baseWeight + (APY - avgAPY) * sensitivityFactor
  weight = clamp(weight, minWeight, maxWeight)

Normalize all weights to sum to 10000 (100%)
```

## Impact Assessment
- **User Stories Affected**: US-41 (Execute Dynamic Rebalancing)
- **Architecture Changes**: New contract (RebalanceStrategy.sol)
- **Breaking Changes**: None

## Requirements Trace
- Traces to: specs/product.md#user-story-41-执行动态再平衡
