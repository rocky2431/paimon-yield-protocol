# Feature: 实现存款 UI 组件

**Task ID**: 42
**Status**: In Progress
**Branch**: feat/task-42-deposit-form

## Overview

实现前端存款功能组件，允许用户输入 USDT 金额并存入 PNGYVault 获取 PNGY 份额代币。

## Rationale

这是核心用户交互功能，用户需要通过直观的界面完成存款操作，包括:
- 输入存款金额 (最低 $500 USDT)
- 预览将获得的 PNGY 数量
- 执行 USDT 授权和存款交易
- 查看交易状态

## Impact Assessment

- **User Stories Affected**: US-1.2 存入 USDT 获取 PNGY
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/product.md#user-story-12-存入-usdt-获取-pngy

## Technical Design

### Components

1. **DepositForm.tsx** - 主存款表单组件
   - Amount input with validation (min $500)
   - Preview display (previewDeposit)
   - Gas estimation
   - Transaction buttons (Approve + Deposit)
   - Status indicators

### Hooks

- `useWriteContract` - 执行合约写入
- `useWaitForTransactionReceipt` - 等待交易确认
- `useReadContract` - 读取 previewDeposit, allowance

### State Flow

```
Input Amount → Validate → Check Allowance →
  If insufficient: Approve USDT → Wait for confirmation →
  Deposit → Wait for confirmation → Show success
```
