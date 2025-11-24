# Architecture Design

> **Purpose**: This document defines HOW the system is built, based on requirements in `product.md`.

**Last Updated**: 2025-11-22
**Version**: 1.0
**Status**: Draft (Round 3 Complete)

---

## 1. System Overview

### 1.1 Architecture Vision

Paimon Yield Protocol 是一个部署在 BSC 的 **RWA (真实世界资产) 收益聚合器**,通过 ERC4626 标准 Vault 为用户提供多样化 RWA 资产投资。

**核心设计理念**:
- **聚合器模式**: 集成 BSC 已有的 RWA 代币,而非自己发行
- **收益优化**: 动态再平衡策略,在多个 RWA 资产间配置以最大化收益
- **完全透明**: 实时净值计算、资产配置展示、历史收益追踪
- **去中心化**: 多签治理、无 KYC、链上透明

**质量属性优先级** (基于 product.md#5):
1. **可靠性 (Reliability)** - 99.9% uptime,快速故障恢复
2. **安全性 (Security)** - 多签治理、审计合约、应急机制
3. **性能 (Performance)** - BSC 标准性能 (3s 确认, <$0.5 Gas)
4. **可扩展性 (Scalability)** - 支持 1K-5K 用户,TVL $1M-$10M
5. **可用性 (Usability)** - 移动优先设计,简洁仪表板

---

### 1.2 Key Components

**架构层级** (从用户到底层):

```
┌────────────────────────────────────────────────────────────┐
│  用户层 (User Layer)                                        │
│  - MetaMask/Trust Wallet 用户                               │
│  - B2C 个人投资者 / B2B 机构 / B2D DeFi 协议               │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  前端层 (Frontend Layer)                                    │
│  - Next.js 14 App Router                                   │
│  - RainbowKit 钱包连接 + Wagmi/Viem                        │
│  - Zustand 状态管理                                         │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  API 层 (API Layer)                                        │
│  - Next.js API Routes (前端 API)                           │
│  - Railway Backend (链下服务)                               │
│  - Fastify REST API                                        │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  智能合约层 (Smart Contract Layer) - BSC 主网               │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  PNGYVault       │  │  AssetRegistry   │               │
│  │  (ERC4626)       │  │  (资产注册表)     │               │
│  └──────────────────┘  └──────────────────┘               │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Oracle Adapter  │  │  Rebalance       │               │
│  │  (APRO+Chainlink)│  │  Strategy        │               │
│  └──────────────────┘  └──────────────────┘               │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  外部集成层 (External Integration Layer)                    │
│  - BSC 上的 RWA 代币 (Ondo OUSG, Backed bIB01, etc.)       │
│  - PancakeSwap DEX (资产交换)                               │
│  - APRO (API3) Oracle + Chainlink Price Feeds             │
│  - Gnosis Safe (多签治理)                                   │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  数据层 (Data Layer)                                        │
│  - PostgreSQL (交易历史、用户数据)                          │
│  - Redis (Bull Queue + 缓存)                               │
│  - BSC 区块链 (链上数据)                                    │
└────────────────────────────────────────────────────────────┘
```

---

### 1.3 Data Flow Overview

#### 用户存款流程
```
1. 用户连接钱包 → 授权 USDT
2. 前端调用 PNGYVault.deposit(usdtAmount)
3. Vault 计算当前净值 → 铸造 PNGY shares
4. Vault 使用 USDT 购买 RWA 代币:
   - 通过 PancakeSwap Router (如果有流动性)
   - 或直接调用 RWA 协议 mint 接口
5. PNGY 代币发送到用户地址
6. 链下服务记录交易到 PostgreSQL
```

#### 净值更新流程
```
1. Cron 任务每小时触发 (node-cron)
2. 链下服务调用 Oracle 获取每个 RWA 资产价格
3. 计算 Vault 总资产价值:
   totalAssets = Σ(RWA_balance_i × RWA_price_i)
4. 计算 PNGY 净值:
   NAV = totalAssets / PNGY_totalSupply
5. 存储到 PostgreSQL NetValue 表
6. 前端实时查询显示
```

#### 动态再平衡流程
```
1. 链下引擎检测 RWA 资产 APY 变化
2. RebalanceStrategy 计算最优配比
3. 生成再平衡交易参数 (卖出/买入)
4. 提交到 Gnosis Safe 多签钱包
5. 3/5 管理员批准
6. 链上执行:
   - 卖出低 APY 资产 (通过 PancakeSwap)
   - 买入高 APY 资产
7. 更新 targetAllocations
8. 触发 RebalanceExecuted 事件
9. 通知所有用户
```

---

## 2. Architecture Principles

**继承自 `.ultra/constitution.md`**:
- ✅ Specification-Driven (规格驱动开发)
- ✅ Test-First Development (TDD 强制)
- ✅ Minimal Abstraction (最小抽象)
- ✅ Anti-Future-Proofing (反过度设计)

**项目特定原则**:

### 2.1 聚合器优先 (Aggregator-First)
- ✅ 集成已有 RWA 代币,而非自己发行
- ✅ 专注于收益优化和用户体验
- ✅ 降低发行和合规成本

**理由**: BSC RWA 生态尚不成熟,自发行 RWA 需要大量合规和审计成本,不如先聚合已有资产。

### 2.2 安全至上 (Security-First)
- ✅ 多签治理 (Gnosis Safe 3/5)
- ✅ 应急机制 (Pause + Circuit Breaker)
- ✅ 外部审计 (CertiK/SlowMist)
- ✅ 双 Oracle (APRO 主 + Chainlink 备)

**理由**: DeFi 项目安全事件频发,用户资金安全是第一优先级。

### 2.3 渐进式去中心化 (Progressive Decentralization)
- ✅ Phase 1: 多签治理 (MVP)
- ✅ Phase 2: DAO 治理 + 代币投票 (Post-MVP)
- ✅ Phase 3: 完全链上治理

**理由**: 早期需要快速迭代和应急响应,完全去中心化会降低灵活性。

### 2.4 数据驱动优化 (Data-Driven Optimization)
- ✅ 记录所有用户行为和系统事件
- ✅ 监控 APY、滑点、Gas 费等关键指标
- ✅ 基于数据调整再平衡策略

**理由**: RWA 收益聚合器的核心竞争力是优化策略,需要数据支撑决策。

---

## 3. Technology Stack

### 3.1 Smart Contract Stack

#### 3.1.1 Framework Selection

**决策**: Foundry

**理由** (基于 6D 分析):
- **Technical**: 测试速度比 Hardhat 快 10-50x,Gas 优化工具完善
- **Business**: 节省 4-6 周测试时间,ROI 极高
- **Team**: 学习曲线陡峭但可接受 (1-2 周)
- **Ecosystem**: ERC4626 官方测试套件 (a16z/erc4626-tests) 完美支持
- **Strategic**: 行业新标准 (Uniswap V4, Aave V3 都用 Foundry)
- **Meta**: 顶尖 Solidity 工程师优先选择 Foundry

**技术细节**:
- **平台**: BSC 主网 (Chain ID: 56)
- **语言**: Solidity 0.8.20+
- **框架**: Foundry (forge + cast + anvil)
- **测试**: Forge Test (Solidity 原生测试)
- **合约库**: OpenZeppelin Contracts 5.0
- **标准**: ERC4626 (Tokenized Vault Standard)

**开发工具**:
```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 项目初始化
forge init paimon-contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install a16z/erc4626-tests
```

**Trace to**: Round 3 技术对比 - 决策 1

---

### 3.2 Frontend Stack

#### 3.2.1 Framework Selection

**决策**: Next.js 14 (App Router)

**理由** (基于 6D 分析):
- **Technical**: SSR + ISR 开箱即用,自动图片/字体优化
- **Business**: Vercel 一键部署,前端 + API Routes 统一管理
- **Team**: 团队已有 React/Next.js 经验,学习成本 1 周
- **Ecosystem**: RainbowKit, Wagmi, ConnectKit 官方支持 Next.js
- **Strategic**: 未来需要营销页面和文档,SSR 能力必需
- **Meta**: Web3 DApp 事实标准 (Uniswap, Aave 都用 Next.js)

**技术细节**:
- **框架**: Next.js 14.1+ (App Router)
- **语言**: TypeScript 5.3+
- **状态管理**: Zustand 4.x (轻量级)
- **Web3 集成**:
  - Wagmi 2.x (React Hooks for Ethereum)
  - Viem 2.x (底层 Web3 库,替代 Ethers.js)
  - RainbowKit 2.x (钱包连接 UI)
- **UI 库**:
  - Ant Design Web3 (Web3 组件)
  - Tailwind CSS 3.x (样式)
  - Radix UI (无样式组件)
- **图表**: Recharts (收益曲线)
- **表单**: React Hook Form + Zod 验证

**项目结构**:
```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx               # 首页 (连接钱包)
│   ├── dashboard/
│   │   └── page.tsx           # 仪表板 (净值、余额)
│   ├── history/
│   │   └── page.tsx           # 交易历史
│   ├── assets/
│   │   └── page.tsx           # RWA 资产详情
│   ├── admin/
│   │   └── page.tsx           # 管理后台 (多签操作)
│   ├── layout.tsx             # 根布局
│   └── api/                   # API Routes
│       ├── nav/route.ts       # 净值查询 API
│       └── transactions/route.ts
├── components/
│   ├── WalletConnect.tsx      # RainbowKit 集成
│   ├── DepositForm.tsx        # 存款表单
│   ├── WithdrawForm.tsx       # 赎回表单
│   ├── RevenueChart.tsx       # 收益曲线图表
│   └── AssetAllocation.tsx    # RWA 资产配置饼图
├── hooks/
│   ├── useVault.ts            # Vault 合约交互
│   ├── useOracle.ts           # Oracle 价格查询
│   ├── useRebalance.ts        # 再平衡操作
│   └── useTransactions.ts     # 交易历史查询
├── store/
│   └── userStore.ts           # Zustand 全局状态
├── lib/
│   ├── contracts.ts           # 合约 ABI + 地址
│   └── utils.ts               # 工具函数
└── styles/
    └── globals.css            # 全局样式
```

**Trace to**: Round 3 技术对比 - 决策 2

---

### 3.3 Backend Stack

#### 3.3.1 Runtime & Framework Selection

**决策**: Node.js 20 LTS + TypeScript + Fastify

**理由** (基于 6D 分析):
- **Technical**: 与前端共享类型定义,Web3.js/Viem 无缝集成
- **Business**: 开发时间快 (全栈 TypeScript)
- **Team**: 零学习成本 (团队已有 Node.js 经验)
- **Ecosystem**: Web3 生态最丰富 (Ethers.js, Viem, Web3.js)
- **Strategic**: 可迁移到 Deno/Bun (性能提升 2-3x)
- **Meta**: DeFi 项目后端事实标准

**技术细节**:
- **运行时**: Node.js 20.11 LTS
- **语言**: TypeScript 5.3+
- **框架**: Fastify 4.x (比 Express 快 2x)
- **Web3 库**: Viem 2.x (与前端统一)
- **队列**: Bull 4.x (基于 Redis)
- **Cron**: node-cron (定时任务)
- **日志**: Pino (Fastify 内置,性能高)

**服务架构**:
```
services/
├── api/                        # REST API (Fastify)
│   ├── server.ts              # 主服务器
│   ├── routes/
│   │   ├── oracle.ts          # Oracle 价格 API
│   │   ├── rebalance.ts       # 再平衡触发 API
│   │   ├── notifications.ts   # 通知 API
│   │   └── health.ts          # 健康检查
│   ├── plugins/
│   │   ├── auth.ts            # Web3 签名验证
│   │   └── cors.ts            # CORS 配置
│   └── config.ts              # 配置管理
├── workers/                    # 后台任务
│   ├── rebalanceWorker.ts     # 再平衡引擎 (Bull Queue)
│   ├── oracleUpdater.ts       # Oracle 价格更新 (Cron 每小时)
│   ├── notificationWorker.ts  # 通知发送 (Bull Queue)
│   └── transactionIndexer.ts  # 交易索引 (监听链上事件)
├── contracts/                  # 合约交互
│   ├── vault.ts               # PNGYVault 交互
│   ├── oracle.ts              # Oracle 查询
│   └── rebalance.ts           # 再平衡执行
├── db/                         # 数据库
│   ├── schema.prisma          # Prisma Schema
│   ├── client.ts              # Prisma Client
│   └── migrations/            # 数据库迁移
└── scripts/                    # 运维脚本
    ├── deployContracts.ts     # 合约部署
    ├── setupMultisig.ts       # 多签初始化
    └── migrateData.ts         # 数据迁移
```

**Trace to**: Round 3 技术对比 - 决策 3

---

### 3.4 Database Stack

#### 3.4.1 Database Selection

**决策**: PostgreSQL 16 (托管在 Railway)

**理由** (基于 6D 分析):
- **Technical**: 强一致性 (ACID 事务),复杂查询优化,全文搜索
- **Business**: 成本中等 ($20-50/月),开发时间中等
- **Team**: 团队有 SQL 经验,学习 Prisma ORM 1-2 天
- **Ecosystem**: Prisma, TypeORM 完美支持,Railway 自带 Postgres
- **Strategic**: 可升级到 TimescaleDB (时序数据优化)
- **Meta**: DeFi 项目标准选择 (Uniswap, Aave 都用 Postgres)

**技术细节**:
- **数据库**: PostgreSQL 16.x
- **ORM**: Prisma 5.x (TypeScript 类型安全)
- **缓存**: Redis 7.x (Bull Queue + API 缓存)
- **托管**: Railway (自动备份 + 扩展)
- **连接池**: Prisma 内置连接池 (最大 10 连接)

**Schema 设计**:
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String        @id @default(uuid())
  address       String        @unique @db.VarChar(42)
  notifications Json?         // 通知偏好 (JSON 字段)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  transactions  Transaction[]

  @@index([address])
  @@map("users")
}

model Transaction {
  id          String   @id @default(uuid())
  userId      String
  type        String   @db.VarChar(20) // "deposit" | "withdraw"
  amount      Decimal  @db.Decimal(18, 6) // USDT 金额
  shares      Decimal  @db.Decimal(18, 6) // PNGY 数量
  txHash      String   @unique @db.VarChar(66)
  blockNumber Int
  status      String   @db.VarChar(20) // "pending" | "confirmed" | "failed"
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([txHash])
  @@index([status])
  @@map("transactions")
}

model NetValue {
  id        String   @id @default(uuid())
  value     Decimal  @db.Decimal(18, 6) // PNGY 净值 (USDT per PNGY)
  timestamp DateTime @default(now())

  @@index([timestamp])
  @@map("net_values")
}

model RWAAsset {
  id              String    @id @default(uuid())
  tokenAddress    String    @unique @db.VarChar(42)
  symbol          String    @db.VarChar(20)
  name            String    @db.VarChar(100)
  assetType       String    @db.VarChar(50) // "treasury" | "real_estate" | "credit"
  oracleSource    String    @db.VarChar(42)
  targetAllocation Int      // basis points (10000 = 100%)
  isActive        Boolean   @default(true)
  addedAt         DateTime  @default(now())
  rebalances      Rebalance[]

  @@index([tokenAddress])
  @@index([isActive])
  @@map("rwa_assets")
}

model Rebalance {
  id              String    @id @default(uuid())
  oldAllocation   Json      // { "0x...": 5000, "0x...": 5000 }
  newAllocation   Json
  txHash          String    @unique @db.VarChar(66)
  executedBy      String    @db.VarChar(42) // 多签地址
  executedAt      DateTime  @default(now())
  rwaAssets       RWAAsset[]

  @@index([executedAt])
  @@map("rebalances")
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String   @db.VarChar(50) // "withdraw_complete" | "rebalance" | "pause"
  title     String   @db.VarChar(200)
  message   String   @db.Text
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}
```

**Trace to**: Round 3 技术对比 - 决策 4

---

### 3.5 Infrastructure Stack

#### 3.5.1 Deployment Platform Selection

**决策**: 混合架构 - Vercel (前端) + Railway (后端)

**理由** (基于 6D 分析):
- **Vercel 优势**: Next.js 原生支持,全球 CDN,成本低 ($0-20/月)
- **Railway 优势**: 容器化部署,无 Serverless 限制,内置 Postgres
- **混合优势**: 最佳成本效益 ($30-50/月 总成本)
- **Vercel 限制**: 10s 超时,无法运行再平衡引擎 (需要 30s-1min)
- **Team**: 团队熟悉 Vercel,Railway 学习 1-2 天

**技术细节**:

**Vercel 部署** (前端 + API Routes):
- **平台**: Vercel (https://vercel.com/)
- **配置**:
  ```json
  // vercel.json
  {
    "buildCommand": "pnpm build",
    "outputDirectory": ".next",
    "framework": "nextjs",
    "regions": ["hkg1", "sin1"], // 香港 + 新加坡节点
    "env": {
      "NEXT_PUBLIC_CHAIN_ID": "56",
      "NEXT_PUBLIC_VAULT_ADDRESS": "@vault_address"
    }
  }
  ```
- **CDN**: Vercel Edge Network (全球 70+ 节点)
- **SSL**: 自动 HTTPS (Let's Encrypt)

**Railway 部署** (后端 + Postgres + Redis):
- **平台**: Railway (https://railway.app/)
- **服务**:
  1. **Backend API** (Node.js + Fastify)
  2. **PostgreSQL 16** (10GB 存储)
  3. **Redis 7** (Bull Queue + 缓存)
- **配置**:
  ```toml
  # railway.toml
  [build]
  builder = "NIXPACKS"
  buildCommand = "pnpm install && pnpm build"

  [deploy]
  startCommand = "pnpm start"
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 10

  [[services]]
  name = "backend-api"
  type = "web"

  [[services]]
  name = "postgres"
  type = "database"

  [[services]]
  name = "redis"
  type = "redis"
  ```

**CI/CD Pipeline**:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      - name: Run contract tests
        run: forge test --gas-report
      - name: Check coverage
        run: forge coverage --report summary

  deploy-contracts:
    needs: test-contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to BSC
        run: forge script script/Deploy.s.sol --rpc-url $BSC_RPC --broadcast
        env:
          PRIVATE_KEY: ${{ secrets.DEPLOYER_PRIVATE_KEY }}

  deploy-frontend:
    needs: test-contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: test-contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend-api
```

**Trace to**: Round 3 技术对比 - 决策 5

---

## 4. Component Architecture

### 4.1 Smart Contract Components

#### 4.1.1 PNGYVault.sol (核心 ERC4626 Vault)

**职责**:
- 管理用户存款和赎回 (USDT ↔ PNGY)
- 聚合多个 RWA 资产的净值
- 执行资产再平衡

**接口**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PNGYVault
 * @notice ERC4626 Vault that aggregates multiple RWA tokens
 * @dev Users deposit USDT, receive PNGY shares
 */
contract PNGYVault is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // RWA 资产池
    address[] public rwaAssets;
    mapping(address => uint256) public targetAllocations; // basis points

    // Circuit Breaker
    uint256 public circuitBreakerThreshold = 500; // -5%
    uint256 public maxSingleWithdrawal = 10_000e6; // $10K USDT
    bool public circuitBreakerActive;

    // Oracle
    address public oracleAdapter;

    event RWAAssetAdded(address indexed asset, uint256 targetAllocation);
    event RWAAssetRemoved(address indexed asset);
    event Rebalanced(address[] sellAssets, address[] buyAssets);
    event CircuitBreakerTriggered(uint256 navDrop);

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _oracleAdapter
    ) ERC4626(_asset) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        oracleAdapter = _oracleAdapter;
    }

    /**
     * @notice Add RWA asset to the vault
     * @param rwaToken BSC RWA token address (e.g., Ondo OUSG)
     * @param targetAllocation Target allocation in basis points (10000 = 100%)
     */
    function addRWAAsset(
        address rwaToken,
        uint256 targetAllocation
    ) external onlyRole(ADMIN_ROLE) {
        require(rwaToken != address(0), "Invalid RWA token");
        require(!_isAssetRegistered(rwaToken), "Asset already registered");
        require(_totalAllocation() + targetAllocation <= 10000, "Total allocation exceeds 100%");

        rwaAssets.push(rwaToken);
        targetAllocations[rwaToken] = targetAllocation;

        emit RWAAssetAdded(rwaToken, targetAllocation);
    }

    /**
     * @notice Execute rebalance across multiple RWA assets
     * @dev Only callable by REBALANCER_ROLE (multi-sig)
     */
    function rebalance(
        address[] calldata sellAssets,
        uint256[] calldata sellAmounts,
        address[] calldata buyAssets,
        uint256[] calldata buyAmounts
    ) external onlyRole(REBALANCER_ROLE) whenNotPaused nonReentrant {
        // Sell assets
        for (uint256 i = 0; i < sellAssets.length; i++) {
            _sellRWAAsset(sellAssets[i], sellAmounts[i]);
        }

        // Buy assets
        for (uint256 i = 0; i < buyAssets.length; i++) {
            _buyRWAAsset(buyAssets[i], buyAmounts[i]);
        }

        emit Rebalanced(sellAssets, buyAssets);
    }

    /**
     * @notice Calculate total vault assets (sum of all RWA assets)
     * @dev Overrides ERC4626.totalAssets()
     */
    function totalAssets() public view override returns (uint256) {
        uint256 total = 0;

        for (uint256 i = 0; i < rwaAssets.length; i++) {
            address rwaAsset = rwaAssets[i];
            uint256 balance = IERC20(rwaAsset).balanceOf(address(this));
            uint256 price = IOracleAdapter(oracleAdapter).getPrice(rwaAsset);
            total += (balance * price) / 1e18;
        }

        // Add idle USDT
        total += IERC20(asset()).balanceOf(address(this));

        return total;
    }

    /**
     * @notice Deposit with Circuit Breaker check
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public override whenNotPaused nonReentrant returns (uint256) {
        require(assets >= 500e6, "Minimum deposit: $500");
        return super.deposit(assets, receiver);
    }

    /**
     * @notice Withdraw with Circuit Breaker check
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override whenNotPaused nonReentrant returns (uint256) {
        if (circuitBreakerActive) {
            require(assets <= maxSingleWithdrawal, "Exceeds max withdrawal during circuit breaker");
        }
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @notice Trigger circuit breaker if NAV drops significantly
     */
    function checkCircuitBreaker() external {
        // Implementation: compare current NAV with last NAV
        // If drop > threshold, activate circuit breaker
    }

    // Internal functions
    function _sellRWAAsset(address rwaAsset, uint256 amount) internal {
        // Sell via PancakeSwap or RWA protocol redeem
    }

    function _buyRWAAsset(address rwaAsset, uint256 amount) internal {
        // Buy via PancakeSwap or RWA protocol mint
    }

    function _isAssetRegistered(address rwaToken) internal view returns (bool) {
        for (uint256 i = 0; i < rwaAssets.length; i++) {
            if (rwaAssets[i] == rwaToken) return true;
        }
        return false;
    }

    function _totalAllocation() internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < rwaAssets.length; i++) {
            total += targetAllocations[rwaAssets[i]];
        }
        return total;
    }
}
```

**依赖**:
- OpenZeppelin ERC4626, AccessControl, Pausable, ReentrancyGuard
- OracleAdapter (价格查询)
- PancakeSwap Router (资产交换)

**Trace to**: product.md#4.1.1 (Vault 核心功能)

---

#### 4.1.2 AssetRegistry.sol (RWA 资产注册表)

**职责**:
- 注册和管理 BSC 上的 RWA 代币
- 存储资产元数据 (名称、类型、Oracle 地址)
- 提供资产查询接口

**接口**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AssetRegistry is AccessControl {
    struct RWAAsset {
        address tokenAddress;
        string name;
        string symbol;
        string assetType; // "treasury" | "real_estate" | "credit"
        address oracleSource;
        bool isActive;
        uint256 addedAt;
    }

    mapping(address => RWAAsset) public assets;
    address[] public assetList;

    event AssetRegistered(address indexed token, string name, string assetType);
    event AssetDeactivated(address indexed token);

    function registerAsset(
        address tokenAddress,
        string calldata name,
        string calldata symbol,
        string calldata assetType,
        address oracleSource
    ) external onlyRole(ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token");
        require(!assets[tokenAddress].isActive, "Already registered");

        assets[tokenAddress] = RWAAsset({
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            assetType: assetType,
            oracleSource: oracleSource,
            isActive: true,
            addedAt: block.timestamp
        });

        assetList.push(tokenAddress);
        emit AssetRegistered(tokenAddress, name, assetType);
    }

    function getAllAssets() external view returns (RWAAsset[] memory) {
        RWAAsset[] memory result = new RWAAsset[](assetList.length);
        for (uint256 i = 0; i < assetList.length; i++) {
            result[i] = assets[assetList[i]];
        }
        return result;
    }

    function deactivateAsset(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        require(assets[tokenAddress].isActive, "Asset not active");
        assets[tokenAddress].isActive = false;
        emit AssetDeactivated(tokenAddress);
    }
}
```

**Trace to**: product.md#User Story 6.1 (集成 RWA 资产)

---

#### 4.1.3 OracleAdapter.sol (价格喂价聚合器)

**职责**:
- 聚合多个 Oracle 数据源 (APRO + Chainlink)
- 自动切换到备份数据源
- 提供统一的价格查询接口

**接口**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OracleAdapter is AccessControl {
    mapping(address => address) public aproDAPI; // RWA asset => APRO dAPI
    mapping(address => address) public chainlinkFeed; // RWA asset => Chainlink feed

    uint256 public constant STALE_THRESHOLD = 2 hours;

    event PriceUpdated(address indexed asset, uint256 price, address source);

    function getPrice(address rwaAsset) external view returns (uint256) {
        // Try APRO first
        address dapi = aproDAPI[rwaAsset];
        if (dapi != address(0)) {
            (int224 value, uint256 timestamp) = IProxy(dapi).read();
            if (block.timestamp - timestamp < STALE_THRESHOLD) {
                return uint256(int256(value));
            }
        }

        // Fallback to Chainlink
        address feed = chainlinkFeed[rwaAsset];
        require(feed != address(0), "No oracle source");

        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        require(block.timestamp - updatedAt < STALE_THRESHOLD, "Stale price");

        return uint256(answer);
    }

    function addAPRODataFeed(address rwaAsset, address dapi) external onlyRole(ADMIN_ROLE) {
        aproDAPI[rwaAsset] = dapi;
    }

    function addChainlinkFeed(address rwaAsset, address feed) external onlyRole(ADMIN_ROLE) {
        chainlinkFeed[rwaAsset] = feed;
    }
}
```

**Trace to**: product.md#4.1.2 (Oracle 净值计算)

---

### 4.2 Frontend Components

**核心组件树**:
```
app/
├── layout.tsx (Root Layout)
│   ├── WagmiProvider (Web3 状态)
│   ├── RainbowKitProvider (钱包 UI)
│   └── Header (导航栏)
│
├── page.tsx (首页)
│   ├── WalletConnect (连接钱包按钮)
│   └── Hero (营销文案)
│
├── dashboard/page.tsx (仪表板)
│   ├── NetValueCard (净值显示)
│   ├── BalanceCard (PNGY 余额)
│   ├── RevenueChart (收益曲线)
│   └── QuickActions (存款/赎回按钮)
│
├── assets/page.tsx (RWA 资产详情)
│   ├── AssetList (资产列表)
│   ├── AssetAllocation (配比饼图)
│   └── RebalanceHistory (再平衡历史)
│
├── history/page.tsx (交易历史)
│   ├── TransactionTable (交易列表)
│   └── ExportButton (导出 CSV)
│
└── admin/page.tsx (管理后台)
    ├── AddAssetForm (添加 RWA 资产)
    ├── RebalancePanel (触发再平衡)
    └── PauseButton (暂停合约)
```

**关键 Hooks**:
```typescript
// hooks/useVault.ts
export function useVault() {
  const { data: nav } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VaultABI,
    functionName: 'totalAssets',
  })

  const { writeAsync: deposit } = useWriteContract({
    address: VAULT_ADDRESS,
    abi: VaultABI,
    functionName: 'deposit',
  })

  return { nav, deposit, ... }
}
```

**Trace to**: product.md#Epic 1 (B2C 核心流程)

---

### 4.3 Backend Components

**API Routes** (Fastify):
```
GET  /api/nav          - 查询当前净值
GET  /api/nav/history  - 历史净值曲线
GET  /api/assets       - 查询所有 RWA 资产
GET  /api/transactions - 查询交易历史
POST /api/rebalance    - 触发再平衡 (需要 Admin 签名)
GET  /api/health       - 健康检查
```

**Workers** (Bull Queue):
```typescript
// workers/oracleUpdater.ts
import cron from 'node-cron'

// 每小时更新一次 Oracle 价格
cron.schedule('0 * * * *', async () => {
  const assets = await getActiveRWAAssets()

  for (const asset of assets) {
    const price = await fetchOraclePrice(asset.oracleSource)
    await saveNetValue({ assetAddress: asset.address, price })
  }
})
```

```typescript
// workers/rebalanceWorker.ts
import { Queue, Worker } from 'bull'

const rebalanceQueue = new Queue('rebalance', { redis: REDIS_URL })

new Worker('rebalance', async (job) => {
  const { sellAssets, buyAssets } = job.data

  // 计算最优配比
  const strategy = new RebalanceStrategy()
  const newAllocations = strategy.calculate(sellAssets, buyAssets)

  // 生成多签交易
  const tx = await generateMultisigTx(newAllocations)

  // 提交到 Gnosis Safe
  await submitToGnosisSafe(tx)
}, { connection: redis })
```

**Trace to**: product.md#4.1.3 (动态再平衡引擎)

---

## 5. Data Architecture

### 5.1 Data Models

详见 Section 3.4.1 的 Prisma Schema

### 5.2 Data Flow

#### 存款流程数据流
```
1. 用户输入金额 → 前端验证 (≥$500)
2. 前端调用 Vault.deposit() → 链上交易
3. 交易确认后 → TransactionIndexer 监听事件
4. 写入 PostgreSQL Transaction 表
5. 前端查询 API 显示交易记录
```

#### 净值查询流程
```
1. 前端定时轮询 GET /api/nav (每 30s)
2. API 查询 PostgreSQL NetValue 表 (最新记录)
3. 如果 >1 小时未更新 → 触发 oracleUpdater Worker
4. Worker 调用 Oracle 合约 → 获取最新价格
5. 计算净值 → 写入 NetValue 表
6. 返回给前端显示
```

---

## 6. API Design

### 6.1 REST API Endpoints

#### GET /api/nav
**描述**: 查询当前 PNGY 净值

**Response**:
```json
{
  "nav": "1.05234567",
  "timestamp": "2025-11-22T10:30:00Z",
  "totalAssets": "1052345.67",
  "totalSupply": "1000000.00"
}
```

#### GET /api/nav/history
**描述**: 查询历史净值曲线

**Query Parameters**:
- `period`: "7d" | "30d" | "90d"

**Response**:
```json
{
  "period": "7d",
  "data": [
    { "timestamp": "2025-11-15T00:00:00Z", "nav": "1.04" },
    { "timestamp": "2025-11-16T00:00:00Z", "nav": "1.042" },
    ...
  ]
}
```

#### GET /api/assets
**描述**: 查询所有 RWA 资产及配置

**Response**:
```json
{
  "assets": [
    {
      "address": "0x123...",
      "name": "Ondo OUSG",
      "symbol": "OUSG",
      "assetType": "treasury",
      "currentAPY": "5.2%",
      "targetAllocation": 50,
      "currentAllocation": 48.5,
      "vaultBalance": "500000.00",
      "price": "1.00"
    },
    ...
  ]
}
```

#### GET /api/transactions
**描述**: 查询用户交易历史

**Query Parameters**:
- `address`: 用户地址
- `type`: "deposit" | "withdraw" | "all"
- `limit`: 默认 20
- `offset`: 分页偏移

**Response**:
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "deposit",
      "amount": "5000.00",
      "shares": "4761.90",
      "txHash": "0xabc...",
      "status": "confirmed",
      "timestamp": "2025-11-22T09:00:00Z"
    },
    ...
  ],
  "total": 50,
  "hasMore": true
}
```

---

### 6.2 Smart Contract ABIs

**PNGYVault ABI** (关键函数):
```json
[
  {
    "name": "deposit",
    "type": "function",
    "inputs": [
      { "name": "assets", "type": "uint256" },
      { "name": "receiver", "type": "address" }
    ],
    "outputs": [{ "name": "shares", "type": "uint256" }]
  },
  {
    "name": "withdraw",
    "type": "function",
    "inputs": [
      { "name": "assets", "type": "uint256" },
      { "name": "receiver", "type": "address" },
      { "name": "owner", "type": "address" }
    ],
    "outputs": [{ "name": "shares", "type": "uint256" }]
  },
  {
    "name": "totalAssets",
    "type": "function",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  ...
]
```

---

## 7. Security Architecture

### 7.1 Authentication

**方法**: Web3 钱包签名验证 (EIP-191)

**流程**:
```
1. 用户连接 MetaMask/Trust Wallet
2. 前端请求签名: "Sign in to Paimon Yield Protocol"
3. 用户签名 → 生成 JWT Token
4. Token 存储在 LocalStorage (有效期 24h)
5. 后续 API 请求携带 Token (Authorization Header)
```

**实现**:
```typescript
// plugins/auth.ts
export async function verifyWeb3Signature(
  message: string,
  signature: string,
  address: string
): Promise<boolean> {
  const recoveredAddress = verifyMessage({ message, signature })
  return recoveredAddress.toLowerCase() === address.toLowerCase()
}
```

---

### 7.2 Authorization

**模型**: 基于角色的访问控制 (RBAC)

**角色定义**:
- **User**: 存款、赎回、查看净值
- **Admin**: 添加/移除 RWA 资产、配置 Oracle
- **Rebalancer**: 执行再平衡
- **Multisig**: 批准重大操作 (3/5 签名)

**智能合约实现**:
```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

modifier onlyRole(bytes32 role) {
    require(hasRole(role, msg.sender), "Unauthorized");
    _;
}
```

**Trace to**: product.md#5.2.2 (授权)

---

### 7.3 Data Protection

**Encryption at Rest**:
- 链上数据: 区块链原生加密
- 链下数据 (PostgreSQL): AES-256 加密 (Railway 内置)
- 敏感配置 (API Keys): Vercel Secrets + Railway Env

**Encryption in Transit**:
- 前端 ↔ 后端: TLS 1.3 (HTTPS)
- 后端 ↔ BSC RPC: HTTPS

**Secret Management**:
- 私钥: Gnosis Safe 多签钱包 (3/5)
- API Keys: 环境变量 + Secrets 管理
- Database URL: Railway 环境变量

---

### 7.4 Smart Contract Security

**安全措施**:
1. ✅ **ReentrancyGuard** - 防止重入攻击
2. ✅ **Pausable** - 紧急暂停机制
3. ✅ **AccessControl** - 角色权限控制
4. ✅ **Circuit Breaker** - 净值异常熔断
5. ✅ **多签治理** - Gnosis Safe 3/5
6. ✅ **外部审计** - CertiK/SlowMist
7. ✅ **Slippage Protection** - DEX 交易滑点保护

**安全检查清单**:
- [ ] Slither 静态分析 (无 High/Critical)
- [ ] Aderyn 审计工具扫描
- [ ] Foundry Fuzzing 测试 (1000+ runs)
- [ ] a16z ERC4626 测试套件通过
- [ ] 外部审计报告 (无 High/Critical)
- [ ] 测试网运行 2+ 周无问题
- [ ] Bug Bounty 计划启动

**Trace to**: product.md#5.2 (安全需求)

---

## 8. Performance Architecture

### 8.1 Frontend Performance

**目标** (基于 `.ultra/config.json`):
- LCP (Largest Contentful Paint): <2.5s
- INP (Interaction to Next Paint): <200ms
- CLS (Cumulative Layout Shift): <0.1

**优化策略**:
1. **SSR**: Next.js Server Components 渲染首屏
2. **图片优化**: next/image 自动 WebP + lazy loading
3. **代码分割**: 动态导入图表组件
   ```typescript
   const RevenueChart = dynamic(() => import('./RevenueChart'), {
     loading: () => <Skeleton />,
     ssr: false
   })
   ```
4. **CDN**: Vercel Edge Network 全球加速
5. **缓存**: SWR 数据缓存 + stale-while-revalidate

**Trace to**: product.md#5.3.3 (前端性能)

---

### 8.2 Smart Contract Performance

**Gas 优化**:
1. **使用 Foundry Gas Reporter**:
   ```bash
   forge test --gas-report
   ```
2. **优化存储**:
   - 使用 `uint256` 而非 `uint8` (EVM 优化)
   - 打包多个变量到单个 slot
3. **批量操作**:
   - 再平衡时批量买卖资产 (单笔交易)
4. **事件 vs 存储**:
   - 历史数据用 Event 而非链上存储

**目标 Gas 费用** (BSC 标准):
- Deposit: ~100K gas (~$0.15)
- Withdraw: ~120K gas (~$0.18)
- Rebalance: ~300K gas (~$0.45)

**Trace to**: product.md#5.3.1 (响应时间)

---

### 8.3 Backend Performance

**优化措施**:
1. **Database Indexing**:
   ```sql
   CREATE INDEX idx_transactions_user_time ON transactions(user_id, created_at DESC);
   CREATE INDEX idx_net_values_time ON net_values(timestamp DESC);
   ```
2. **Connection Pooling**: Prisma 连接池 (最大 10 连接)
3. **Redis Caching**:
   - 净值缓存 (TTL 60s)
   - 资产列表缓存 (TTL 5min)
4. **Rate Limiting**: 每用户 100 req/min

**目标响应时间**:
- GET /api/nav: <200ms (缓存命中)
- GET /api/transactions: <500ms (数据库查询)

**Trace to**: product.md#5.3.1 (响应时间)

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
       /\
      /E2E\        - 10%  (Playwright - 前端 + 合约集成)
     /------\
    /Integra\      - 30%  (Foundry 集成测试 + API 测试)
   /----------\
  /Unit Tests \    - 60%  (Forge Test + Vitest)
 /--------------\
```

---

### 9.2 Smart Contract Testing

**工具**: Foundry (Forge Test + Fuzzing)

**测试覆盖**:
```bash
forge coverage --report summary
```

**目标覆盖率** (基于 `.ultra/config.json`):
- Overall: ≥90%
- Critical paths (deposit/withdraw/rebalance): 100%
- Branch coverage: ≥75%

**示例测试**:
```solidity
// test/PNGYVault.t.sol
contract PNGYVaultTest is Test {
    PNGYVault vault;
    MockUSDT usdt;

    function setUp() public {
        usdt = new MockUSDT();
        vault = new PNGYVault(usdt, "PNGY", "PNGY", address(oracle));
    }

    function testDeposit() public {
        uint256 depositAmount = 1000e6; // $1000 USDT
        usdt.mint(address(this), depositAmount);
        usdt.approve(address(vault), depositAmount);

        uint256 sharesBefore = vault.balanceOf(address(this));
        vault.deposit(depositAmount, address(this));
        uint256 sharesAfter = vault.balanceOf(address(this));

        assertGt(sharesAfter, sharesBefore);
    }

    function testFuzz_Deposit(uint256 amount) public {
        vm.assume(amount >= 500e6 && amount <= 1_000_000e6);
        // Fuzz test deposit with random amounts
    }
}
```

**ERC4626 合规测试**:
```bash
forge install a16z/erc4626-tests
forge test --match-contract ERC4626PropertyTests
```

**Trace to**: .ultra/config.json#quality_gates.test_coverage

---

### 9.3 Frontend Testing

**工具**: Vitest + React Testing Library + Playwright

**单元测试**:
```typescript
// __tests__/components/DepositForm.test.tsx
describe('DepositForm', () => {
  it('validates minimum deposit amount', () => {
    render(<DepositForm />)
    const input = screen.getByLabelText('Amount')
    fireEvent.change(input, { target: { value: '100' } })
    expect(screen.getByText(/minimum: \$500/i)).toBeInTheDocument()
  })
})
```

**E2E 测试** (Playwright):
```typescript
// e2e/deposit.spec.ts
test('user can deposit USDT', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard')
  await page.click('text=Connect Wallet')
  await page.click('text=MetaMask')

  // Mock wallet interaction
  await page.fill('input[name="amount"]', '1000')
  await page.click('text=Deposit')

  await expect(page.locator('text=Transaction confirmed')).toBeVisible()
})
```

---

## 10. Deployment Architecture

### 10.1 Environments

| Environment | Purpose | URL | Branch |
|-------------|---------|-----|--------|
| **Local** | 开发环境 | localhost:3000 | feature/* |
| **Testnet** | 测试环境 | testnet.paimon.finance | develop |
| **Mainnet** | 生产环境 | app.paimon.finance | main |

**BSC Networks**:
- Testnet: BSC Testnet (Chain ID: 97)
- Mainnet: BSC Mainnet (Chain ID: 56)

---

### 10.2 Deployment Flow

```
1. Developer pushes to feature/* branch
2. CI/CD runs:
   - Foundry tests (forge test)
   - Frontend tests (pnpm test)
   - Linting (pnpm lint)
3. Merge to develop → Deploy to Testnet
4. QA testing on Testnet (1-2 weeks)
5. Create PR to main → Code review
6. Merge to main → Deploy to Mainnet:
   - Deploy contracts (forge script)
   - Deploy frontend (Vercel)
   - Deploy backend (Railway)
7. Smoke tests on Mainnet
8. Monitor (Sentry + Railway logs)
```

---

### 10.3 Rollback Strategy

**Deployment Strategy**: Blue-Green

**Rollback Steps**:
1. 检测异常 (Sentry 告警 / 用户报告)
2. 评估严重程度 (Critical / High / Medium)
3. 如果 Critical:
   - 前端: Vercel 一键回滚到上一版本
   - 后端: Railway 回滚到上一 Docker 镜像
   - 合约: 多签暂停合约 (pause())
4. 修复问题 → 重新部署
5. 恢复合约 (unpause())

**Database Migrations**: 向后兼容
```prisma
// 添加新字段时使用 Optional
model User {
  newField String? // 可选字段,避免破坏旧版本
}
```

**Trace to**: product.md#5.1.2 (Recovery Time Objective)

---

## 11. Scalability Considerations

### 11.1 Horizontal Scaling

**可扩展组件**:
- ✅ Frontend: Vercel CDN 自动扩展
- ✅ Backend: Railway 容器自动扩展 (0 → 1K 并发)
- ✅ Database: PostgreSQL 读副本 (Railway 付费版)

**不可扩展组件**:
- ❌ Smart Contracts: 单一 Vault 合约 (无法水平扩展)
  - 缓解: 优化 Gas 费用,提高单合约容量

---

### 11.2 Vertical Scaling

**资源限制**:
- Frontend: Vercel Serverless (自动扩展)
- Backend: Railway 最高 32 vCPU + 32GB RAM
- Database: PostgreSQL 最高 32GB RAM

**Auto-Scaling 触发**:
- CPU >70% → Scale up
- Memory >80% → Scale up
- Request latency >1s → Scale up

**Trace to**: product.md#5.4 (可扩展性需求)

---

### 11.3 Load Distribution

**Geographic Distribution**:
- 目标用户: 东南亚 + 东亚
- CDN 节点: 香港、新加坡、东京 (Vercel Edge)

**RPC Load Balancing**:
```typescript
const RPC_URLS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc.publicnode.com',
]

function getRandomRPC() {
  return RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]
}
```

---

## 12. Architecture Decisions (ADRs)

所有重大架构决策记录在 `.ultra/docs/decisions/` 目录:

### ADR-001: 技术栈选择
**日期**: 2025-11-22
**状态**: Accepted

**决策**: Foundry + Next.js + Node.js + PostgreSQL + Vercel/Railway

**理由**:
- Foundry 测试速度快 10x,节省 4-6 周
- Next.js 是 Web3 DApp 标准,SEO 友好
- Node.js 全栈 TypeScript,零学习成本
- PostgreSQL 强一致性,ACID 事务
- Vercel + Railway 成本低 ($30-50/月)

**后果**:
- 团队需要 1-2 周学习 Foundry
- BSC Gas 费优化需要持续监控

**Trace to**: Round 3 技术选型

---

### ADR-002: RWA 资产集成模式
**日期**: 2025-11-22
**状态**: Accepted

**决策**: 集成 BSC 已有的 RWA 代币,而非自己发行

**理由**:
- 降低合规和审计成本
- 减少 RWA 资产发行的法律风险
- 专注于收益聚合和用户体验
- 节省 2-4 天开发时间

**后果**:
- 依赖外部 RWA 项目的可靠性
- 需要调研 BSC RWA 生态 (风险: 可能稀缺)
- 备选方案: 迁移到 Ethereum 或跨链桥接

**Trace to**: architecture-correction-summary.md

---

### ADR-003: 双 Oracle 架构
**日期**: 2025-11-22
**状态**: Accepted

**决策**: APRO (API3) 为主 + Chainlink 为备

**理由**:
- 双保险降低单点故障风险
- APRO 更新频率高,Chainlink 可靠性高
- 自动切换逻辑 (>2h 未更新 → Chainlink)

**后果**:
- 增加 Oracle 集成复杂度
- 需要监控两个数据源的健康状态

**Trace to**: product.md#Integration 1/2

---

## 13. Open Questions

### 13.1 Technical Uncertainties

**Question 1**: BSC 上是否有足够的 RWA 资产可集成?

**Impacts**: 如果找不到 ≥3 个 RWA 资产,需要触发备选方案 (迁移 Ethereum / 跨链桥接)

**Research Needed**: RWA 资产调研清单 (`.ultra/docs/research/rwa-asset-research-checklist.md`)

**Deadline**: 2025-11-29 (调研第 7 天)

**Trace to**: architecture-correction-summary.md#风险 1

---

**Question 2**: APRO (API3) 是否支持 RWA 资产价格喂价?

**Impacts**: 如果不支持,需要使用 Chainlink 或 RWA 项目方 Oracle

**Research Needed**: 联系 API3 团队确认自定义 dAPI 服务

**Deadline**: 2025-11-25 (调研第 3 天)

---

**Question 3**: PancakeSwap 上 RWA 代币的流动性是否充足?

**Impacts**: 如果流动性差 (滑点 >2%),需要直接与 RWA 协议集成 mint/redeem 接口

**Research Needed**: 测试 $1K/$10K/$100K 订单的滑点

**Deadline**: 2025-11-26 (调研第 4 天)

---

## 14. References

### 14.1 Internal Documents

- `.ultra/specs/product.md` - 产品需求文档
- `.ultra/constitution.md` - 项目原则和开发标准
- `.ultra/config.json` - 项目配置 (单一数据源)
- `.ultra/docs/research/rwa-asset-research-checklist.md` - RWA 调研清单
- `.ultra/docs/research/architecture-correction-summary.md` - 架构修正摘要

### 14.2 External Resources

**Smart Contracts**:
- Foundry Book: https://book.getfoundry.sh/
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- ERC4626 Standard: https://eips.ethereum.org/EIPS/eip-4626
- a16z ERC4626 Tests: https://github.com/a16z/erc4626-tests

**Frontend**:
- Next.js 14 Docs: https://nextjs.org/docs
- Wagmi: https://wagmi.sh/
- RainbowKit: https://www.rainbowkit.com/
- Viem: https://viem.sh/

**Backend**:
- Fastify: https://fastify.dev/
- Prisma: https://www.prisma.io/docs
- Bull: https://docs.bullmq.io/

**Infrastructure**:
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app/

**Security**:
- CertiK: https://www.certik.com/
- SlowMist: https://www.slowmist.com/
- Slither: https://github.com/crytic/slither

---

## 15. Appendix

### 15.1 Glossary

- **RWA**: Real World Assets (真实世界资产)
- **ERC4626**: Tokenized Vault Standard
- **PNGY**: Paimon Yield Token (用户持有的 Vault Shares)
- **NAV**: Net Asset Value (净值)
- **APY**: Annual Percentage Yield (年化收益率)
- **Circuit Breaker**: 熔断机制 (净值异常时限制交易)
- **Gnosis Safe**: 多签钱包
- **APRO**: API3 Decentralized API
- **BSC**: BNB Smart Chain (原 Binance Smart Chain)

---

### 15.2 Acronyms

- **TDD**: Test-Driven Development
- **RBAC**: Role-Based Access Control
- **ACID**: Atomicity, Consistency, Isolation, Durability
- **CDN**: Content Delivery Network
- **RPC**: Remote Procedure Call
- **ORM**: Object-Relational Mapping
- **API**: Application Programming Interface
- **SDK**: Software Development Kit
- **JWT**: JSON Web Token
- **HTTPS**: Hypertext Transfer Protocol Secure

---

**Document Status**: ✅ Approved
**Last Updated**: 2025-11-22
**Reviewed By**: Ultra Research Agent (Round 3 Complete)
**Next Review**: Round 4 (Risk & Constraints)
