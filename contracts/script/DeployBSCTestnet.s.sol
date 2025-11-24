// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AssetRegistry} from "../src/AssetRegistry.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {SwapHelper} from "../src/SwapHelper.sol";
import {RebalanceStrategy} from "../src/RebalanceStrategy.sol";
import {PNGYVault} from "../src/PNGYVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NetworkConfig} from "./NetworkConfig.sol";

/// @title DeployBSCTestnet
/// @notice Deployment script for BSC Testnet
/// @dev Run with: forge script script/DeployBSCTestnet.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast --verify
contract DeployBSCTestnet is Script {
    // =============================================================================
    // Deployed Contract Addresses
    // =============================================================================

    AssetRegistry public assetRegistry;
    OracleAdapter public oracleAdapter;
    SwapHelper public swapHelper;
    RebalanceStrategy public rebalanceStrategy;
    PNGYVault public vault;

    // =============================================================================
    // Configuration
    // =============================================================================

    address public admin;
    NetworkConfig.TestnetConfig public networkConfig;
    NetworkConfig.ProtocolConfig public protocolConfig;

    // =============================================================================
    // Main Entry Point
    // =============================================================================

    function run() external {
        // Validate network
        require(block.chainid == NetworkConfig.BSC_TESTNET, "Must run on BSC Testnet (chainId 97)");

        // Load configuration
        networkConfig = NetworkConfig.getTestnetConfig();
        protocolConfig = NetworkConfig.getProtocolConfig();

        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        admin = vm.addr(deployerPrivateKey);

        console2.log("========================================");
        console2.log("BSC TESTNET DEPLOYMENT");
        console2.log("========================================");
        console2.log("Deployer:", admin);
        console2.log("Chain ID:", block.chainid);
        console2.log("USDT:", networkConfig.usdt);
        console2.log("PancakeSwap Router:", networkConfig.pancakeRouter);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts in order
        _deployAssetRegistry();
        _deployOracleAdapter();
        _deploySwapHelper();
        _deployRebalanceStrategy();
        _deployVault();
        _configureVault();

        vm.stopBroadcast();

        // Log deployment summary
        _logDeployment();
    }

    // =============================================================================
    // Deployment Functions
    // =============================================================================

    function _deployAssetRegistry() internal {
        console2.log("\n[1/5] Deploying AssetRegistry...");
        assetRegistry = new AssetRegistry(admin);
        console2.log("  AssetRegistry:", address(assetRegistry));
    }

    function _deployOracleAdapter() internal {
        console2.log("\n[2/5] Deploying OracleAdapter...");
        oracleAdapter = new OracleAdapter(admin);

        // Configure global staleness threshold
        oracleAdapter.setGlobalStalenessThreshold(protocolConfig.oracleStalenessThreshold);
        console2.log("  OracleAdapter:", address(oracleAdapter));
    }

    function _deploySwapHelper() internal {
        console2.log("\n[3/5] Deploying SwapHelper...");
        swapHelper = new SwapHelper(
            networkConfig.pancakeRouter,
            admin,
            networkConfig.defaultSlippage
        );
        console2.log("  SwapHelper:", address(swapHelper));
    }

    function _deployRebalanceStrategy() internal {
        console2.log("\n[4/5] Deploying RebalanceStrategy...");
        rebalanceStrategy = new RebalanceStrategy(admin, protocolConfig.apySensitivity);
        console2.log("  RebalanceStrategy:", address(rebalanceStrategy));
    }

    function _deployVault() internal {
        console2.log("\n[5/5] Deploying PNGYVault...");
        vault = new PNGYVault(IERC20(networkConfig.usdt), admin);
        console2.log("  PNGYVault:", address(vault));
    }

    function _configureVault() internal {
        console2.log("\n[Config] Configuring PNGYVault...");

        // Set dependencies
        vault.setAssetRegistry(address(assetRegistry));
        vault.setOracleAdapter(address(oracleAdapter));
        vault.setSwapHelper(address(swapHelper));

        // Set circuit breaker threshold (MIN_DEPOSIT and MAX_WITHDRAWAL are constants)
        vault.setCircuitBreakerThreshold(protocolConfig.circuitBreakerThreshold);

        console2.log("  Vault configured with all dependencies");
    }

    // =============================================================================
    // Logging
    // =============================================================================

    function _logDeployment() internal view {
        console2.log("\n========================================");
        console2.log("DEPLOYMENT COMPLETE - BSC TESTNET");
        console2.log("========================================");
        console2.log("\nNetwork Configuration:");
        console2.log("  USDT:", networkConfig.usdt);
        console2.log("  PancakeSwap Router:", networkConfig.pancakeRouter);
        console2.log("  Chainlink BNB/USD:", networkConfig.chainlinkBNBUSD);
        console2.log("\nProtocol Contracts:");
        console2.log("  AssetRegistry:", address(assetRegistry));
        console2.log("  OracleAdapter:", address(oracleAdapter));
        console2.log("  SwapHelper:", address(swapHelper));
        console2.log("  RebalanceStrategy:", address(rebalanceStrategy));
        console2.log("  PNGYVault:", address(vault));
        console2.log("\nAdmin:", admin);
        console2.log("\nProtocol Parameters (from PNGYVault constants):");
        console2.log("  Min Deposit: 500 USDT (constant)");
        console2.log("  Max Withdraw: 100,000 USDT (constant)");
        console2.log("  Circuit Breaker:", protocolConfig.circuitBreakerThreshold, "bps");
        console2.log("========================================");
        console2.log("\nNext Steps:");
        console2.log("1. Verify contracts on BSCScan");
        console2.log("2. Register RWA assets via AssetRegistry");
        console2.log("3. Configure oracle sources via OracleAdapter");
        console2.log("4. Add RWA assets to Vault with target allocations");
        console2.log("5. Transfer admin roles to Gnosis Safe (if needed)");
        console2.log("========================================\n");
    }
}

/// @title AddRWAAssets
/// @notice Script to add RWA assets after initial deployment
/// @dev Run with: RWA_TOKEN=0x... RWA_ORACLE=0x... forge script script/DeployBSCTestnet.s.sol:AddRWAAssets
contract AddRWAAssets is Script {
    function run() external {
        // Load addresses from environment
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address assetRegistryAddress = vm.envAddress("ASSET_REGISTRY_ADDRESS");
        address oracleAdapterAddress = vm.envAddress("ORACLE_ADAPTER_ADDRESS");

        address rwaToken = vm.envAddress("RWA_TOKEN");
        address rwaOracle = vm.envAddress("RWA_ORACLE");
        uint256 targetAllocation = vm.envUint("TARGET_ALLOCATION"); // in basis points
        uint8 assetType = uint8(vm.envUint("ASSET_TYPE")); // 0=Bond, 1=Stock, etc.

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("Adding RWA Asset:");
        console2.log("  Token:", rwaToken);
        console2.log("  Oracle:", rwaOracle);
        console2.log("  Target Allocation:", targetAllocation, "bps");

        vm.startBroadcast(deployerPrivateKey);

        // Register in AssetRegistry
        AssetRegistry registry = AssetRegistry(assetRegistryAddress);
        registry.registerAsset(rwaToken, AssetRegistry.AssetType(assetType), rwaOracle);

        // Configure oracle
        OracleAdapter oracle = OracleAdapter(oracleAdapterAddress);
        oracle.configureOracle(rwaToken, rwaOracle, address(0), 0);

        // Add to Vault
        PNGYVault vault = PNGYVault(vaultAddress);
        vault.addRWAAsset(rwaToken, targetAllocation);

        vm.stopBroadcast();

        console2.log("RWA asset added successfully!");
    }
}
