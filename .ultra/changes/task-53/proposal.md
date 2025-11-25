# Feature: 后端 API - 获取 RWA 资产配置数据

**Task ID**: 53
**Status**: In Progress
**Branch**: feat/task-53-asset-allocation-api

## Overview
实现 REST API 端点，提供 PNGY Vault 的 RWA 资产配置数据，支持前端资产配置展示组件。

## Rationale
- 前端资产配置展示组件 (Task #47) 需要后端数据源
- 需要从智能合约读取 rwaAssets[] 和 targetAllocations
- 需要从 Oracle 获取实时 APY 数据

## Impact Assessment
- **User Stories Affected**: specs/product.md#user-story-22-查看-rwa-资产配置
- **Architecture Changes**: No (实现已规划的 API 端点)
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-22-查看-rwa-资产配置

## API Design

### Endpoint
```
GET /api/assets/allocation
```

### Response Schema
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "tokenAddress": "0x...",
        "name": "BUIDL",
        "symbol": "BUIDL",
        "targetAllocation": 40,
        "actualAllocation": 38.5,
        "balance": "1000000000000000000000",
        "valueUsd": "1000000.00",
        "apy": 5.2,
        "isActive": true
      }
    ],
    "summary": {
      "totalValueUsd": "2500000.00",
      "averageApy": 5.8,
      "lastRebalance": "2025-11-20T12:00:00Z",
      "assetCount": 3
    }
  }
}
```

## Technical Approach
1. 从数据库 AssetAllocation 表读取配置数据
2. 如果配置了智能合约，从链上读取实时数据
3. 返回格式化的 JSON 响应
