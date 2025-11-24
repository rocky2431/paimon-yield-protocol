# Feature: APRO (API3) Oracle Integration

**Task ID**: 32
**Status**: In Progress
**Branch**: feat/task-32-apro-oracle

## Overview

Integrate APRO (API3 dAPI) as the primary Oracle source for RWA asset price feeds. This provides decentralized, first-party oracle data for accurate asset pricing.

## Rationale

API3 dAPIs provide:
- First-party oracle data (directly from data providers)
- Decentralized governance
- Native insurance coverage
- Real-time price feeds on BSC

## Technical Design

### API3 dAPI Interface
```solidity
interface IApi3ServerV1 {
    function readDataFeedWithId(bytes32 dataFeedId) external view returns (int224 value, uint32 timestamp);
}
```

### APROOracle Contract
- Implements IOracleAdapter interface
- Wraps API3 dAPI proxy calls
- Handles price conversion (int224 → uint256)
- Validates data freshness

## Impact Assessment
- **User Stories Affected**: US-64 (Configure RWA Asset Oracle Data Source)
- **Architecture Changes**: New contract (APROOracle.sol)
- **Breaking Changes**: None

## Requirements Trace
- Traces to: specs/product.md#user-story-64-配置-rwa-资产-oracle-数据源
