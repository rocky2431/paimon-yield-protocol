# Feature: 后端事件监听器 - 记录链上交易

**Task ID**: 54
**Status**: In Progress
**Branch**: feat/task-54-event-listener

## Overview
实现后端服务监听 PNGYVault 智能合约的链上事件，将交易记录持久化到 PostgreSQL 数据库。

## Rationale
- 前端交易历史页面需要后端 API 提供数据
- 链上事件是交易记录的权威数据源
- 需要处理链重组情况以保证数据一致性

## Impact Assessment
- **User Stories Affected**: specs/product.md#user-story-15-查看交易历史记录
- **Architecture Changes**: No (实现已规划的后端组件)
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/architecture.md#43-backend-components

## Technical Design

### Event Types to Monitor
1. `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)`
2. `Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)`
3. `RebalanceExecuted(address[] sellAssets, uint256[] sellAmounts, address[] buyAssets, uint256[] buyAmounts)`

### Key Components
- `EventListener` class using Viem for WebSocket subscriptions
- PostgreSQL storage via Prisma ORM
- Chain reorganization detection and handling
- Graceful shutdown and reconnection logic

### Data Flow
```
BSC Node (WebSocket) → EventListener → Event Parser → Prisma → PostgreSQL
```
