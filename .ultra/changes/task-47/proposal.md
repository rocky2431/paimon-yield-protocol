# Feature: Asset Allocation - RWA 资产配置展示

**Task ID**: 47
**Status**: Completed
**Branch**: feat/task-47-asset-allocation

## Overview

实现 RWA 资产配置展示组件，使用饼图和列表展示资产配比，显示每种资产的 APY、质量评级和持仓价值。

## Rationale

用户需要了解 Vault 的资产配置情况：
- 各 RWA 资产的配比
- 当前 APY 和质量评级
- 配比偏离目标时的预警
- 最近再平衡时间

## Implementation Summary

### Components Created
1. `components/AssetAllocation.tsx` - RWA 资产配置展示组件

### Features
- 饼图展示资产配比（使用 Recharts）
- 列表视图显示详细资产信息
- 视图切换（Chart/List）
- 汇总统计卡片（总价值、加权 APY、资产数量、最近再平衡）
- 配比偏离指示器（偏离 >2% 显示警告）
- 质量评级徽章（AAA/AA/A/BBB/BB/B）
- 加载状态、错误状态、空状态处理
- 响应式设计

### Tests
- 20 个组件测试全部通过
- 覆盖：渲染、资产详情、汇总统计、加载/错误/空状态、偏离指示、视图切换

## Impact Assessment
- **User Stories Affected**: US-22 (查看 RWA 资产配置)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-22-查看-rwa-资产配置
