# Feature: Performance Chart - 历史收益曲线图表

**Task ID**: 46
**Status**: Completed
**Branch**: feat/task-46-performance-chart

## Overview

实现历史收益曲线图表，使用 Recharts 库显示净值和 APY 趋势，支持时间筛选和 CSV 导出功能。

## Rationale

用户需要可视化查看收益历史：
- 净值变化趋势
- APY 波动情况
- 再平衡事件标记
- 不同时间周期对比

## Implementation Summary

### Components Created
1. `components/PerformanceChart.tsx` - 历史收益图表组件

### Features
- 双 Y 轴折线图（净值 + APY）
- 时间筛选（7D/30D/90D）
- 再平衡事件参考线标记
- 汇总统计卡片（当前净值、周期回报、当前 APY）
- CSV 数据导出
- 加载状态和错误处理
- 响应式设计

### Dependencies Added
- `recharts` - 图表库

### Configuration Changes
- `tsconfig.test.json` - 新增测试专用 TypeScript 配置
- `jest.config.js` - 更新使用 tsconfig.test.json

### Tests
- 17 个组件测试全部通过
- 覆盖：渲染、时间筛选、图表显示、汇总统计、加载状态、错误状态、数据导出

## Impact Assessment
- **User Stories Affected**: US-16 (查看历史收益曲线)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-16-查看历史收益曲线
