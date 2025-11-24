# Feature: 实现赎回 UI 组件

**Task ID**: 43
**Status**: In Progress
**Branch**: feat/task-43-withdraw-form

## Overview

实现前端赎回功能组件，允许用户输入 PNGY 数量并赎回获取 USDT。支持 T+1 赎回队列机制。

## Rationale

这是核心用户交互功能，用户需要通过直观的界面完成赎回操作，包括:
- 输入赎回的 PNGY 数量
- 预览将获得的 USDT 金额 (previewRedeem)
- 显示 T+1 到账提示
- 执行 requestWithdraw/claimWithdraw 交易
- 查看赎回队列状态

## Impact Assessment

- **User Stories Affected**: US-1.4 赎回 PNGY 获得 USDT
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/product.md#user-story-14-赎回-pngy-获得-usdt

## Technical Design

### Components

1. **WithdrawForm.tsx** - 主赎回表单组件
   - PNGY amount input
   - Preview display (previewRedeem)
   - T+1 queue info
   - Request withdraw button
   - Pending withdrawals list
   - Claim withdraw button

### Key Contract Functions

- `previewRedeem(shares)` - 预览赎回金额
- `requestWithdraw(shares, receiver)` - 请求赎回 (进入 T+1 队列)
- `claimWithdraw(requestId)` - 领取已到期的赎回
- `getWithdrawRequest(requestId)` - 获取赎回请求状态
- `getUserWithdrawRequests(user)` - 获取用户所有赎回请求

### State Flow

```
Input Shares → Preview USDT → Request Withdraw →
  Wait T+1 → Claim Withdraw → Success
```
