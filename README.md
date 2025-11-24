# Paimon Yield Protocol

> BSC 链上的 RWA 收益聚合协议 - 通过 ERC4626 标准 Vault 提供多样化真实世界资产投资

## 项目概述

Paimon Yield Protocol 是一个部署在币安智能链（BSC）上的 **RWA (真实世界资产) 收益聚合器**，采用 ERC4626 标准 Tokenized Vault 架构，为用户提供简单、透明的 RWA 资产投资渠道。

### 核心机制

```text
用户存入 USDT → 铸造 PNGY (ERC4626 shares) → 协议购买 RWA 代币 → 净值增长 → 赎回获得收益
```

- **PNGY**: 基于 ERC4626 标准的 Vault Token，代表用户在资金池中的份额
- **聚合器模式**: 集成 BSC 已有的 RWA 代币（如 Ondo OUSG、Backed bIB01 等）
- **动态再平衡**: 根据各 RWA 资产的 APY 动态调整配置比例
- **多签治理**: Gnosis Safe (3/5) 多签保护关键操作

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **Smart Contracts** | Foundry + Solidity 0.8.20+ | ERC4626 Vault, OpenZeppelin 5.0 |
| **Frontend** | Next.js 14 + TypeScript | App Router, Wagmi/Viem, RainbowKit |
| **Backend** | Node.js 20 + Fastify | Bull Queue, Prisma ORM |
| **Database** | PostgreSQL 16 + Redis | 交易历史, 净值数据, 任务队列 |
| **Oracle** | APRO (API3) + Chainlink | 双 Oracle 架构, 自动故障切换 |
| **Deployment** | Vercel + Railway | 前端 CDN + 后端 + 数据库 |

## 项目结构

```text
paimon-yield-protocol/
├── contracts/              # Foundry 智能合约项目
│   ├── src/               # 合约源码
│   ├── test/              # 测试文件
│   └── script/            # 部署脚本
├── frontend/              # Next.js 14 前端项目
│   ├── app/               # App Router 页面
│   └── components/        # React 组件
├── backend/               # Fastify 后端项目
│   └── src/               # API 和服务
├── .ultra/                # Ultra Builder Pro 配置
│   ├── specs/             # 产品需求 + 技术架构
│   ├── tasks/             # 任务管理 (95 个任务)
│   └── docs/              # 研究报告和决策记录
├── pnpm-workspace.yaml    # pnpm 工作区配置
└── package.json           # 根 package.json
```

## 快速开始

### 前置条件

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Foundry (forge, cast, anvil)

### 安装

```bash
# 克隆仓库
git clone https://github.com/paimon-finance/paimon-yield-protocol.git
cd paimon-yield-protocol

# 安装依赖
pnpm install

# 安装 Foundry (如果尚未安装)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 开发命令

```bash
# 智能合约
pnpm contracts:build       # 编译合约
pnpm contracts:test        # 运行测试

# 前端
pnpm dev:frontend          # 启动开发服务器

# 后端
pnpm dev:backend           # 启动 API 服务器

# 全项目
pnpm build                 # 构建所有子项目
pnpm test                  # 运行所有测试
pnpm lint                  # 代码检查
```

## 开发工作流

此项目使用 **Ultra Builder Pro 4.2** 开发工作流：

| 阶段 | 命令 | 状态 | 说明 |
|------|------|------|------|
| 初始化 | `/ultra-init` | ✅ 完成 | 项目结构创建 |
| 研究 | `/ultra-research` | ✅ 完成 | 4 轮渐进式调研 |
| 规划 | `/ultra-plan` | ✅ 完成 | 95 个任务生成 |
| 开发 | `/ultra-dev` | 🔄 进行中 | TDD 开发循环 |
| 测试 | `/ultra-test` | ⏭️ 待执行 | 六维测试覆盖 |
| 交付 | `/ultra-deliver` | ⏭️ 待执行 | 性能 + 安全优化 |

## 关键设计决策

### 1. RWA 聚合器模式 (非发行方)

- 仅自营 PNGY 代币 (ERC4626 Vault Token)
- 集成 BSC 上已有的 RWA 代币（降低法律和合规风险）
- 专注于收益优化和用户体验

### 2. 双 Oracle 架构

- 主 Oracle: APRO (API3) - 高更新频率
- 备 Oracle: Chainlink - 稳定可靠
- 自动故障切换: 数据过期 >2 小时自动切换

### 3. 安全优先

- 智能合约: OpenZeppelin 5.0 审计库
- 治理: Gnosis Safe 3/5 多签
- 应急: Pause 暂停 + Circuit Breaker 熔断
- 审计: 上线前 2 家审计公司审计

## 文档

- [产品需求文档](.ultra/specs/product.md) - 用户故事和功能需求
- [技术架构文档](.ultra/specs/architecture.md) - 技术栈和系统设计
- [风险分析报告](.ultra/docs/research/round4-risks-constraints.md) - 风险识别和缓解策略

## 许可证

MIT License

---

🏗️ 项目由 [Ultra Builder Pro](https://github.com/anthropics/claude-code) 创建
