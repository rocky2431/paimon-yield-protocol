# Feature: 智能合约集成测试

**Task ID**: 72
**Status**: In Progress
**Branch**: feat/task-72-integration-tests

## Overview
编写端到端集成测试，验证完整业务流程的正确性。

## Rationale
- 验证组件间集成正确性
- 模拟真实用户操作流程
- 测试 Oracle 故障切换机制
- 为主网部署提供信心保障

## Impact Assessment
- **User Stories Affected**: None (testing infrastructure)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/architecture.md#92-smart-contract-testing

## Test Scenarios
1. **Complete Deposit Flow** - approve → deposit → RWA purchase → shares minted
2. **Complete Redeem Flow** - redeem → RWA sale → USDT returned
3. **Rebalance Flow** - allocation change → sell/buy RWA
4. **Oracle Failover** - primary oracle fails → fallback activated
5. **Multi-User Scenarios** - concurrent deposits/withdrawals
6. **Circuit Breaker** - NAV drop → emergency mode
