# Paimon Yield Protocol - Deployment Guide

## Overview

This guide covers deploying the Paimon Yield Protocol to production using:
- **Frontend**: Vercel (Next.js 14)
- **Backend**: Railway (Fastify + PostgreSQL + Redis)
- **Contracts**: BSC Mainnet/Testnet

## Prerequisites

- GitHub repository access
- Vercel account (https://vercel.com)
- Railway account (https://railway.app)
- Environment variable values ready

---

## Part 1: Frontend Deployment (Vercel)

### Step 1: Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Select **frontend** as the root directory

### Step 2: Configure Build Settings

```
Framework Preset: Next.js
Root Directory: frontend
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install
```

### Step 3: Set Environment Variables

Add these variables in Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect Project ID | `abc123...` |
| `NEXT_PUBLIC_PNGY_VAULT_ADDRESS` | Vault contract address | `0x...` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.paimon.finance` |
| `BACKEND_URL` | Backend URL for proxy | `https://backend.railway.app` |

### Step 4: Deploy

- Push to `main` branch for production
- Push to other branches for preview deployments

### Step 5: Configure Domain

1. Go to **Settings** → **Domains**
2. Add custom domain: `app.paimon.finance`
3. Configure DNS records as shown

---

## Part 2: Backend Deployment (Railway)

### Step 1: Create Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose the repository

### Step 2: Configure Service

1. Set **Root Directory** to `backend`
2. Railway will auto-detect the configuration from `railway.toml`

### Step 3: Add PostgreSQL

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL`

### Step 4: Add Redis

1. Click **+ New** → **Database** → **Redis**
2. Railway auto-injects `REDIS_URL`

### Step 5: Set Environment Variables

Add these variables in Railway service settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGIN` | Frontend URL | `https://app.paimon.finance` |
| `BSC_MAINNET_RPC_URL` | BSC RPC endpoint | `https://bsc-dataseed.binance.org` |
| `PNGY_VAULT_ADDRESS` | Vault contract address | `0x...` |
| `BSCSCAN_API_KEY` | BscScan API key | `abc123...` |
| `JWT_SECRET` | JWT signing secret | `random-32-char-string` |

### Step 6: Run Database Migration

```bash
railway run pnpm db:migrate
```

### Step 7: Configure Domain

1. Go to **Settings** → **Networking**
2. Generate domain or add custom domain: `api.paimon.finance`

---

## Part 3: Environment Configuration

### Development Environment

```env
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PNGY_VAULT_ADDRESS=0x...testnet

# Backend (.env)
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/paimon_dev
REDIS_URL=redis://localhost:6379
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

### Staging Environment

Use BSC Testnet for contracts, separate databases.

### Production Environment

Use BSC Mainnet, production databases with backups.

---

## Part 4: Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Contract addresses updated
- [ ] CORS origins configured

### Post-Deployment

- [ ] Health check endpoint responding
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] Frontend can connect to backend
- [ ] Wallet connection working
- [ ] Monitoring configured

---

## Part 5: Monitoring & Maintenance

### Health Check Endpoints

- Frontend: `https://app.paimon.finance` (200 OK)
- Backend: `https://api.paimon.finance/health`

### Logs

- **Vercel**: Dashboard → Deployments → View Logs
- **Railway**: Dashboard → Service → Logs

### Database Backups

Railway automatically backs up PostgreSQL databases. Configure retention in project settings.

### Scaling

- **Vercel**: Auto-scales by default
- **Railway**: Configure replicas in `railway.toml` or dashboard

---

## Troubleshooting

### Common Issues

1. **Build fails on Vercel**
   - Check pnpm version compatibility
   - Verify environment variables are set

2. **Database connection fails**
   - Verify `DATABASE_URL` format
   - Check Railway PostgreSQL status

3. **CORS errors**
   - Update `CORS_ORIGIN` to include all frontend domains

4. **Redis connection fails**
   - Verify `REDIS_URL` format
   - Check Railway Redis status

---

## References

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Fastify Production](https://www.fastify.io/docs/latest/Guides/Recommendations/)
