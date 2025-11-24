# Product Specification

> **Source of Truth**: This document defines WHAT the system does and WHY. Technology choices belong in `architecture.md`.

## 1. Problem Statement

### 1.1 Core Problem

加密货币投资者面临 DeFi 收益不稳定的核心痛点，特别是 2024-2025 年多数 DeFi 协议的 APY 从 15-20% 大幅下降至 3-5%，导致资金闲置或被迫承受高波动性风险。

**根本原因**：
- DeFi 收益主要依赖协议代币激励和流动性挖矿，随着代币释放减少和市场降温，收益持续下滑
- 传统稳定币存款（如 Aave USDT）收益率已降至 3-4%，难以满足投资者的收益预期
- 真实世界资产（RWA）虽然提供稳定收益（4-8% APY），但普通用户难以直接投资
- BSC 链上缺少成熟的 RWA 收益聚合器，用户需要手动在多个 RWA 协议间配置

**问题影响**：
- 用户痛点：数千万美元的 USDT 闲置在钱包或低收益协议中，错失稳定收益机会
- 市场空白：BSC 链上缺少优质的 RWA 收益聚合器，用户只能选择以太坊项目（Gas 费高）
- 信任危机：现有 RWA 项目缺乏透明度，用户对底层资产质量存疑

**如果不解决**：
- 加密货币投资者继续承受高波动性风险或接受极低收益
- BSC 生态失去中低风险收益产品，用户流向以太坊或 Solana
- RWA 资产无法有效触达普通加密用户，阻碍 TradFi + DeFi 融合

### 1.2 Current Pain Points

1. **DeFi 收益不稳定且持续下滑**
   - 2024 年多数 DeFi 协议 APY 从 15-20% 降至 3-5%
   - 依赖代币激励的流动性挖矿不可持续
   - 市场降温导致交易量和手续费收入下降

2. **RWA 资产接入门槛高**
   - 优质 RWA 项目（如 Ondo Finance）主要部署在以太坊（Gas 费高达 $20-$100）
   - 需要 KYC 认证（如 Ondo OUSG），排除大量匿名用户
   - BSC 链上几乎没有成熟的 RWA 收益产品

3. **缺乏透明度和信任机制**
   - 现有 RWA 项目对底层资产披露不充分
   - 净值计算过程不透明，用户无法验证
   - 缺少第三方审计和保险机制

4. **资金效率低下**
   - 用户需要手动在多个协议间切换以优化收益
   - 小额资金（<$10K）难以分散投资多种 RWA 资产
   - 赎回周期长（部分 RWA 需要 7-30 天）影响流动性

### 1.3 How Users Currently Solve This

**现有解决方案及其不足**：

1. **使用以太坊 RWA 协议（如 Ondo Finance）**
   - 方法：在以太坊上购买 OUSG（美国国债代币）或 USDY
   - 不足：Gas 费高（$20-$100/笔）、需要 KYC、不适合小额投资者

2. **使用传统 DeFi 借贷协议（如 Aave、Compound）**
   - 方法：存入 USDT 获取借贷利息
   - 不足：APY 仅 3-4%，且波动大，难以满足稳定收益需求

3. **手动配置多协议组合**
   - 方法：同时使用 DeFi 协议 + CEX 理财 + 部分 RWA
   - 不足：管理复杂、资金分散、需要持续监控和再平衡

4. **使用中心化交易所（CEX）理财产品**
   - 方法：Binance Earn、OKX Earn 等固定收益产品
   - 不足：中心化风险（FTX 事件后信任度下降）、收益率低（3-5%）、资金不透明

**为什么这些方案不足够**：
- ❌ 缺少 BSC 原生的 RWA 聚合方案（Gas 费低、适合小额）
- ❌ 缺少去中心化且透明的 RWA 收益产品（无需 KYC）
- ❌ 缺少垂直整合方案（从 RWA 发行到收益聚合的端到端解决方案）

---

## 2. Users & Stakeholders

### 2.1 Primary User Segments

**混合型用户策略**：Paimon Yield Protocol 同时服务三类用户群体，形成多层次的收益生态。

- **Segment 1: B2C（个人加密投资者）**
  - **规模**: BSC 链上活跃地址 ~200 万，目标覆盖 5-10% 中等资产用户（$5K-$100K）
  - **优先级**: **P0**（核心用户，占预期 TVL 的 60-70%）
  - **特征**:
    - 持有 $5K-$100K USDT/BUSD，寻求稳定收益（4-8% APY）
    - 对 DeFi 有基本了解，使用过 PancakeSwap、Venus 等 BSC 协议
    - 风险偏好：中低风险，优先考虑本金安全和收益稳定性
    - 痛点：DeFi 收益下滑，不愿承受高波动性，但又不信任中心化交易所

- **Segment 2: B2B（机构投资者 / 加密基金）**
  - **规模**: 亚洲加密基金 ~50-100 家，目标覆盖 10-20 家中小型基金
  - **优先级**: **P1**（高价值用户，单笔 TVL $100K-$1M+）
  - **特征**:
    - 管理 $1M-$50M 资产，需要合规的稳定收益渠道
    - 重视透明度、审计报告、历史表现
    - 需要定制化服务（如白名单、API 集成、大额赎回优先通道）
    - 痛点：RWA 产品选择少，KYC 流程繁琐，缺少 BSC 生态的优质选项

- **Segment 3: B2D（DeFi 协议集成）**
  - **规模**: BSC 上 DeFi 协议 ~200 个，目标集成 5-10 个头部协议
  - **优先级**: **P2**（生态扩展，占预期 TVL 的 10-20%）
  - **特征**:
    - 需要稳定收益来源为其用户提供"保本理财"功能
    - 通过 ERC4626 标准接口集成 Paimon 的 PNGY 代币
    - 典型场景：DEX 的闲置流动性管理、钱包的收益增强功能
    - 痛点：缺少可靠的 RWA 收益聚合器作为底层基础设施

### 2.2 User Characteristics

**B2C 个人投资者画像**（核心用户群）：

- **Demographics（人口统计）**:
  - 年龄：25-45 岁，以 30-40 岁为主
  - 地理分布：东南亚（新加坡、马来西亚、泰国）、东亚（中国香港、台湾、韩国）
  - 职业：科技从业者、金融从业者、自由职业者、早期加密投资者
  - 资产规模：$5K-$100K 加密资产（以 USDT/BUSD 为主）

- **Technical Proficiency（技术熟练度）**:
  - 级别：**中级**（熟悉 DeFi 基本操作，但不是技术专家）
  - 能力：
    - ✅ 会使用 MetaMask/Trust Wallet 连接 DApp
    - ✅ 了解 Swap、流动性挖矿、借贷等 DeFi 基础概念
    - ⚠️ 对智能合约风险有一定认知，但无法自己审计代码
    - ❌ 不熟悉 RWA 资产类型和净值计算逻辑（需要用户教育）

- **Common Behaviors（常见行为）**:
  - 使用频率：每周查看 1-3 次净值和收益，每月操作 1-2 次（存入/赎回）
  - 决策周期：从了解产品到首次存款约 2-7 天（需要建立信任）
  - 资金管理：分散投资，通常将 20-40% 资产配置到稳定收益产品
  - 信息来源：Twitter、Telegram 社群、KOL 推荐、审计报告

- **Key Needs（关键需求）**:
  1. **稳定收益** - 4-8% APY，可预测，波动小
  2. **本金安全** - 需要多次审计、保险机制、透明的资产披露
  3. **低门槛** - BSC Gas 费低（$0.1-$0.5），无需 KYC，$500 起投
  4. **流动性** - 随时赎回（T+1 到账），无锁定期
  5. **透明度** - 实时查看净值、底层资产配置、历史收益曲线

### 2.3 Secondary Stakeholders

**次要利益相关者**（影响项目成功但非直接用户）：

- **RWA 资产合作伙伴**
  - 角色：提供 RWA 代币（如国债代币、房地产代币）或白标发行合作
  - 影响：决定可接入的 RWA 资产类型和质量，影响收益表现
  - 需求：希望通过 Paimon 扩大其 RWA 资产的流通和使用场景
  - 风险：如果合作伙伴违约或资产质量差，会直接影响 Paimon 声誉

- **安全审计机构**（如 CertiK、SlowMist）
  - 角色：审计智能合约和 RWA 代币，提供安全报告
  - 影响：审计报告是建立用户信任的关键背书
  - 需求：希望审计过程顺畅，代码质量高，减少审计轮次
  - 风险：如果审计遗漏重大漏洞，审计机构声誉也会受损

- **法律合规顾问**
  - 角色：确保 RWA 发行和聚合业务符合当地监管要求
  - 影响：决定项目的合规策略（完全去中心化 vs 混合 KYC）
  - 需求：希望项目合规运营，避免监管风险
  - 风险：如果法律框架不完善，可能面临 SEC 等监管机构调查

- **BSC 生态合作伙伴**（如 PancakeSwap、Venus）
  - 角色：潜在的 B2D 集成方，推广 Paimon 的 PNGY 代币
  - 影响：生态合作可以快速扩大 TVL 和用户基础
  - 需求：希望 Paimon 提供稳定可靠的收益来源，增强其产品竞争力
  - 风险：如果 Paimon 出现安全问题，会影响合作伙伴的声誉

- **社区 KOL 和内容创作者**
  - 角色：在 Twitter、YouTube、Telegram 推广 Paimon
  - 影响：影响用户的首次信任和存款决策
  - 需求：希望获得推广激励（空投、推荐奖励）
  - 风险：如果 KOL 推广不当或夸大收益，可能引发监管关注

## 3. User Stories

### 3.1 MVP Feature Scope

**MVP 交付策略**: 一次性交付（14 周，无分阶段）

**MVP 核心功能**（必需）:
1. **B2C 核心流程**: 存款、查看净值/收益、赎回、交易历史
2. **RWA 资产集成**: 集成 BSC 已有的 RWA 代币（如 Ondo OUSG、Backed bIB01 等）
3. **数据透明**: 实时净值计算、RWA 资产配置展示、历史收益曲线
4. **B2D 协议集成**: ERC4626 标准接口（支持其他 DeFi 协议集成）
5. **应急机制**: 暂停/恢复、Circuit Breaker、多签治理
6. **动态再平衡**: 收益优先的多 RWA 资产配置调整（链下计算 + 链上执行）

**Post-MVP 功能**（Phase 2）:
- B2B 定制化报表和大额赎回优先通道
- 推荐奖励系统（用户增长激励）
- 跨链桥集成（支持以太坊 ↔ BSC 资产转移）
- AI 驱动的再平衡优化

---

### 3.2 Epic Breakdown

#### Epic 1: B2C 核心流程（存款 → 查看 → 赎回）

**User Story 1.1: 连接钱包**

**As a** B2C 个人投资者
**I want to** 使用 MetaMask/Trust Wallet 连接 Paimon 协议
**So that** 安全地进行存款和赎回操作

**Acceptance Criteria**:
- [ ] 支持 MetaMask 和 Trust Wallet
- [ ] 显示当前连接的钱包地址和 USDT 余额
- [ ] 网络检查：如果不是 BSC 主网，提示切换
- [ ] 断开连接功能

**Priority**: P0
**Estimated Effort**: 1-2 天
**Trace to**: product.md#2.2（B2C 用户特征 - 技术熟练度中级）

---

**User Story 1.2: 存入 USDT 获取 PNGY**

**As a** B2C 个人投资者
**I want to** 存入 USDT 获取 PNGY 代币
**So that** 开始赚取 RWA 稳定收益

**Acceptance Criteria**:
- [ ] 输入存款金额（最低 $500）
- [ ] 预览预期获得的 PNGY 数量（基于当前净值）
- [ ] 批准 USDT 授权（ERC20 approve）
- [ ] 执行 deposit 交易
- [ ] 交易确认后显示新的 PNGY 余额
- [ ] Gas 费用预估展示

**Priority**: P0
**Estimated Effort**: 3-4 天
**Trace to**: product.md#1.1（核心问题 - DeFi 收益不稳定）

---

**User Story 1.3: 查看实时净值和收益**

**As a** B2C 个人投资者
**I want to** 查看 PNGY 的实时净值和我的累计收益
**So that** 了解我的投资表现

**Acceptance Criteria**:
- [ ] 显示 PNGY 当前净值（USDT per PNGY）
- [ ] 显示我的 PNGY 余额
- [ ] 显示我的总资产价值（PNGY 余额 × 净值）
- [ ] 显示累计收益（当前价值 - 本金）
- [ ] 显示累计收益率（%）
- [ ] 数据每小时自动刷新

**Priority**: P0
**Estimated Effort**: 2-3 天
**Trace to**: product.md#2.2（用户需求 - 稳定收益 4-8% APY）

---

**User Story 1.4: 赎回 PNGY 获得 USDT**

**As a** B2C 个人投资者
**I want to** 赎回部分或全部 PNGY 获得 USDT
**So that** 提取我的本金和收益

**Acceptance Criteria**:
- [ ] 输入赎回的 PNGY 数量
- [ ] 预览预期获得的 USDT 金额（基于当前净值）
- [ ] 显示 T+1 到账提示（需要等待 RWA 资产清算）
- [ ] 执行 withdraw 交易
- [ ] 交易确认后，PNGY 余额减少
- [ ] T+1 后，USDT 到账通知

**Priority**: P0
**Estimated Effort**: 3-4 天
**Trace to**: product.md#2.2（用户需求 - 流动性 T+1 到账）

---

**User Story 1.5: 查看交易历史记录**

**As a** B2C 个人投资者
**I want to** 查看我的所有存款和赎回交易历史
**So that** 追踪我的资金流动和操作记录

**Acceptance Criteria**:
- [ ] 显示交易列表（存款、赎回）
- [ ] 每条记录包含：时间、类型、金额（USDT/PNGY）、交易状态
- [ ] 支持按时间筛选（7 天、30 天、全部）
- [ ] 支持导出交易记录（CSV）
- [ ] 点击交易可查看区块链浏览器详情

**Priority**: P0
**Estimated Effort**: 2 天
**Trace to**: product.md#2.2（用户需求 - 透明度）

---

**User Story 1.6: 接收通知（赎回到账、再平衡）**

**As a** B2C 个人投资者
**I want to** 接收重要事件的通知（如赎回到账、资产再平衡）
**So that** 及时了解协议状态和我的资金变化

**Acceptance Criteria**:
- [ ] 通知类型：赎回到账、资产再平衡、紧急暂停、Circuit Breaker 触发
- [ ] 支持多种通知渠道：浏览器通知、邮件（可选）
- [ ] 用户可在设置中自定义通知偏好
- [ ] 通知历史记录可查看

**Priority**: P1
**Estimated Effort**: 3 天
**Trace to**: product.md#2.2（用户行为 - 每周查看 1-3 次净值）

---

#### Epic 2: 数据透明与分析

**User Story 2.1: 查看历史收益曲线**

**As a** B2C 个人投资者
**I want to** 查看 PNGY 的历史净值和收益曲线
**So that** 评估协议的长期表现

**Acceptance Criteria**:
- [ ] 折线图展示 PNGY 净值历史（7 天、30 天、90 天）
- [ ] 显示年化收益率（APY）趋势
- [ ] 标注关键事件（如资产再平衡）
- [ ] 支持导出数据（CSV）

**Priority**: P1
**Estimated Effort**: 2-3 天
**Trace to**: product.md#2.2（用户需求 - 透明度 - 历史收益曲线）

---

**User Story 2.2: 查看 RWA 资产配置**

**As a** B2C 个人投资者
**I want to** 查看底层 RWA 资产的当前配置比例
**So that** 了解我的资金投向

**Acceptance Criteria**:
- [ ] 饼图或柱状图展示国债代币 vs 房地产代币的配比
- [ ] 显示每种资产的当前 APY
- [ ] 显示每种资产的质量评级（如 AAA、AA）
- [ ] 显示最近一次再平衡时间

**Priority**: P1
**Estimated Effort**: 2 天
**Trace to**: product.md#2.2（用户需求 - 透明度 - 底层资产配置）

---

#### Epic 3: B2D 协议集成（ERC4626）

**User Story 3.1: ERC4626 标准接口实现**

**As a** DeFi 协议开发者
**I want to** 通过 ERC4626 标准接口集成 PNGY
**So that** 为我的用户提供 RWA 收益功能

**Acceptance Criteria**:
- [ ] 实现 `deposit(assets, receiver)` 函数
- [ ] 实现 `withdraw(assets, receiver, owner)` 函数
- [ ] 实现 `previewDeposit(assets)` 函数
- [ ] 实现 `previewRedeem(shares)` 函数
- [ ] 实现 `totalAssets()` 函数
- [ ] 通过 ERC4626 兼容性测试套件

**Priority**: P0（从 P1 提升）
**Estimated Effort**: 3-4 天
**Trace to**: product.md#2.1（B2D 用户细分 - 需求：稳定收益来源）

---

**User Story 3.2: 提供集成文档和示例**

**As a** DeFi 协议开发者
**I want to** 清晰的集成文档和代码示例
**So that** 快速集成 PNGY 到我的协议

**Acceptance Criteria**:
- [ ] Markdown 文档说明 ERC4626 接口用法
- [ ] Solidity 集成示例代码
- [ ] JavaScript/TypeScript SDK 示例
- [ ] 测试网合约地址和 ABI

**Priority**: P2
**Estimated Effort**: 1-2 天
**Trace to**: product.md#2.1（B2D 用户细分 - 典型场景：DEX 闲置流动性管理）

---

#### Epic 4: Admin 治理与应急机制

**User Story 4.1: 执行动态再平衡**

**As a** 协议管理员
**I want to** 根据收益差异动态调整 RWA 资产配比
**So that** 最大化用户收益

**Acceptance Criteria**:
- [ ] 链下引擎计算最优配比（基于两种资产的 APY 差异）
- [ ] 生成再平衡交易参数（买入/卖出数量）
- [ ] 提交到多签钱包（3/5 批准）
- [ ] 多签批准后，链上执行资产买卖
- [ ] 更新净值计算逻辑
- [ ] 记录再平衡事件（Event log）

**Priority**: P1
**Estimated Effort**: 5-6 天
**Trace to**: Round 2 Step 1 用户答复（动态调整 - 收益优先）

---

**User Story 4.2: 暂停/恢复合约**

**As a** 协议管理员
**I want to** 在紧急情况下暂停合约
**So that** 保护用户资金安全

**Acceptance Criteria**:
- [ ] 多签钱包调用 `pause()` 函数
- [ ] 暂停后，禁止 deposit 和 withdraw 操作
- [ ] 前端显示"系统维护中"提示
- [ ] 多签钱包调用 `unpause()` 恢复
- [ ] 记录暂停/恢复事件（Event log）

**Priority**: P0
**Estimated Effort**: 2 天
**Trace to**: Round 2 Step 1 用户答复（应急机制 - 暂停机制）

---

**User Story 4.3: 配置 Circuit Breaker**

**As a** 协议管理员
**I want to** 配置净值下跌熔断阈值
**So that** 自动限制异常交易

**Acceptance Criteria**:
- [ ] 设置净值下跌阈值（如 -5%）
- [ ] 当净值单日下跌超过阈值时，自动触发 Circuit Breaker
- [ ] Circuit Breaker 触发后，限制单笔赎回金额（如最大 $10K）
- [ ] 管理员可手动解除 Circuit Breaker
- [ ] 记录触发事件（Event log）

**Priority**: P1
**Estimated Effort**: 3-4 天
**Trace to**: Round 2 Step 1 用户答复（应急机制 - 熔断机制）

---

**User Story 4.4: 多签治理操作**

**As a** 协议管理员
**I want to** 所有重大操作需要多签批准
**So that** 防止单点故障和恶意操作

**Acceptance Criteria**:
- [ ] 集成 Gnosis Safe（3/5 多签）
- [ ] 以下操作需要多签批准：资产再平衡、暂停/恢复合约、更新 Oracle 数据源、修改 Circuit Breaker 参数
- [ ] 前端显示待批准交易列表
- [ ] 记录所有多签操作（Event log）

**Priority**: P0
**Estimated Effort**: 3 天
**Trace to**: Round 2 Step 1 用户答复（应急机制 - 多签治理）

---

#### Epic 5: B2B 机构支持

**User Story 5.1: B2B 定制化报表**

**As a** B2B 机构投资者
**I want to** 导出详细的投资报表
**So that** 满足合规和内部审计需求

**Acceptance Criteria**:
- [ ] 支持导出 CSV 格式报表
- [ ] 报表内容：交易历史、净值变化、收益明细
- [ ] 支持自定义时间范围
- [ ] 显示手续费明细

**Priority**: P2
**Estimated Effort**: 2 天
**Trace to**: product.md#2.1（B2B 用户细分 - 需求：审计报告）

---

**User Story 5.2: 大额赎回优先通道**

**As a** B2B 机构投资者
**I want to** 大额赎回（≥$100K）获得优先处理
**So that** 快速获得流动性

**Acceptance Criteria**:
- [ ] 识别大额赎回请求（≥$100K）
- [ ] 提前通知协议管理员准备链下 RWA 资产清算
- [ ] 尽量在 T+0.5（12 小时）内完成清算
- [ ] 记录大额赎回处理时效

**Priority**: P2
**Estimated Effort**: 2-3 天
**Trace to**: product.md#2.1（B2B 用户细分 - 需求：大额赎回优先通道）

---

#### Epic 6: RWA 资产集成与管理

**User Story 6.1: 集成 BSC 已有的 RWA 代币**

**As a** 协议管理员
**I want to** 添加 BSC 上已有的 RWA 代币到 Paimon 资产池
**So that** 用户可以通过 PNGY 投资多样化的 RWA 资产

**Acceptance Criteria**:
- [ ] 调用 `AssetRegistry.registerAsset()` 添加 RWA 代币地址（如 Ondo OUSG、Backed bIB01）
- [ ] 配置该 RWA 资产的 Oracle 数据源（APRO/Chainlink/项目方 Oracle）
- [ ] 设置目标配比（如 OUSG 占 50%，bIB01 占 30%）
- [ ] 执行首次资产购买（使用 Vault 的 USDT 通过 DEX 或协议购买 RWA 代币）
- [ ] 前端显示新添加的 RWA 资产及其当前 APY
- [ ] 记录资产添加事件（Event log）

**Priority**: P0
**Estimated Effort**: 2-3 天
**Trace to**: product.md#1.1（解决方案 - 集成已有 RWA 资产）

**技术细节**:
- 通过 PancakeSwap Router 购买 RWA 代币（如果有流动性池）
- 或直接调用 RWA 协议的 mint 接口（如 Ondo 的 mint 功能）
- 需要提前测试交易滑点和流动性

---

**User Story 6.2: 审核和移除 RWA 资产**

**As a** 协议管理员
**I want to** 审核 RWA 资产质量并移除表现不佳的资产
**So that** 保护用户资金安全和收益稳定性

**Acceptance Criteria**:
- [ ] 查看每个 RWA 资产的历史 APY 和净值变化
- [ ] 如果 RWA 资产出现重大风险（如底层资产违约、项目方跑路），标记为"待移除"
- [ ] 多签批准后，调用 `AssetManager.removeAsset()` 移除资产
- [ ] 移除前，先将该 RWA 代币卖出换回 USDT（通过 DEX 或赎回）
- [ ] 更新资产配比，将移除资产的份额分配给其他健康资产
- [ ] 前端显示资产移除通知（推送给所有用户）

**Priority**: P1
**Estimated Effort**: 2 天
**Trace to**: product.md#1.2（痛点 3 - 缺乏透明度和信任机制）

---

**User Story 6.3: 查看 RWA 资产详情**

**As a** B2C 个人投资者
**I want to** 查看 PNGY 底层持有的所有 RWA 资产详情
**So that** 了解我的资金投向和每种资产的质量

**Acceptance Criteria**:
- [ ] 前端调用 `AssetRegistry.getAllAssets()` 获取资产列表
- [ ] 显示每个 RWA 资产的:
  - 名称和符号（如 "Ondo OUSG - US Short-Term Treasuries"）
  - 项目方官网链接
  - 当前 APY（从 Oracle 实时获取）
  - Vault 持有数量和价值（USDT 计价）
  - 目标配比 vs 当前配比（如目标 50%，实际 48%）
  - 底层资产类型（国债/房地产/信贷/其他）
  - 审计报告链接（如果项目方提供）
- [ ] 点击资产名称跳转到 RWA 项目官网
- [ ] 显示最近一次再平衡时间和配比变化

**Priority**: P1
**Estimated Effort**: 2 天
**Trace to**: product.md#2.2（用户需求 - 透明度 - 底层资产配置）

---

**User Story 6.4: 配置 RWA 资产 Oracle 数据源**

**As a** 协议管理员
**I want to** 为每个 RWA 资产配置可靠的 Oracle 数据源
**So that** 确保净值计算准确和实时更新

**Acceptance Criteria**:
- [ ] 为主流 RWA 资产配置 APRO (API3) dAPI 地址
- [ ] 为备用方案配置 Chainlink Price Feed 地址
- [ ] 如果 APRO/Chainlink 均不支持，配置 RWA 项目方官方 Oracle
- [ ] 实现自动切换逻辑：APRO 失效（>2 小时未更新）→ 切换到 Chainlink
- [ ] 测试 Oracle 数据更新频率（建议每小时更新一次）
- [ ] 前端显示每个资产的 Oracle 数据源和最后更新时间

**Priority**: P0
**Estimated Effort**: 1-2 天
**Trace to**: User Story 1.3（查看实时净值）

---

**User Story 6.5: 测试 RWA 资产买卖流程**

**As a** 开发团队
**I want to** 在测试网测试 RWA 资产的买入和卖出流程
**So that** 确保主网上线时交易顺畅

**Acceptance Criteria**:
- [ ] 在 BSC 测试网部署测试环境
- [ ] 模拟购买 RWA 代币（通过 PancakeSwap 测试网或 Mock 合约）
- [ ] 测试交易滑点（$1K/$10K/$100K 订单）
- [ ] 测试赎回流程（卖出 RWA 代币换回 USDT）
- [ ] 测试 Oracle 价格更新和净值计算
- [ ] 记录 Gas 费用（确保 <$0.5/笔）
- [ ] 编写集成测试脚本（Foundry 测试）

**Priority**: P0
**Estimated Effort**: 2 天
**Trace to**: product.md#5.3（性能要求 - 低 Gas 费）

---

#### Epic 7: 用户增长

**User Story 7.1: 推荐奖励系统**

**As a** B2C 个人投资者
**I want to** 推荐新用户获得奖励
**So that** 分享收益并扩大用户基础

**Acceptance Criteria**:
- [ ] 生成唯一推荐码/推荐链接
- [ ] 新用户通过推荐链接注册，绑定推荐关系
- [ ] 新用户首次存款后，推荐人获得奖励（如 0.5% 返佣）
- [ ] 推荐奖励自动发放到推荐人钱包
- [ ] 显示推荐统计（推荐人数、累计奖励）

**Priority**: P2
**Estimated Effort**: 3-4 天
**Trace to**: product.md#2.2（用户需求 - 社区 KOL 推广）

---

### 3.3 Key User Scenarios

**Scenario 1: B2C 用户首次存款流程**
- 用户目标：首次使用 Paimon 协议，存入 $5K USDT 赚取稳定收益
- 步骤：
  1. 访问 Paimon DApp → 连接 MetaMask（Story 1.1）
  2. 阅读"新手引导"了解 PNGY 机制和 RWA 资产
  3. 查看当前 APY（如 5.2%）和 RWA 资产配置（Story 2.2）
  4. 输入存款金额 $5K → 批准 USDT 授权 → 执行 deposit（Story 1.2）
  5. 交易确认后，查看 PNGY 余额和预期年化收益（Story 1.3）
- 预期结果：用户成功存入 $5K USDT，获得对应数量的 PNGY 代币，开始累积收益

**Scenario 2: B2C 用户定期查看收益并赎回**
- 用户目标：每周查看收益表现，30 天后赎回部分资金
- 步骤：
  1. 连接钱包 → 查看仪表板（Story 1.3）
  2. 查看累计收益（如 +$25，+0.5%）
  3. 查看历史收益曲线，评估协议表现（Story 2.1）
  4. 30 天后，决定赎回 $2K → 输入赎回金额 → 执行 withdraw（Story 1.4）
  5. T+1 后，收到"赎回到账"通知（Story 1.6），USDT 到账
- 预期结果：用户成功赎回 $2K USDT，剩余 $3K 继续累积收益

**Scenario 3: B2D 协议集成 PNGY**
- 用户目标：PancakeSwap 集成 PNGY，为用户提供"闲置 USDT 自动赚取 RWA 收益"功能
- 步骤：
  1. PancakeSwap 开发者阅读集成文档（Story 3.2）
  2. 在智能合约中调用 PNGY 的 ERC4626 接口（Story 3.1）
  3. 用户在 PancakeSwap 存入 USDT → PancakeSwap 合约自动调用 PNGY.deposit()
  4. 用户赎回时 → PancakeSwap 合约调用 PNGY.withdraw()
- 预期结果：PancakeSwap 成功集成 PNGY，用户无需离开 PancakeSwap 即可赚取 RWA 收益

**Scenario 4: Admin 执行动态再平衡**
- 用户目标：协议管理员根据 APY 差异调整 RWA 资产配比，优化收益
- 步骤：
  1. 链下引擎检测到国债 APY 5.0%，房地产 APY 6.5%（Story 4.1）
  2. 引擎计算最优配比：国债 30% → 房地产 70%
  3. 生成再平衡交易参数 → 提交到 Gnosis Safe 多签
  4. 3/5 管理员批准 → 链上执行：卖出部分国债代币，买入房地产代币（Story 4.4）
  5. 更新净值计算逻辑 → 前端显示新配比（Story 2.2）
  6. 向所有用户发送"资产再平衡完成"通知（Story 1.6）
- 预期结果：协议成功将配比调整为国债 30% + 房地产 70%，提升整体 APY

**Scenario 5: 紧急情况触发 Circuit Breaker**
- 用户目标：房地产代币净值突然下跌 6%，触发熔断机制保护用户
- 步骤：
  1. Oracle 报告房地产代币净值下跌 6%（超过 -5% 阈值）
  2. Circuit Breaker 自动触发（Story 4.3）
  3. 限制单笔赎回金额≤$10K（防止挤兑）
  4. 前端显示"熔断机制已启动"警告
  5. 管理员评估情况 → 如果是 Oracle 误报，手动解除熔断
  6. 如果是真实下跌，通过多签暂停合约（Story 4.2），调查问题
- 预期结果：Circuit Breaker 成功限制异常赎回，保护协议 TVL 和用户资金

---

## 4. Functional Requirements

### 4.1 Core Capabilities

#### 4.1.1 Vault 核心功能（ERC4626 标准）

**描述**: 实现 ERC4626 Vault 标准，允许用户存入 USDT 获取 PNGY，并随时赎回

**Input**:
- 用户地址、存款金额（USDT）
- 赎回请求（PNGY 数量）

**Output**:
- 铸造/销毁的 PNGY 数量
- 交易事件（Deposit、Withdraw）

**Business Rules**:
1. 最低存款金额 = $500 USDT
2. 净值计算公式：`NAV = (国债代币价值 + 房地产代币价值) / PNGY 总供应量`
3. 存款时铸造 PNGY：`PNGY 数量 = 存款金额 / 当前 NAV`
4. 赎回时销毁 PNGY：`USDT 金额 = PNGY 数量 × 当前 NAV`
5. 赎回 T+1 到账（需等待链下 RWA 资产清算）

**Trace to**: User Story 1.2, 1.4, 3.1

---

#### 4.1.2 Oracle 净值计算

**描述**: 通过 APRO (API3) 和 Chainlink 获取 RWA 资产价格，实时计算 PNGY 净值

**Input**:
- RWA 资产代币地址
- Oracle 数据源配置

**Output**:
- PNGY 当前净值（USDT per PNGY）
- 更新时间戳

**Business Rules**:
1. 主数据源：APRO (API3)
2. 备份数据源：Chainlink（如果 APRO 失效）
3. 净值每小时更新一次
4. 如果价格偏差 >5%，触发人工审核

**Trace to**: User Story 1.3, 2.2, 6.1, 6.2

---

#### 4.1.3 动态再平衡引擎

**描述**: 根据两种 RWA 资产的 APY 差异，自动计算最优配比并执行资产买卖

**Input**:
- 国债代币当前 APY
- 房地产代币当前 APY
- 当前资产配比

**Output**:
- 建议的新配比
- 买入/卖出交易参数

**Business Rules**:
1. 策略：收益优先（配置更多资产到高 APY 的一方）
2. 再平衡频率：最多每周 1 次
3. 最小配比约束：单一资产不低于 20%，不超过 80%
4. 执行需要多签批准（3/5）

**Trace to**: User Story 4.1

---

#### 4.1.4 应急机制（Pause + Circuit Breaker）

**描述**: 在异常情况下保护用户资金

**Input**:
- 暂停触发：管理员手动调用
- 熔断触发：净值下跌超过阈值（-5%）

**Output**:
- 暂停后：禁止 deposit 和 withdraw
- 熔断后：限制单笔赎回金额≤$10K

**Business Rules**:
1. 暂停需要多签批准（3/5）
2. 熔断自动触发，管理员可手动解除
3. 熔断期间，小额赎回（≤$10K）仍可执行

**Trace to**: User Story 4.2, 4.3

---

#### 4.1.5 RWA 资产集成与管理

**描述**: 集成 BSC 链上已有的 RWA 代币（如 Ondo OUSG、Backed bIB01 等），作为 PNGY 的底层资产

**Input**:
- RWA 代币合约地址（BSC 上已部署）
- 资产类型（国债/房地产/信贷/其他）
- 目标配比（basis points，10000 = 100%）
- Oracle 数据源地址（APRO/Chainlink/项目方 Oracle）

**Output**:
- 资产注册成功事件（AssetRegistered）
- 更新的资产配置（存储在 AssetRegistry）
- 首次资产购买交易（通过 DEX 或 RWA 协议）

**Business Rules**:
1. **资产添加需要多签批准（3/5）** - 防止恶意添加不安全的 RWA 代币
2. **每个资产必须有可靠的 Oracle 数据源** - 确保净值计算准确
3. **总配比必须等于 100%** - 所有资产的 targetAllocation 之和 = 10000 (basis points)
4. **单一资产配比限制** - 最低 10%，最高 60%（风险分散）
5. **资产必须通过审核** - 检查项目方审计报告、TVL、历史表现
6. **流动性要求** - DEX 日交易量 >$50K 或项目方支持直接 mint/redeem

**技术实现**:
1. **通过 DEX 购买**（如 PancakeSwap）:
   ```solidity
   function buyRWAAssetViaDEX(
       address rwaToken,
       uint256 usdtAmount,
       uint256 minRWAAmount  // 滑点保护
   ) external onlyRole(REBALANCER_ROLE) {
       // 批准 USDT 给 PancakeSwap Router
       IERC20(USDT).approve(PANCAKE_ROUTER, usdtAmount);

       // 通过 Router 交换
       address[] memory path = new address[](2);
       path[0] = USDT;
       path[1] = rwaToken;

       IPancakeRouter(PANCAKE_ROUTER).swapExactTokensForTokens(
           usdtAmount,
           minRWAAmount,
           path,
           address(this),
           block.timestamp + 300
       );
   }
   ```

2. **通过 RWA 协议直接购买**（如 Ondo 的 mint 接口）:
   ```solidity
   function buyRWAAssetViaProtocol(
       address rwaToken,
       uint256 usdtAmount
   ) external onlyRole(REBALANCER_ROLE) {
       // 批准 USDT 给 RWA 协议
       IERC20(USDT).approve(rwaToken, usdtAmount);

       // 调用 RWA 协议的 mint 接口
       IRWAToken(rwaToken).mint(usdtAmount);
   }
   ```

**Trace to**: User Story 6.1, 6.2, 6.3, 6.4, 6.5

---

#### 4.1.6 通知系统

**描述**: 向用户推送重要事件通知

**Input**:
- 事件类型（赎回到账、再平衡、暂停、熔断）
- 用户通知偏好

**Output**:
- 浏览器通知
- 邮件通知（可选）

**Business Rules**:
1. 必需通知：赎回到账、紧急暂停、熔断触发
2. 可选通知：资产再平衡、净值更新
3. 用户可自定义通知偏好

**Trace to**: User Story 1.6

---

### 4.2 Data Operations

#### CRUD 操作

**Create（创建）**:
- 用户存款交易（deposit）
- RWA 资产代币铸造（mint）
- 再平衡交易记录
- 推荐关系绑定

**Read（读取）**:
- 用户 PNGY 余额查询
- 实时净值查询
- 交易历史查询（存款、赎回）
- RWA 资产配置查询
- 历史收益曲线查询（7/30/90 天）

**Update（更新）**:
- Oracle 净值更新（每小时）
- 资产配比更新（再平衡后）
- 用户通知偏好设置

**Delete（删除）**:
- 无需删除操作（区块链不可变性）
- 通知历史可手动清除（软删除）

---

### 4.3 Integration Requirements

#### Integration 1: APRO (API3) Oracle

**Purpose**: 主数据源，获取 RWA 资产价格

**API/SDK**: API3 dAPI（decentralized API）

**Implementation**:
- 智能合约调用 API3 Beacon 读取价格
- 支持的资产：国债代币、房地产代币
- 更新频率：每小时

**Trace to**: User Story 1.3, 6.1, 6.2

---

#### Integration 2: Chainlink Price Feed

**Purpose**: 备份数据源，当 APRO 失效时使用

**API/SDK**: Chainlink Data Feeds

**Implementation**:
- 智能合约调用 Chainlink Aggregator 读取价格
- 自动检测 APRO 数据新鲜度，如果 >2 小时未更新，切换到 Chainlink

**Trace to**: User Story 1.3

---

#### Integration 3: Gnosis Safe 多签

**Purpose**: 重大操作需要多签批准

**API/SDK**: Gnosis Safe SDK

**Implementation**:
- 前端集成 Gnosis Safe UI
- 需要多签的操作：资产再平衡、暂停/恢复、RWA 资产添加/移除、Circuit Breaker 参数修改

**Trace to**: User Story 4.4

---

#### Integration 6: PancakeSwap DEX（RWA 资产交换）

**Purpose**: 通过 DEX 购买和出售 BSC 上的 RWA 代币

**API/SDK**: PancakeSwap Router V2

**Implementation**:
- 合约集成 PancakeSwap Router 接口
- 支持 USDT ↔ RWA Token 交换
- 滑点保护（建议 0.5-1%）
- 流动性检查（交易前验证流动性池深度）

**Trace to**: User Story 6.1, 6.5

---

#### Integration 7: RWA 协议直接集成（可选）

**Purpose**: 如果 RWA 项目支持直接 mint/redeem，绕过 DEX 降低滑点

**API/SDK**: RWA 项目方提供的智能合约接口

**Implementation**:
- 例: Ondo Finance 的 `mint()` 和 `redeem()` 函数
- Backed Finance 的类似接口
- 需要逐个 RWA 项目适配

**Trace to**: User Story 6.1

---

#### Integration 4: 区块链浏览器（BscScan）

**Purpose**: 用户可查看交易详情

**API/SDK**: BscScan API

**Implementation**:
- 前端点击交易记录 → 跳转到 BscScan 交易详情页
- 显示交易哈希、Gas 费用、确认数

**Trace to**: User Story 1.5

---

#### Integration 5: 通知服务（Web Push + 邮件）

**Purpose**: 向用户推送通知

**API/SDK**: Web Push API + SendGrid（邮件）

**Implementation**:
- 浏览器通知：使用 Service Worker + Web Push API
- 邮件通知：使用 SendGrid API（可选，用户需提供邮箱）

**Trace to**: User Story 1.6

---

## 5. Non-Functional Requirements

**NFR 优先级**（基于 Round 2 Step 1 用户答复）：**可靠性 (Reliability) > 安全性 (Security) > 性能 (Performance) > 可扩展性 (Scalability) > 可用性 (Usability)**

---

### 5.1 Reliability Requirements（可靠性 - 最高优先级）

#### 5.1.1 Uptime Target（正常运行时间目标）

- **Target**: 99.9% uptime（每年停机时间 ≤8.76 小时）
- **Measurement**: 监控合约可调用性、Oracle 数据更新频率、前端页面可访问性
- **Accountability**: 如果单月正常运行时间 <99.5%，向用户公开事故报告

**Trace to**: Round 2 Step 1 用户答复（NFR 优先级 - 可靠性）

---

#### 5.1.2 Recovery Time Objective (RTO)

- **智能合约故障**: <1 小时（触发多签暂停 → 评估问题 → 部署修复版本）
- **Oracle 数据源失效**: <15 分钟（自动切换到 Chainlink 备份）
- **前端故障**: <30 分钟（CDN 故障切换 + 回滚到上一稳定版本）

**Trace to**: User Story 4.2（暂停/恢复合约）

---

#### 5.1.3 Recovery Point Objective (RPO)

- **区块链数据**: 0 分钟（区块链本身不可变）
- **链下数据（通知历史、用户偏好）**: <1 小时数据丢失（每小时备份）

---

#### 5.1.4 Backup Strategy（备份策略）

- **智能合约代码**: Git 版本控制 + 每次部署前审计
- **链下数据库**: 每小时自动备份到云存储（AWS S3 或 Vercel Blob）
- **Oracle 配置**: 多签钱包控制，配置变更需 3/5 批准

---

#### 5.1.5 Disaster Recovery（灾难恢复）

**场景 1: 智能合约重大漏洞**
- **Detection**: 审计报告、白帽黑客、社区报告
- **Response**: 立即多签暂停合约 → 通知用户 → 部署修复版本 → 审计通过后恢复
- **Timeline**: 24-48 小时

**场景 2: Oracle 数据源永久失效**
- **Detection**: APRO 数据 >2 小时未更新
- **Response**: 自动切换到 Chainlink → 如果 Chainlink 也失效，人工更新净值
- **Timeline**: 15 分钟（自动切换）+ 2 小时（人工介入）

**场景 3: RWA 资产合作伙伴违约**
- **Detection**: 资产净值异常下跌、审计报告、法律诉讼
- **Response**: 触发 Circuit Breaker → 限制赎回 → 使用保险基金补偿用户
- **Timeline**: 即时（Circuit Breaker）+ 7-30 天（清算处理）

**Trace to**: User Story 4.3（Circuit Breaker）, User Story 4.2（暂停机制）

---

#### 5.1.6 Failover Mechanisms（故障切换机制）

- **Oracle 故障切换**: APRO → Chainlink（自动，15 分钟内）
- **前端故障切换**: Vercel CDN 多区域部署（自动，<1 分钟）
- **RPC 节点故障切换**: 主 RPC → 备用 RPC（如 Ankr, Moralis）（自动，<30 秒）

---

### 5.2 Security Requirements（安全性 - 第二优先级）

#### 5.2.1 Authentication（认证）

- **方法**: Web3 钱包签名验证（MetaMask, Trust Wallet）
- **无需传统认证**: 无用户名/密码，完全基于钱包地址
- **Session 管理**: 前端存储签名凭证（LocalStorage），有效期 24 小时

**Trace to**: User Story 1.1（连接钱包）

---

#### 5.2.2 Authorization（授权）

- **模型**: 基于角色的访问控制（RBAC）
- **角色定义**:
  - **User（普通用户）**: 存款、赎回、查看净值
  - **Admin（管理员）**: 执行再平衡、暂停/恢复合约、铸造 RWA 代币
  - **Multisig（多签钱包）**: 批准重大操作（3/5 签名）

**Trace to**: User Story 4.4（多签治理）

---

#### 5.2.3 Data Protection（数据保护）

- **Encryption at Rest**:
  - 链上数据：区块链原生加密
  - 链下数据（通知偏好）：AES-256 加密存储
- **Encryption in Transit**: TLS 1.3（前端 ↔ 后端通信）
- **Secret Management**:
  - 私钥：存储在 Gnosis Safe 多签钱包
  - API 密钥（Oracle, SendGrid）：环境变量 + Vercel Secrets

---

#### 5.2.4 Compliance（合规）

- **无 KYC**: 完全去中心化，不收集用户身份信息
- **GDPR 考虑**:
  - 用户可选提供邮箱（通知功能）
  - 提供"删除我的邮箱"功能
- **无 PCI-DSS 需求**: 不处理信用卡支付
- **证券法风险**:
  - 咨询法律顾问确保 PNGY 不被视为证券
  - 在网站显示"非投资建议"免责声明

**Trace to**: product.md#1.2（合规策略 - 完全去中心化）

---

#### 5.2.5 Security Controls（安全控制）

- **Rate Limiting**:
  - 前端 API 调用：每用户 100 请求/分钟
  - 智能合约：防止闪电贷攻击（单笔存款/赎回限额）
- **Input Validation**:
  - 前端：验证存款金额（≥$500）、PNGY 赎回数量（≤用户余额）
  - 智能合约：检查地址有效性、金额非负
- **OWASP Top 10**:
  - 防止重入攻击（ReentrancyGuard）
  - 防止整数溢出（Solidity 0.8+ 内置保护）
  - 防止前端 XSS（React 自动转义）

**Trace to**: .ultra/constitution.md（质量标准 - 安全维度）

---

### 5.3 Performance Requirements（性能 - 第三优先级）

#### 5.3.1 Response Time（响应时间）

- **智能合约交易**:
  - 存款/赎回：1-3 区块确认（BSC ~9-15 秒）
  - 净值查询：<1 秒（纯读取操作）
- **前端 API 调用**: <500ms（查询交易历史、净值）
- **前端页面加载**: <2 秒（首次加载）

**Trace to**: Round 2 Step 1 用户答复（NFR 优先级 - 性能排第四）

---

#### 5.3.2 Throughput（吞吐量）

- **并发用户**: 支持 1K-5K 并发用户（基于 BSC 区块容量）
- **交易处理**: 每区块最多 100-200 笔交易（BSC 限制）
- **Oracle 更新**: 每小时 1 次（足够满足净值计算需求）

---

#### 5.3.3 Frontend Performance（前端性能）

基于 .ultra/config.json 配置的 Core Web Vitals 目标：

- **LCP (Largest Contentful Paint)**: <2.5s（首屏渲染时间）
- **INP (Interaction to Next Paint)**: <200ms（交互响应时间）
- **CLS (Cumulative Layout Shift)**: <0.1（布局稳定性）

**优化策略**:
- 懒加载图表组件（Chart.js）
- CDN 加速静态资源（Vercel Edge Network）
- 代码分割（Next.js 自动优化）

**Trace to**: .ultra/constitution.md（质量标准 - 前端性能）

---

### 5.4 Scalability Requirements（可扩展性 - 第四优先级）

#### 5.4.1 Expected Growth（预期增长）

- **Year 1**:
  - TVL: $1M-$10M
  - 用户数: 1K-5K 活跃地址
  - RWA 资产: 2 种（国债 + 房地产）
- **Year 2-3**:
  - TVL: $10M-$50M
  - 用户数: 5K-20K 活跃地址
  - RWA 资产: 5-10 种（增加商品、股权等）

**Trace to**: product.md#1.1（项目规模 - 中型区域运营）

---

#### 5.4.2 Horizontal Scaling（水平扩展）

- **智能合约**: 不可水平扩展（单一 Vault 合约）
- **前端**: Vercel CDN 自动水平扩展（无需配置）
- **链下服务**（再平衡引擎、通知服务）:
  - 部署在 Vercel Serverless Functions
  - 自动扩展，支持 0 → 1K 并发

---

#### 5.4.3 Load Distribution（负载分布）

- **Geographic Distribution**:
  - 目标用户：东南亚 + 东亚
  - CDN 节点：新加坡、香港、东京
- **RPC 负载**:
  - 使用多个 RPC 提供商（Ankr, Moralis, QuickNode）
  - 前端轮询分配请求

---

### 5.5 Usability Requirements（可用性 - 第五优先级）

#### 5.5.1 Accessibility（可访问性）

- **标准**: WCAG 2.1 AA（部分支持）
- **键盘导航**: 支持 Tab 键导航主要功能
- **屏幕阅读器**: 基本支持（使用 semantic HTML）
- **优先级**: P2（MVP 阶段不强制，Phase 2 改进）

---

#### 5.5.2 Internationalization（国际化）

- **Languages**:
  - Phase 1: 英语 + 中文（简体）
  - Phase 2: 添加日语、韩语、泰语
- **RTL Support**: 不需要（目标用户无 RTL 语言）

---

#### 5.5.3 Browser Support（浏览器支持）

- **Desktop**:
  - Chrome ≥90（推荐）
  - Firefox ≥88
  - Safari ≥14
  - Edge ≥90
- **Mobile**:
  - iOS Safari ≥14
  - Android Chrome ≥90
  - 信任钱包内置浏览器

**Trace to**: product.md#2.2（用户特征 - 使用 MetaMask/Trust Wallet）

---

#### 5.5.4 Device Support（设备支持）

- **Desktop**: 优先支持（1920×1080, 1366×768）
- **Tablet**: 基本支持（响应式布局）
- **Mobile**: 完全支持（移动优先设计，适配 375×667 及以上）

---

#### 5.5.5 User Experience（用户体验）

- **新手引导**: 首次访问显示 RWA 机制说明（Story 未明确列出，但用户场景 1 提及）
- **加载状态**: 交易确认时显示进度条
- **错误提示**: 友好的错误信息（如"余额不足"、"网络错误"）
- **响应式设计**: 适配所有屏幕尺寸

**Trace to**: product.md#2.2（用户痛点 6 - 用户教育不足）

## 6. Constraints

### 6.1 Technical Constraints

[NEEDS CLARIFICATION - Platform, integration, technology restrictions]

**Example format**:
- **Must integrate with**: [Existing system names and versions]
- **Must run on**: [Platform/infrastructure requirements]
- **Cannot use**: [Prohibited technologies and reasons]
- **Required compatibility**: [Legacy system requirements]

### 6.2 Business Constraints

[NEEDS CLARIFICATION - Budget, timeline, team size, organizational limits]

**Example format**:
- **Budget**: [Total budget and breakdown]
- **Timeline**: [Hard deadlines with milestones]
- **Team Size**: [Number of developers, designers, QA]
- **Resource Limits**: [Infrastructure, licenses, tooling]

### 6.3 Regulatory Constraints

[NEEDS CLARIFICATION - GDPR, HIPAA, SOC2, industry-specific regulations]

**Example format**:
- **Data Privacy**: [GDPR, CCPA requirements]
- **Healthcare**: [HIPAA compliance if applicable]
- **Financial**: [PCI-DSS, SOX if applicable]
- **Industry-Specific**: [Sector-specific regulations]

---

## 7. Risks & Mitigation

### 7.1 Critical Risks

[NEEDS CLARIFICATION - High-probability or high-impact risks]

**Example format**:
| Risk | Probability | Impact | Category |
|------|------------|--------|----------|
| [Risk description] | High/Medium/Low | Critical/Significant/Moderate | Technical/Business/Regulatory |

### 7.2 Mitigation Strategies

[NEEDS CLARIFICATION - Risk response plans for each critical risk]

**Example format**:
1. **Risk**: [Risk name from 7.1]
   - **Mitigation**: [Preventive measures]
   - **Contingency**: [If mitigation fails, what's Plan B?]
   - **Owner**: [Who is responsible?]

2. **Risk**: [Risk name from 7.1]
   [Continue...]

### 7.3 Assumptions

[NEEDS CLARIFICATION - Key assumptions requiring validation]

**Example format**:
1. **Assumption**: [Statement]
   - **Validation**: [How to verify this assumption?]
   - **Impact if wrong**: [What happens if this assumption is incorrect?]

2. **Assumption**: [Statement]
   [Continue...]

---

## 8. Success Metrics

### 8.1 Key Performance Indicators (KPIs)

**Business Metrics**:
1. **[Metric Name]**
   - Current: [Baseline]
   - Target: [Goal]
   - Measurement: [How to measure]
   - Timeline: [When to achieve target]

2. **[Metric Name]**
   [Continue...]

**Technical Metrics**:
- Response time: [Target]
- Error rate: [Target]
- Uptime: [Target]

### 8.2 User Satisfaction Metrics

- **Net Promoter Score (NPS)**: Target [number]
- **User Adoption Rate**: Target [percentage]
- **Task Completion Rate**: Target [percentage]
- **User Retention**: Target [percentage]

---

## 9. Out of Scope

**Explicitly list what this project will NOT include**:

- **[Feature X]**: Reason: [Will be addressed in Phase 2]
- **[Feature Y]**: Reason: [Not aligned with current goals]
- **[Feature Z]**: Reason: [Technical constraints or budget limits]

---

## 10. Dependencies

### 10.1 External Dependencies

- **[Third-party service/API]**: [Purpose and integration point]
- **[External data source]**: [Data type and access method]

### 10.2 Internal Dependencies

- **[Existing system]**: [Integration requirements]
- **[Team/department]**: [What we need from them and when]

---

## 11. Open Questions

[Questions requiring clarification during development]

1. **Question**: [Open question]
   - **Impacts**: [What decisions depend on this?]
   - **Deadline**: [When do we need an answer?]

2. **Question**: [Open question]
   [Continue...]

## References

- User research: [Link]
- Market analysis: [Link]
- Competitor analysis: [Link]
- Related projects: [Link]

---

**Document Status**: Draft | In Review | Approved
**Last Updated**: [Date]
**Approved By**: [Name]
