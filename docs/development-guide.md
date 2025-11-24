# Paimon Yield Protocol - Development Guide

This guide covers setting up the local development environment and common development workflows.

## Prerequisites

- **Node.js**: v20.0.0 or higher
- **pnpm**: v8.0.0 or higher
- **Foundry**: Latest version
- **PostgreSQL**: v16 or higher
- **Redis**: v7 or higher
- **Git**: v2.30 or higher

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/paimon-yield-protocol.git
cd paimon-yield-protocol

# Install dependencies (all workspaces)
pnpm install

# Copy environment files
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp contracts/.env.example contracts/.env

# Start development servers
pnpm dev
```

---

## Project Structure

```
paimon-yield-protocol/
├── contracts/          # Solidity smart contracts (Foundry)
├── frontend/           # Next.js 14 frontend application
├── backend/            # Fastify API server
├── docs/               # Project documentation
├── .github/            # GitHub Actions workflows
└── .ultra/             # Ultra Builder configuration
```

---

## Environment Setup

### 1. Smart Contracts (Foundry)

```bash
cd contracts

# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with gas report
forge test --gas-report

# Format code
forge fmt
```

#### Environment Variables

Create `contracts/.env`:

```env
# BSC RPC URLs
BSC_MAINNET_RPC_URL=https://bsc-dataseed.binance.org
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# Deployer private key (NEVER commit this)
PRIVATE_KEY=

# BscScan API key for verification
BSCSCAN_API_KEY=
```

### 2. Frontend (Next.js)

```bash
cd frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run linter
pnpm lint

# Run type check
pnpm type-check

# Run tests
pnpm test
```

#### Environment Variables

Create `frontend/.env.local`:

```env
# WalletConnect Project ID
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Contract addresses
NEXT_PUBLIC_PNGY_VAULT_ADDRESS=0x...

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Backend (Fastify)

```bash
cd backend

# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:push

# Start development server
pnpm dev

# Build for production
pnpm build

# Run linter
pnpm lint

# Run tests
pnpm test
```

#### Environment Variables

Create `backend/.env`:

```env
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/paimon_yield

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain
BSC_MAINNET_RPC_URL=https://bsc-dataseed.binance.org
PNGY_VAULT_ADDRESS=0x...
```

---

## Database Setup

### Local PostgreSQL

```bash
# Using Docker
docker run -d \
  --name paimon-postgres \
  -e POSTGRES_USER=paimon \
  -e POSTGRES_PASSWORD=paimon \
  -e POSTGRES_DB=paimon_yield \
  -p 5432:5432 \
  postgres:16-alpine

# Using Homebrew (macOS)
brew install postgresql@16
brew services start postgresql@16
createdb paimon_yield
```

### Local Redis

```bash
# Using Docker
docker run -d \
  --name paimon-redis \
  -p 6379:6379 \
  redis:7-alpine

# Using Homebrew (macOS)
brew install redis
brew services start redis
```

### Run Migrations

```bash
cd backend

# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Run migrations (production)
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio
```

---

## Development Workflows

### Running All Services

```bash
# From root directory
pnpm dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Backend Swagger: http://localhost:3001/docs

### Running Individual Services

```bash
# Frontend only
pnpm --filter @paimon/frontend dev

# Backend only
pnpm --filter @paimon/backend dev

# Contracts (watch mode)
cd contracts && forge build --watch
```

### Testing

```bash
# All tests
pnpm test

# Contracts
cd contracts && forge test -vvv

# Frontend
cd frontend && pnpm test

# Backend
cd backend && pnpm test

# Backend with coverage
cd backend && pnpm test:coverage
```

### Linting & Formatting

```bash
# Lint all
pnpm lint

# Format contracts
cd contracts && forge fmt

# Fix frontend lint issues
cd frontend && pnpm lint --fix

# Fix backend lint issues
cd backend && pnpm lint:fix
```

---

## Smart Contract Development

### Writing Tests

```solidity
// test/PNGYVault.t.sol
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PNGYVault} from "../src/PNGYVault.sol";

contract PNGYVaultTest is Test {
    PNGYVault vault;

    function setUp() public {
        vault = new PNGYVault();
    }

    function test_Deposit() public {
        // Test deposit functionality
    }

    function testFuzz_Deposit(uint256 amount) public {
        // Fuzz test with random amounts
    }
}
```

### Deployment

```bash
# Deploy to testnet
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --broadcast

# Verify on BscScan
forge verify-contract $CONTRACT_ADDRESS PNGYVault --chain-id 97
```

---

## Troubleshooting

### Common Issues

#### 1. pnpm install fails

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

#### 2. Prisma client not generated

```bash
cd backend
pnpm db:generate
```

#### 3. Port already in use

```bash
# Find and kill process on port
lsof -i :3000
kill -9 <PID>
```

#### 4. Foundry installation issues

```bash
# Reinstall Foundry
foundryup --force
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all projects |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run linters |
| `forge build` | Build smart contracts |
| `forge test` | Run contract tests |
| `forge fmt` | Format Solidity code |

---

## IDE Setup

### VS Code Extensions

- **Solidity** (Juan Blanco) - Solidity syntax highlighting
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Prisma** - Prisma schema syntax
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

### Recommended Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[solidity]": {
    "editor.defaultFormatter": "JuanBlanco.solidity"
  }
}
```

---

## Next Steps

- Read [Contributing Guide](./contributing.md) for code standards
- Review [Deployment Guide](../.ultra/docs/deployment-guide.md) for production setup
- Check [Architecture Documentation](../.ultra/specs/architecture.md) for system design
