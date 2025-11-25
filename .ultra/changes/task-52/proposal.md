# Feature: 后端 API - 获取历史净值数据

**Task ID**: 52
**Status**: In Progress
**Branch**: feat/task-52-netvalue-api

## Overview
实现 REST API 端点，提供 PNGY Vault 历史净值数据，支持前端收益曲线图表展示。

## Rationale
- 前端历史收益曲线组件 (Task #46) 需要后端数据源
- 需要支持不同时间范围查询 (7/30/90 天)
- 需要计算并返回 APY 数据

## Impact Assessment
- **User Stories Affected**: specs/product.md#user-story-21-查看历史收益曲线
- **Architecture Changes**: No (实现已规划的 API 端点)
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-21-查看历史收益曲线

## API Design

### Endpoint
```
GET /api/netvalue?days=30
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | number | 30 | 时间范围 (7, 30, 90) |

### Response Schema
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "timestamp": "2025-11-25T00:00:00Z",
        "sharePrice": "1050000000000000000",
        "totalAssets": "1000000000000000000000",
        "totalShares": "950000000000000000000",
        "apy": 5.26
      }
    ],
    "summary": {
      "currentPrice": "1050000000000000000",
      "startPrice": "1000000000000000000",
      "periodReturn": 5.0,
      "annualizedReturn": 60.0,
      "dataPoints": 720
    }
  }
}
```
