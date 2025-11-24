# Feature: Smart Contract Deployment Scripts

**Task ID**: 37
**Status**: In Progress
**Branch**: feat/task-37-deploy-scripts

## Overview

Create production-ready deployment scripts for Paimon Yield Protocol supporting BSC Testnet and Mainnet deployments with real network addresses.

## Rationale

1. Existing Deploy.s.sol uses mock contracts for local testing
2. Need production scripts with real BSC addresses (USDT, PancakeSwap, Chainlink)
3. Support Gnosis Safe for governance role transfer
4. Enable reproducible deployments across networks

## Deliverables

1. **NetworkConfig.sol** - Centralized network configuration library
2. **DeployBSCTestnet.s.sol** - BSC Testnet deployment script
3. **DeployBSCMainnet.s.sol** - BSC Mainnet deployment script
4. **Documentation** - Deployment instructions and addresses

## Implementation Plan

### Phase 1: Network Configuration
- BSC Testnet: USDT (faucet), PancakeSwap V2 Router
- BSC Mainnet: USDT, PancakeSwap V2 Router, Chainlink feeds

### Phase 2: Deployment Scripts
- Deployment order: AssetRegistry -> OracleAdapter -> SwapHelper -> RebalanceStrategy -> PNGYVault
- Configure Gnosis Safe as admin (mainnet)
- Verify contracts on BSCScan

### Phase 3: Validation
- Test deployment on BSC Testnet
- Verify all contracts and configurations

## Impact Assessment

- **User Stories Affected**: N/A (infrastructure)
- **Architecture Changes**: No core contract changes
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/architecture.md#102-deployment-flow

---

## Implementation Results

### Files Created

| File | Description |
|------|-------------|
| `script/NetworkConfig.sol` | Centralized network configuration library |
| `script/DeployBSCTestnet.s.sol` | BSC Testnet deployment script |
| `script/DeployBSCMainnet.s.sol` | BSC Mainnet deployment script |

### Network Configurations

**BSC Testnet (chainId 97)**:
- USDT: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`
- PancakeSwap V2 Router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
- Chainlink BNB/USD: `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526`
- Default Slippage: 2% (200 bps)

**BSC Mainnet (chainId 56)**:
- USDT: `0x55d398326f99059fF775485246999027B3197955`
- PancakeSwap V2 Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Chainlink BNB/USD: `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`
- Default Slippage: 1% (100 bps)

### Deployment Order

```
1. AssetRegistry
2. OracleAdapter (configure staleness threshold)
3. SwapHelper (with PancakeSwap router)
4. RebalanceStrategy
5. PNGYVault (configure dependencies)
6. [Mainnet only] Transfer roles to Gnosis Safe
```

### Usage

**BSC Testnet Deployment**:
```bash
PRIVATE_KEY=... forge script script/DeployBSCTestnet.s.sol \
  --rpc-url $BSC_TESTNET_RPC --broadcast --verify
```

**BSC Mainnet Deployment**:
```bash
PRIVATE_KEY=... GNOSIS_SAFE_ADDRESS=0x... forge script script/DeployBSCMainnet.s.sol \
  --rpc-url $BSC_MAINNET_RPC --broadcast --verify
```

**Add RWA Assets (post-deployment)**:
```bash
VAULT_ADDRESS=... ASSET_REGISTRY_ADDRESS=... ORACLE_ADAPTER_ADDRESS=... \
RWA_TOKEN=... RWA_ORACLE=... TARGET_ALLOCATION=5000 ASSET_TYPE=0 \
forge script script/DeployBSCTestnet.s.sol:AddRWAAssets --rpc-url $BSC_TESTNET_RPC --broadcast
```

### Test Results

All 480 tests passed after implementation.
