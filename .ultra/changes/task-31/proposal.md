# Feature: OracleAdapter Dual Oracle Architecture

**Task ID**: 31
**Status**: In Progress
**Branch**: feat/task-31-oracle-adapter

## Overview

Implement a robust OracleAdapter contract that supports dual Oracle sources (APRO/API3 as primary, Chainlink as backup) with automatic failover logic when data becomes stale (>2 hours).

## Rationale

RWA asset pricing requires reliable and accurate price feeds. A single Oracle source creates a single point of failure. By implementing dual Oracle support with automatic failover, we ensure:
- High availability of price data
- Protection against Oracle downtime
- Data freshness validation
- Transparent price source tracking

## Impact Assessment

- **User Stories Affected**: US-64 (Configure RWA Asset Oracle Data Source)
- **Architecture Changes**: New contract (OracleAdapter.sol) and interface (IOracleAdapter.sol)
- **Breaking Changes**: None (new contract, no existing dependencies)

## Technical Design

### Interface: IOracleAdapter
```solidity
interface IOracleAdapter {
    function getPrice(address asset) external view returns (uint256 price, uint256 timestamp);
    function getPriceWithSource(address asset) external view returns (uint256 price, uint256 timestamp, uint8 source);
}
```

### Failover Logic
1. Try primary Oracle (APRO/API3)
2. Check data freshness (< 2 hours)
3. If stale or unavailable, switch to backup Oracle (Chainlink)
4. Emit event when failover occurs

## Requirements Trace

- Traces to: specs/product.md#user-story-64-配置-rwa-资产-oracle-数据源
