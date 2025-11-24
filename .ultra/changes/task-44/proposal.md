# Feature: Dashboard - 净值和收益展示

**Task ID**: 44
**Status**: Completed
**Branch**: feat/task-44-dashboard

## Overview

实现仪表板组件，显示 PNGY 当前净值、用户余额、总资产价值、累计收益和收益率。支持每 5 分钟自动刷新数据。

## Rationale

用户需要一个清晰的仪表板来查看其投资状态，包括：
- PNGY 代币的实时净值
- 个人持仓和价值
- 收益情况和 APY

## Implementation Summary

### Components Created
1. `components/Dashboard.tsx` - 主要仪表板组件
2. `app/dashboard/page.tsx` - Dashboard 页面路由

### Store Updates
扩展 `useVaultStore` 添加以下字段：
- `userAssetValue`: 用户资产 USDT 价值
- `accumulatedYield`: 累计收益
- `currentApy`: 当前 APY
- `lastUpdated`: 最后更新时间
- `initialDeposit`: 初始存款金额

### Features
- 显示 PNGY 净值 (totalAssets / totalSupply)
- 显示用户 PNGY 余额
- 显示用户资产总价值 (USDT)
- 显示累计收益
- 显示当前 APY
- 每 5 分钟自动刷新
- 手动刷新按钮
- 加载状态骨架屏
- 错误处理和重试

### Tests
- 13 个组件测试全部通过
- 12 个 store 测试全部通过

## Impact Assessment
- **User Stories Affected**: US-13 (查看实时净值和收益)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-13-查看实时净值和收益
