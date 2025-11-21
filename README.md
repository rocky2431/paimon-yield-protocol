# Paimon Yield Protocol

> BSC链上的RWA聚合收益理财协议

## 项目概述

Paimon Yield Protocol 是一个部署在币安智能链（BSC）上的去中心化收益聚合协议，专注于真实世界资产（RWA）的收益管理。

### 核心机制

- **存入 USDT** → 铸造 **PNGY** 代币（基金份额）
- **PNGY** 代币对应基金净值
- 协议投资经过认证的 RWA 代币
- 通过 PNGY 净值增长获得收益

## 技术栈

### 智能合约层
- **Solidity** - 智能合约语言
- **Foundry (Forge)** - 开发、测试、部署框架

### 前端层
- **Next.js + TypeScript** - 现代 React 框架
- **Reown (WalletConnect v3)** - 多钱包连接

### 后端层
- **Node.js + Express** - API 服务
- 价格预言机、数据缓存、分析服务

## 快速开始

```bash
# 安装依赖（待项目结构完成后补充）
pnpm install

# 运行开发环境
pnpm dev
```

## 项目结构

- `.ultra/` - Ultra Builder Pro 项目配置
  - `specs/` - 产品需求和架构设计
  - `tasks/` - 任务管理
  - `docs/` - 研究报告和技术决策

## 开发工作流

此项目使用 Ultra Builder Pro 4.2 开发工作流：

1. ✅ `/ultra-init` - 项目初始化（已完成）
2. ⏭️ `/ultra-research` - 技术调研（下一步）
3. ⏭️ `/ultra-plan` - 任务规划
4. ⏭️ `/ultra-dev` - TDD 开发
5. ⏭️ `/ultra-test` - 综合测试
6. ⏭️ `/ultra-deliver` - 部署优化

## License

待定

---

🏗️ 项目由 [Ultra Builder Pro](https://github.com/anthropics/claude-code) 创建
