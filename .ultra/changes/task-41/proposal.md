# Feature: Wallet Connection with Reown AppKit

**Task ID**: 41
**Status**: In Progress
**Branch**: feat/task-41-wallet-connect

## Overview

Implement wallet connection functionality using Reown AppKit (formerly WalletConnect/Web3Modal) instead of the originally planned RainbowKit. This provides a modern, feature-rich wallet connection experience.

## Rationale

1. **User Request**: Explicit request to use Reown instead of RainbowKit
2. **Modern Stack**: Reown AppKit is the latest iteration of WalletConnect's UI toolkit
3. **Feature Rich**: Includes social login, email wallets, and better UX
4. **BSC Support**: Native support for BSC mainnet and testnet

## Implementation Changes

### Dependencies
- Remove: `@rainbow-me/rainbowkit`
- Add: `@reown/appkit`, `@reown/appkit-adapter-wagmi`

### Files Modified
1. `frontend/package.json` - Update dependencies
2. `frontend/lib/wagmi/config.ts` - Use WagmiAdapter from Reown
3. `frontend/app/providers.tsx` - Replace RainbowKitProvider with Reown setup
4. `frontend/components/WalletConnect.tsx` - New component (create)

## Deliverables

1. Wallet connection/disconnection functionality
2. Display connected wallet address
3. Display USDT balance on BSC
4. Network check (BSC mainnet/testnet)
5. Component tests

## Impact Assessment

- **User Stories Affected**: user-story-11-连接钱包
- **Architecture Changes**: No - wallet middleware replacement only
- **Breaking Changes**: No

## Requirements Trace

- Traces to: specs/product.md#user-story-11-连接钱包
