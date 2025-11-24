# Feature: Transaction History - 交易历史页面

**Task ID**: 45
**Status**: Completed
**Branch**: feat/task-45-transaction-history

## Overview

实现交易历史页面，显示用户的存款和赎回记录，支持时间筛选和 CSV 导出功能。

## Rationale

用户需要查看其交易历史记录，包括：
- 存款和赎回交易详情
- 交易状态追踪
- BSCScan 交易查看链接
- 数据导出功能

## Implementation Summary

### Components Created
1. `components/TransactionHistory.tsx` - 交易历史组件
2. `app/history/page.tsx` - 历史页面路由

### Features
- 显示交易列表 (日期、类型、金额、状态)
- 时间筛选 (7天/30天/全部)
- CSV 导出功能
- BSCScan 交易链接
- 加载状态和错误处理
- 空状态提示
- 响应式表格设计

### Tests
- 19 个组件测试全部通过
- 覆盖：渲染、数据展示、筛选、导出、加载状态、空状态、错误状态

## Impact Assessment
- **User Stories Affected**: US-15 (查看交易历史记录)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-15-查看交易历史记录
