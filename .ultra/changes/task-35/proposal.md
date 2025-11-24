# Feature: PNGYVault Rebalance Function

**Task ID**: 35
**Status**: In Progress
**Branch**: feat/task-35-vault-rebalance

## Overview

Implement a `rebalance()` function in PNGYVault that enables dynamic portfolio rebalancing by executing sell and buy operations on RWA assets through SwapHelper.

## Rationale

The vault needs the ability to dynamically adjust its asset allocations based on APY changes and market conditions. This function works in conjunction with Task #34's RebalanceStrategy contract to optimize yields.

## Design

### Function Signature

```solidity
function rebalance(
    address[] calldata sellAssets,
    uint256[] calldata sellAmounts,
    address[] calldata buyAssets,
    uint256[] calldata buyAmounts
) external onlyRole(REBALANCER_ROLE) nonReentrant returns (uint256[] memory, uint256[] memory);
```

### Key Features

1. **Access Control**: Only `REBALANCER_ROLE` can execute
2. **Sell Operations**: Sell RWA tokens for USDT via SwapHelper
3. **Buy Operations**: Buy RWA tokens with USDT via SwapHelper
4. **Target Allocation Updates**: Optionally update target allocations
5. **Event Emission**: `RebalanceExecuted` event with details

### Event Definition

```solidity
event RebalanceExecuted(
    address[] sellAssets,
    uint256[] sellAmounts,
    uint256[] sellReceived,
    address[] buyAssets,
    uint256[] buyAmounts,
    uint256[] buyReceived,
    uint256 timestamp
);
```

### Security Considerations

- ReentrancyGuard protection
- Array length validation
- SwapHelper failure handling
- Minimum trade value enforcement

## Impact Assessment

- **User Stories Affected**: user-story-41 (Execute Dynamic Rebalancing)
- **Architecture Changes**: No - uses existing SwapHelper integration
- **Breaking Changes**: No - additive change only

## Requirements Trace

- Traces to: specs/product.md#user-story-41-execute-dynamic-rebalance
- Depends on: Task #34 (RebalanceStrategy)
