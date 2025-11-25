# Feature: 通知系统 - 邮件通知

**Task ID**: 56
**Status**: In Progress
**Branch**: feat/task-56-email-notifications

## Overview
实现邮件通知服务，支持用户订阅重要事件通知（赎回到账、资产再平衡、紧急暂停等）。

## Rationale
- 用户需要及时了解重要事件（赎回处理、再平衡执行等）
- 紧急情况（合约暂停、熔断触发）需要主动通知用户
- 提升用户体验和信任度

## Impact Assessment
- **User Stories Affected**: specs/product.md#user-story-16-接收通知赎回到账再平衡
- **Architecture Changes**: Yes (添加 NotificationPreference 数据模型)
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/product.md#user-story-16-接收通知赎回到账再平衡

## Technical Design

### 选择 Resend 作为邮件服务
- 现代 API 设计，TypeScript 优先
- 免费额度 3000 封/月
- 支持 React Email 模板

### 数据模型
```prisma
model NotificationPreference {
  id              String   @id @default(cuid())
  userAddress     String   @unique @db.VarChar(42)
  email           String?  @db.VarChar(255)
  emailVerified   Boolean  @default(false)
  withdrawalAlert Boolean  @default(true)
  rebalanceAlert  Boolean  @default(true)
  emergencyAlert  Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 通知类型
1. **WITHDRAWAL_COMPLETE** - 赎回到账通知
2. **REBALANCE_EXECUTED** - 再平衡执行通知
3. **EMERGENCY_PAUSE** - 紧急暂停通知
4. **CIRCUIT_BREAKER** - 熔断触发通知

### API Endpoints
```
POST /api/notifications/preferences - 设置通知偏好
GET  /api/notifications/preferences/:address - 获取通知偏好
POST /api/notifications/verify-email - 验证邮箱
```
