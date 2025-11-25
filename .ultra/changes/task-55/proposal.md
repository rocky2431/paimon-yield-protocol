# Feature: 后端定时任务 - 净值计算和存储

**Task ID**: 55
**Status**: In Progress
**Branch**: feat/task-55-netvalue-job

## Overview
实现定时任务，每小时计算并存储 PNGY Vault 的净值 (NAV)，为历史收益曲线和 API 提供数据支持。

## Rationale
- 前端需要历史净值数据展示收益曲线 (Task #46)
- 后端 API /api/netvalue 需要数据源 (Task #52)
- NAV 计算需要定期更新以反映 RWA 资产价格变化

## Impact Assessment
- **User Stories Affected**: specs/product.md#user-story-21-查看历史收益曲线
- **Architecture Changes**: No (实现已规划的后端组件)
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/architecture.md#13-data-flow-overview

## Technical Design

### NAV Calculation Formula
```
NAV = totalAssets / totalShares
totalAssets = sum(RWA_token_balance * RWA_token_price) + USDT_balance
```

### Components
1. `NetValueService` - 核心计算逻辑
2. `calculateNetValue` cron job - 每小时触发
3. Prisma NetValue model - 数据存储

### Data Flow
```
Cron Trigger (hourly)
       │
       ▼
 NetValueService
       │
  ┌────┴────┐
  │         │
  ▼         ▼
PNGYVault  OracleAdapter
(on-chain) (price feeds)
       │
       ▼
   Calculate
  totalAssets
       │
       ▼
  NetValue Table
  (PostgreSQL)
```
