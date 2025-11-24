// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NetworkConfig
/// @notice Centralized configuration for different networks
/// @dev Contains addresses for USDT, PancakeSwap, Chainlink feeds, and Gnosis Safe
library NetworkConfig {
    // =============================================================================
    // Network IDs
    // =============================================================================

    uint256 public constant BSC_MAINNET = 56;
    uint256 public constant BSC_TESTNET = 97;
    uint256 public constant LOCAL = 31337;

    // =============================================================================
    // BSC Mainnet Addresses
    // =============================================================================

    struct MainnetConfig {
        address usdt;
        address pancakeRouter;
        address chainlinkBNBUSD;
        address gnosisSafe;
        uint256 defaultSlippage;
    }

    function getMainnetConfig() internal pure returns (MainnetConfig memory) {
        return MainnetConfig({
            // Binance-Peg BSC-USD (USDT)
            usdt: 0x55d398326f99059fF775485246999027B3197955,
            // PancakeSwap V2 Router
            pancakeRouter: 0x10ED43C718714eb63d5aA57B78B54704E256024E,
            // Chainlink BNB/USD Price Feed
            chainlinkBNBUSD: 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE,
            // Gnosis Safe address (to be set via environment)
            gnosisSafe: address(0),
            // Default slippage 1%
            defaultSlippage: 100
        });
    }

    // =============================================================================
    // BSC Testnet Addresses
    // =============================================================================

    struct TestnetConfig {
        address usdt;
        address pancakeRouter;
        address chainlinkBNBUSD;
        uint256 defaultSlippage;
    }

    function getTestnetConfig() internal pure returns (TestnetConfig memory) {
        return TestnetConfig({
            // BSC Testnet USDT (various faucets available)
            // This is a commonly used test USDT on BSC testnet
            usdt: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd,
            // PancakeSwap V2 Router (Testnet)
            pancakeRouter: 0xD99D1c33F9fC3444f8101754aBC46c52416550D1,
            // Chainlink BNB/USD Price Feed (Testnet)
            chainlinkBNBUSD: 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526,
            // Default slippage 2% (higher for testnet)
            defaultSlippage: 200
        });
    }

    // =============================================================================
    // Protocol Configuration
    // =============================================================================

    struct ProtocolConfig {
        // Note: MIN_DEPOSIT (500e18) and MAX_WITHDRAWAL (100_000e18) are constants in PNGYVault
        uint256 circuitBreakerThreshold;
        uint256 apySensitivity;
        uint256 oracleStalenessThreshold;
    }

    function getProtocolConfig() internal pure returns (ProtocolConfig memory) {
        return ProtocolConfig({
            // Circuit breaker: -5% (500 basis points)
            circuitBreakerThreshold: 500,
            // APY sensitivity for rebalancing: 50%
            apySensitivity: 50,
            // Oracle staleness threshold: 2 hours
            oracleStalenessThreshold: 2 hours
        });
    }

    // =============================================================================
    // RWA Asset Configuration (Example - to be customized per deployment)
    // =============================================================================

    struct RWAAssetConfig {
        string name;
        string symbol;
        address tokenAddress;
        address oracleAddress;
        uint256 targetAllocation; // In basis points (5000 = 50%)
    }

    // Note: RWA asset addresses should be configured via environment variables
    // or deployment parameters as they vary per deployment
}
