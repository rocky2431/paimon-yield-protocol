# Feature: 准备智能合约审计材料

**Task ID**: 38
**Status**: In Progress
**Branch**: feat/task-38-audit-materials

## Overview
整理所有智能合约代码，准备外部审计所需的完整材料包。

## Rationale
- 为外部专业审计公司准备必要文档
- 提供完整的代码上下文和设计说明
- 加速审计流程，减少沟通成本
- 满足 Task #77 (联系审计公司) 的前置条件

## Impact Assessment
- **User Stories Affected**: None (documentation only)
- **Architecture Changes**: No
- **Breaking Changes**: No

## Requirements Trace
- Traces to: specs/architecture.md#74-smart-contract-security

## Deliverables
1. **docs/audit-scope.md** - 审计范围和核心逻辑说明
2. **Test Coverage Report** - Forge coverage 报告
3. **Gas Usage Report** - Forge gas-report 输出
4. **Static Analysis Reports** - Slither/Mythril 报告 (已在 Task #76 完成)

## Audit Scope
- Core Contracts: PNGYVault, AssetRegistry, OracleAdapter, SwapHelper, RebalanceStrategy
- Key Functions: deposit, withdraw, redeem, rebalance, oracle failover
- Security Focus: Access control, reentrancy, arithmetic overflow, oracle manipulation
