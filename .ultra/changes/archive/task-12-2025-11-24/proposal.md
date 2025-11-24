# Feature: PNGYVault Deposit/Mint 优化

**Task ID**: 12
**Status**: In Progress
**Branch**: feat/task-12-deposit-mint

## Overview

增强 PNGYVault 的 deposit 和 mint 函数实现，添加 Gas 优化和更全面的单元测试覆盖。

## Rationale

Task #11 已实现基础的 deposit/mint 函数。Task #12 专注于:
1. Gas 优化 - 减少存储操作，优化事件参数
2. 测试增强 - 覆盖边界条件、模糊测试、Gas 报告

## Impact Assessment

- **User Stories Affected**: US-1.2 存入 USDT 获取 PNGY
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/product.md#user-story-12-存入-usdt-获取-pngy

## Implementation Plan

1. 审查现有 deposit/mint 实现
2. 添加 Gas 优化 (如有需要)
3. 添加模糊测试 (fuzz tests)
4. 添加边界条件测试
5. 生成 Gas 报告
