# 架构修正摘要: RWA 资产集成模式

**日期**: 2025-11-22
**阶段**: Round 3 (技术选型) - Step 2 (深度分析)
**触发原因**: 用户反馈 - "只有一种 token 是自营的,其他资产是 BSC 已有的 RWA token"

---

## 📋 核心变更

### 变更前 (错误理解)
- **架构**: Paimon 作为 **RWA 资产发行方**
- **自营代币**: 3 种 (PNGY + TreasuryToken + RealEstateToken)
- **业务模式**: 垂直整合 (自己发行底层 RWA 资产)
- **开发工作量**: 需要开发 2 个额外的 RWA 代币合约

### 变更后 (正确架构)
- **架构**: Paimon 作为 **RWA 收益聚合器**
- **自营代币**: 1 种 (仅 PNGY - ERC4626 Vault Token)
- **业务模式**: 集成 BSC 已有的 RWA 代币 (如 Ondo OUSG, Backed bIB01)
- **开发工作量**: 减少,但需要集成多个外部 RWA 协议

---

## 🔄 影响的文档和章节

### 1. product.md 修改

#### Section 1.1 - 核心问题
**修改内容**:
```diff
+ BSC 链上缺少成熟的 RWA 收益聚合器，用户需要手动在多个 RWA 协议间配置
```

#### Section 3.1 - MVP 核心功能
**修改前**:
```
2. RWA 资产发行: 自发行国债代币 + 房地产代币（垂直整合核心）
```

**修改后**:
```
2. RWA 资产集成: 集成 BSC 已有的 RWA 代币（如 Ondo OUSG、Backed bIB01 等）
```

#### Section 3.2 - Epic 6: RWA 资产管理
**删除的 User Stories**:
- ❌ Story 6.1: 发行国债代币 (铸造) - 4-5 天
- ❌ Story 6.2: 发行房地产代币 (铸造) - 4-5 天
- ❌ Story 6.3: RWA 资产审计与上架 - 3 天

**新增的 User Stories**:
- ✅ Story 6.1: 集成 BSC 已有的 RWA 代币 - 2-3 天
- ✅ Story 6.2: 审核和移除 RWA 资产 - 2 天
- ✅ Story 6.3: 查看 RWA 资产详情 - 2 天
- ✅ Story 6.4: 配置 RWA 资产 Oracle 数据源 - 1-2 天
- ✅ Story 6.5: 测试 RWA 资产买卖流程 - 2 天

**工作量对比**:
- 原方案: 11-13 天 (自发行 2 个 RWA 代币)
- 新方案: 9-11 天 (集成已有 RWA 代币)
- **节省时间**: 2-4 天 ✅

#### Section 4.1.5 - 功能需求
**修改前**: RWA 资产发行 (Mint 逻辑)

**修改后**: RWA 资产集成与管理
- 新增: 通过 PancakeSwap DEX 购买 RWA 代币
- 新增: 通过 RWA 协议直接 mint 接口购买
- 新增: 滑点保护和流动性检查逻辑

#### Section 4.3 - 集成需求
**新增集成**:
- Integration 6: PancakeSwap DEX (RWA 资产交换)
- Integration 7: RWA 协议直接集成 (可选)

---

### 2. 智能合约架构修改

#### 删除的合约 (不再需要)
```diff
- contracts/core/TreasuryToken.sol      # ❌ 删除 (不自己发行国债代币)
- contracts/core/RealEstateToken.sol    # ❌ 删除 (不自己发行房地产代币)
```

#### 新增的合约
```diff
+ contracts/core/AssetRegistry.sol      # 🆕 RWA 资产注册表
+ contracts/strategies/RebalanceStrategy.sol  # 🆕 多资产再平衡策略
+ contracts/governance/AssetManager.sol  # 🆕 资产添加/移除管理
+ contracts/utils/SwapHelper.sol        # 🆕 DEX 交换辅助合约
```

#### 修改的合约
- **PNGYVault.sol**:
  - 添加 `rwaAssets[]` 数组 (管理多个 RWA 代币地址)
  - 添加 `addRWAAsset()` 函数 (添加已有 RWA 代币)
  - 修改 `totalAssets()` 函数 (聚合多个 RWA 代币的价值)
  - 添加 `rebalance()` 函数 (在多个 RWA 资产间动态配置)

---

### 3. 技术栈影响

#### 无影响的技术决策
- ✅ 智能合约框架: Foundry (不变)
- ✅ 前端框架: Next.js 14 (不变)
- ✅ 后端技术栈: Node.js + TypeScript (不变)
- ✅ 数据库: PostgreSQL (不变)
- ✅ 部署平台: Vercel + Railway (不变)

#### 新增的技术集成
- 🆕 PancakeSwap Router V2 集成
- 🆕 多个 RWA 协议 SDK 集成 (Ondo, Backed, etc.)
- 🆕 多 Oracle 数据源管理 (每个 RWA 资产独立 Oracle)

---

## 🚨 关键风险与缓解

### 风险 1: BSC 上 RWA 资产稀缺

**影响**: 如果 BSC 上找不到足够的 RWA 资产,项目无法按计划推进

**缓解策略**:
1. ✅ 立即进行 RWA 生态调研 (已创建调研清单)
2. ✅ 备选方案 A: 迁移到 Ethereum (RWA 生态成熟)
3. ✅ 备选方案 B: 跨链桥接 Ethereum RWA 资产
4. ✅ 备选方案 C: 与 RWA 项目方合作部署 BSC 版本

**决策点**: 调研第 3 天 (2025-11-25) - 如果找不到 ≥3 个 RWA 资产,触发备选方案

### 风险 2: 流动性不足

**影响**: DEX 流动性差导致高滑点,影响用户收益

**缓解策略**:
1. ✅ 只集成 TVL >$10M 的 RWA 资产
2. ✅ 优先选择支持直接 mint/redeem 的 RWA 协议 (绕过 DEX)
3. ✅ 实施 T+1 赎回机制,缓冲流动性压力
4. ✅ 限制单笔赎回金额 (如最大 $100K)

### 风险 3: Oracle 数据源缺失

**影响**: 无法准确计算 RWA 资产净值,影响 PNGY 价格

**缓解策略**:
1. ✅ 与 APRO (API3) 合作添加 RWA 资产数据源
2. ✅ 备选: 使用 Chainlink 或 RWA 项目方官方 Oracle
3. ✅ 最后手段: 多签人工更新 (仅用于低频更新的资产)

### 风险 4: KYC 要求

**影响**: 如果多数 RWA 资产要求 KYC,与"完全去中心化"定位冲突

**缓解策略**:
1. ✅ 调研时优先筛选无 KYC 的 RWA 资产
2. ✅ 备选方案: 调整产品定位为 B2B/机构用户 (接受 KYC)
3. ✅ 或开发 KYC 可选模式 (额外 2-3 周开发)

---

## 📊 开发时间影响

### Epic 6 工作量对比

| 任务 | 原方案 (自发行) | 新方案 (集成) | 变化 |
|------|------------------|----------------|------|
| 发行国债代币 | 4-5 天 | - | 删除 |
| 发行房地产代币 | 4-5 天 | - | 删除 |
| RWA 资产审计 | 3 天 | - | 删除 |
| 集成已有 RWA | - | 2-3 天 | 新增 |
| 审核/移除资产 | - | 2 天 | 新增 |
| 查看资产详情 | - | 2 天 | 新增 |
| 配置 Oracle | - | 1-2 天 | 新增 |
| 测试买卖流程 | - | 2 天 | 新增 |
| **总计** | **11-13 天** | **9-11 天** | **节省 2-4 天** ✅ |

### 总体项目时间表 (不变)

- ✅ 总开发周期: 10-14 周 (与 product.md 一致)
- ✅ Round 3 (技术选型): 按计划进行
- ✅ 无需调整整体交付时间

---

## ✅ 行动清单

### 立即行动 (Week 1: 2025-11-22 ~ 2025-11-29)

- [x] **创建 RWA 资产调研清单** ✅ 已完成
- [x] **修正 product.md** ✅ 已完成
- [ ] **开始 BSC RWA 生态调研**
  - [ ] 在 BscScan 搜索 RWA 代币
  - [ ] 查询 Ondo/Backed 是否支持 BSC
  - [ ] 联系 APRO/Chainlink 确认 Oracle 支持
  - [ ] 测试 PancakeSwap 流动性
- [ ] **完成 Round 3 剩余步骤**
  - [ ] Step 3: 分析验证 (向用户展示技术栈方案)
  - [ ] Step 4: 迭代决策 (根据用户反馈调整)
  - [ ] Step 5: 生成 architecture.md
  - [ ] Step 6: Round 3 满意度评分

### 短期行动 (Week 2: 2025-11-30 ~ 2025-12-06)

- [ ] **调研报告交付**
  - [ ] RWA 资产对比表 (Excel)
  - [ ] 集成可行性报告 (Markdown)
  - [ ] Oracle 集成方案 (技术文档)
  - [ ] 备选方案评估 (如果 BSC 不可行)
- [ ] **决策会议**
  - [ ] 确认最终 RWA 资产清单 (≥3 个)
  - [ ] 确认 Oracle 数据源方案
  - [ ] 决定链选择 (BSC vs Ethereum vs 跨链)

### 长期行动 (Week 3+)

- [ ] **开始合约开发** (如果调研通过)
  - [ ] PNGYVault.sol (ERC4626 + 多资产管理)
  - [ ] AssetRegistry.sol (资产注册表)
  - [ ] RebalanceStrategy.sol (动态再平衡)
  - [ ] SwapHelper.sol (DEX 集成)

---

## 📚 相关文档

### 新创建的文档
- `.ultra/docs/research/rwa-asset-research-checklist.md` - RWA 资产调研清单 (100% 完成)
- `.ultra/docs/research/architecture-correction-summary.md` - 本文档

### 修改的文档
- `.ultra/specs/product.md` - 已修正 Epic 6 和相关章节
- `.ultra/docs/research/metadata.json` - 已更新进度和变更日志

### 待创建的文档
- `.ultra/docs/research/rwa-asset-comparison.xlsx` - RWA 资产对比表 (调研后)
- `.ultra/docs/research/integration-feasibility-report.md` - 集成可行性报告 (调研后)
- `.ultra/specs/architecture.md` - 技术架构文档 (Round 3 完成后)

---

## 🎯 成功标准

本次架构修正成功的标准:

1. ✅ **文档一致性**: product.md 所有章节与新架构一致
2. ✅ **可行性验证**: RWA 调研找到 ≥3 个可集成资产
3. ✅ **技术栈确认**: Round 3 完成,architecture.md 生成
4. ✅ **团队对齐**: 所有团队成员理解新架构和风险
5. ✅ **时间不超期**: 修正工作不影响 14 周总体交付时间

---

## 📞 联系与反馈

**修正负责人**: [Ultra Research Agent]
**审核人**: [待指定]
**问题反馈**: 如有疑问请在 Round 3 Step 3 (分析验证) 阶段提出

---

**文档版本**: v1.0
**最后更新**: 2025-11-22
**状态**: ✅ 修正完成,等待调研结果
