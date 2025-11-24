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

/// @title DeployBSCMainnet
/// @notice Production deployment script for BSC Mainnet
/// @dev Run with: forge script script/DeployBSCMainnet.s.sol --rpc-url $BSC_MAINNET_RPC --broadcast --verify
/// IMPORTANT: This script deploys to MAINNET with REAL funds. Use with extreme caution.
contract DeployBSCMainnet is Script {
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
    address public gnosisSafe;
    NetworkConfig.MainnetConfig public networkConfig;
    NetworkConfig.ProtocolConfig public protocolConfig;

    // =============================================================================
    // Safety Checks
    // =============================================================================

    modifier onlyMainnet() {
        require(block.chainid == NetworkConfig.BSC_MAINNET, "Must run on BSC Mainnet (chainId 56)");
        _;
    }

    modifier requireGnosisSafe() {
        gnosisSafe = vm.envAddress("GNOSIS_SAFE_ADDRESS");
        require(gnosisSafe != address(0), "GNOSIS_SAFE_ADDRESS must be set for mainnet");
        require(gnosisSafe.code.length > 0, "Gnosis Safe must be a deployed contract");
        _;
    }

    // =============================================================================
    // Main Entry Point
    // =============================================================================

    function run() external onlyMainnet requireGnosisSafe {
        // Load configuration
        networkConfig = NetworkConfig.getMainnetConfig();
        protocolConfig = NetworkConfig.getProtocolConfig();

        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        admin = vm.addr(deployerPrivateKey);

        console2.log("========================================");
        console2.log("BSC MAINNET DEPLOYMENT");
        console2.log("========================================");
        console2.log("WARNING: Deploying to MAINNET with REAL funds!");
        console2.log("========================================");
        console2.log("Deployer:", admin);
        console2.log("Gnosis Safe:", gnosisSafe);
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
        _transferToGnosisSafe();

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

        // Configure global staleness threshold (2 hours)
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

    function _transferToGnosisSafe() internal {
        console2.log("\n[Governance] Transferring roles to Gnosis Safe...");

        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
        bytes32 REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

        // Grant roles to Gnosis Safe
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vault.grantRole(REBALANCER_ROLE, gnosisSafe);

        assetRegistry.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        assetRegistry.grantRole(ADMIN_ROLE, gnosisSafe);

        oracleAdapter.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        oracleAdapter.grantRole(ADMIN_ROLE, gnosisSafe);

        swapHelper.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        swapHelper.grantRole(ADMIN_ROLE, gnosisSafe);

        rebalanceStrategy.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        rebalanceStrategy.grantRole(ADMIN_ROLE, gnosisSafe);

        console2.log("  All roles granted to Gnosis Safe");
        console2.log("  NOTE: Deployer roles NOT revoked for safety");
        console2.log("  Run RevokeDeployerRoles after verifying Safe works");
    }

    // =============================================================================
    // Logging
    // =============================================================================

    function _logDeployment() internal view {
        console2.log("\n========================================");
        console2.log("DEPLOYMENT COMPLETE - BSC MAINNET");
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
        console2.log("\nGovernance:");
        console2.log("  Gnosis Safe:", gnosisSafe);
        console2.log("  Deployer (backup):", admin);
        console2.log("\nProtocol Parameters (from PNGYVault constants):");
        console2.log("  Min Deposit: 500 USDT (constant)");
        console2.log("  Max Withdraw: 100,000 USDT (constant)");
        console2.log("  Circuit Breaker:", protocolConfig.circuitBreakerThreshold, "bps");
        console2.log("========================================");
        console2.log("\nCRITICAL NEXT STEPS:");
        console2.log("1. Verify ALL contracts on BSCScan");
        console2.log("2. Test Gnosis Safe can execute operations");
        console2.log("3. Register RWA assets via Gnosis Safe");
        console2.log("4. Configure oracle sources via Gnosis Safe");
        console2.log("5. ONLY THEN revoke deployer roles");
        console2.log("========================================\n");
    }
}

/// @title RevokeDeployerRoles
/// @notice Script to revoke deployer roles after Gnosis Safe verification
/// @dev ONLY run this after confirming Gnosis Safe can manage the protocol
contract RevokeDeployerRoles is Script {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    function run() external {
        require(block.chainid == NetworkConfig.BSC_MAINNET, "Must run on BSC Mainnet");

        // Load addresses from environment
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address assetRegistryAddress = vm.envAddress("ASSET_REGISTRY_ADDRESS");
        address oracleAdapterAddress = vm.envAddress("ORACLE_ADAPTER_ADDRESS");
        address swapHelperAddress = vm.envAddress("SWAP_HELPER_ADDRESS");
        address rebalanceStrategyAddress = vm.envAddress("REBALANCE_STRATEGY_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("========================================");
        console2.log("REVOKING DEPLOYER ROLES");
        console2.log("========================================");
        console2.log("WARNING: This is IRREVERSIBLE!");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Revoke from Vault
        PNGYVault vault = PNGYVault(vaultAddress);
        if (vault.hasRole(REBALANCER_ROLE, deployer)) vault.revokeRole(REBALANCER_ROLE, deployer);
        if (vault.hasRole(ADMIN_ROLE, deployer)) vault.revokeRole(ADMIN_ROLE, deployer);
        if (vault.hasRole(DEFAULT_ADMIN_ROLE, deployer)) vault.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Revoke from AssetRegistry
        AssetRegistry registry = AssetRegistry(assetRegistryAddress);
        if (registry.hasRole(ADMIN_ROLE, deployer)) registry.revokeRole(ADMIN_ROLE, deployer);
        if (registry.hasRole(DEFAULT_ADMIN_ROLE, deployer)) registry.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Revoke from OracleAdapter
        OracleAdapter oracle = OracleAdapter(oracleAdapterAddress);
        if (oracle.hasRole(ADMIN_ROLE, deployer)) oracle.revokeRole(ADMIN_ROLE, deployer);
        if (oracle.hasRole(DEFAULT_ADMIN_ROLE, deployer)) oracle.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Revoke from SwapHelper
        SwapHelper swap = SwapHelper(swapHelperAddress);
        if (swap.hasRole(ADMIN_ROLE, deployer)) swap.revokeRole(ADMIN_ROLE, deployer);
        if (swap.hasRole(DEFAULT_ADMIN_ROLE, deployer)) swap.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Revoke from RebalanceStrategy
        RebalanceStrategy strategy = RebalanceStrategy(rebalanceStrategyAddress);
        if (strategy.hasRole(ADMIN_ROLE, deployer)) strategy.revokeRole(ADMIN_ROLE, deployer);
        if (strategy.hasRole(DEFAULT_ADMIN_ROLE, deployer)) strategy.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        vm.stopBroadcast();

        console2.log("\nAll deployer roles revoked!");
        console2.log("Gnosis Safe is now the sole controller.");
        console2.log("========================================\n");
    }
}
