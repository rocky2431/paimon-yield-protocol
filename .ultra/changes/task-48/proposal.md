# Feature: Asset Details Page - RWA 资产详情页面

**Task ID**: 48
**Status**: Completed
**Branch**: feat/task-48-asset-details

## Overview

实现 RWA 资产详情页面，展示每个资产的完整信息，包括项目方链接、审计报告、合约地址等。

## Rationale

用户需要查看每个 RWA 资产的详细信息：
- 资产名称、符号和描述
- 项目方信息和官网链接
- 当前 APY 和质量评级
- 配比偏离情况
- 审计报告和合约地址链接

## Implementation Summary

### Components Created
1. `components/AssetDetails.tsx` - RWA 资产详情组件
2. `app/assets/page.tsx` - 资产页面路由

### Features
- 资产卡片展示完整信息
- 汇总统计（资产数量、总锁仓价值、加权 APY）
- 资产类型图标
- 质量评级徽章
- 项目方网站链接
- 审计报告查看链接
- BSCScan 合约地址链接
- 配比偏离指示器
- 加载、错误、空状态处理
- 响应式卡片布局

### Tests
- 21 个组件测试全部通过
- 覆盖：渲染、资产信息、配比显示、外部链接、加载/错误/空状态、汇总统计

## Impact Assessment
- **User Stories Affected**: US-63 (查看 RWA 资产详情)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-63-查看-rwa-资产详情
