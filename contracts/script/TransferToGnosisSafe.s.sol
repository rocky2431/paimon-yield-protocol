// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @title TransferToGnosisSafe
/// @notice Script to transfer PNGYVault governance roles to Gnosis Safe
/// @dev Run with: forge script script/TransferToGnosisSafe.s.sol --rpc-url $BSC_RPC --broadcast
contract TransferToGnosisSafe is Script {
    // =============================================================================
    // Role Constants
    // =============================================================================

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // =============================================================================
    // Configuration
    // =============================================================================

    /// @notice The PNGYVault contract address (set via environment variable)
    address public vaultAddress;

    /// @notice The Gnosis Safe address (set via environment variable)
    address public gnosisSafeAddress;

    /// @notice Current deployer/admin address
    address public currentAdmin;

    // =============================================================================
    // Main Entry Point
    // =============================================================================

    function run() external {
        // Load configuration from environment
        vaultAddress = vm.envAddress("VAULT_ADDRESS");
        gnosisSafeAddress = vm.envAddress("GNOSIS_SAFE_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        currentAdmin = vm.addr(deployerPrivateKey);

        console2.log("\n========================================");
        console2.log("GNOSIS SAFE GOVERNANCE TRANSFER");
        console2.log("========================================\n");

        console2.log("Configuration:");
        console2.log("  Vault Address:", vaultAddress);
        console2.log("  Gnosis Safe:", gnosisSafeAddress);
        console2.log("  Current Admin:", currentAdmin);

        // Verify current state
        _verifyPreConditions();

        vm.startBroadcast(deployerPrivateKey);

        // Execute role transfer
        _transferRoles();

        vm.stopBroadcast();

        // Verify final state
        _verifyPostConditions();

        console2.log("\n========================================");
        console2.log("TRANSFER COMPLETE");
        console2.log("========================================\n");
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    function _verifyPreConditions() internal view {
        IAccessControl vault = IAccessControl(vaultAddress);

        console2.log("\nPre-Transfer Verification:");

        // Check current admin has all roles
        bool hasDefaultAdmin = vault.hasRole(DEFAULT_ADMIN_ROLE, currentAdmin);
        bool hasAdmin = vault.hasRole(ADMIN_ROLE, currentAdmin);
        bool hasRebalancer = vault.hasRole(REBALANCER_ROLE, currentAdmin);

        console2.log("  Current admin has DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
        console2.log("  Current admin has ADMIN_ROLE:", hasAdmin);
        console2.log("  Current admin has REBALANCER_ROLE:", hasRebalancer);

        require(hasDefaultAdmin, "Current admin must have DEFAULT_ADMIN_ROLE");
        require(hasAdmin, "Current admin must have ADMIN_ROLE");

        // Check Gnosis Safe doesn't already have roles
        bool safeHasDefaultAdmin = vault.hasRole(DEFAULT_ADMIN_ROLE, gnosisSafeAddress);
        bool safeHasAdmin = vault.hasRole(ADMIN_ROLE, gnosisSafeAddress);

        console2.log("  Gnosis Safe already has DEFAULT_ADMIN_ROLE:", safeHasDefaultAdmin);
        console2.log("  Gnosis Safe already has ADMIN_ROLE:", safeHasAdmin);

        if (safeHasDefaultAdmin && safeHasAdmin) {
            console2.log("\n  WARNING: Gnosis Safe already has roles. Skipping grant...");
        }
    }

    function _transferRoles() internal {
        IAccessControl vault = IAccessControl(vaultAddress);

        console2.log("\nExecuting Role Transfer:");

        // Step 1: Grant all roles to Gnosis Safe
        if (!vault.hasRole(DEFAULT_ADMIN_ROLE, gnosisSafeAddress)) {
            console2.log("  Granting DEFAULT_ADMIN_ROLE to Gnosis Safe...");
            vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafeAddress);
        }

        if (!vault.hasRole(ADMIN_ROLE, gnosisSafeAddress)) {
            console2.log("  Granting ADMIN_ROLE to Gnosis Safe...");
            vault.grantRole(ADMIN_ROLE, gnosisSafeAddress);
        }

        if (!vault.hasRole(REBALANCER_ROLE, gnosisSafeAddress)) {
            console2.log("  Granting REBALANCER_ROLE to Gnosis Safe...");
            vault.grantRole(REBALANCER_ROLE, gnosisSafeAddress);
        }

        console2.log("  All roles granted to Gnosis Safe");

        // Step 2: Optionally revoke roles from current admin
        // NOTE: This is commented out for safety. Uncomment only after verifying Safe works.
        // console2.log("  Revoking ADMIN_ROLE from current admin...");
        // vault.revokeRole(ADMIN_ROLE, currentAdmin);
        // console2.log("  Revoking REBALANCER_ROLE from current admin...");
        // vault.revokeRole(REBALANCER_ROLE, currentAdmin);
        // console2.log("  Revoking DEFAULT_ADMIN_ROLE from current admin...");
        // vault.revokeRole(DEFAULT_ADMIN_ROLE, currentAdmin);

        console2.log("\n  NOTE: Roles NOT revoked from current admin for safety.");
        console2.log("  Run revokeRoles() after verifying Gnosis Safe works correctly.");
    }

    function _verifyPostConditions() internal view {
        IAccessControl vault = IAccessControl(vaultAddress);

        console2.log("\nPost-Transfer Verification:");

        // Verify Gnosis Safe has all roles
        bool safeHasDefaultAdmin = vault.hasRole(DEFAULT_ADMIN_ROLE, gnosisSafeAddress);
        bool safeHasAdmin = vault.hasRole(ADMIN_ROLE, gnosisSafeAddress);
        bool safeHasRebalancer = vault.hasRole(REBALANCER_ROLE, gnosisSafeAddress);

        console2.log("  Gnosis Safe has DEFAULT_ADMIN_ROLE:", safeHasDefaultAdmin);
        console2.log("  Gnosis Safe has ADMIN_ROLE:", safeHasAdmin);
        console2.log("  Gnosis Safe has REBALANCER_ROLE:", safeHasRebalancer);

        require(safeHasDefaultAdmin, "Transfer failed: Safe missing DEFAULT_ADMIN_ROLE");
        require(safeHasAdmin, "Transfer failed: Safe missing ADMIN_ROLE");
        require(safeHasRebalancer, "Transfer failed: Safe missing REBALANCER_ROLE");

        console2.log("\n  All roles successfully transferred to Gnosis Safe!");
    }

    // =============================================================================
    // Separate Script: Revoke Original Admin Roles
    // =============================================================================

    /// @notice Call this AFTER verifying Gnosis Safe works correctly
    /// @dev Run separately: forge script script/TransferToGnosisSafe.s.sol:RevokeOriginalAdmin
    function revokeOriginalAdminRoles() external {
        vaultAddress = vm.envAddress("VAULT_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        currentAdmin = vm.addr(deployerPrivateKey);

        console2.log("\n========================================");
        console2.log("REVOKING ORIGINAL ADMIN ROLES");
        console2.log("========================================\n");

        IAccessControl vault = IAccessControl(vaultAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Revoke in reverse order (keep DEFAULT_ADMIN_ROLE last for safety)
        console2.log("Revoking REBALANCER_ROLE from original admin...");
        vault.revokeRole(REBALANCER_ROLE, currentAdmin);

        console2.log("Revoking ADMIN_ROLE from original admin...");
        vault.revokeRole(ADMIN_ROLE, currentAdmin);

        console2.log("Revoking DEFAULT_ADMIN_ROLE from original admin...");
        vault.revokeRole(DEFAULT_ADMIN_ROLE, currentAdmin);

        vm.stopBroadcast();

        console2.log("\nOriginal admin roles revoked successfully!");
        console2.log("Gnosis Safe is now the sole controller of the vault.");
    }
}

/// @title RevokeOriginalAdmin
/// @notice Separate contract for revoking original admin roles
contract RevokeOriginalAdmin is Script {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    function run() external {
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address currentAdmin = vm.addr(deployerPrivateKey);

        console2.log("\n========================================");
        console2.log("REVOKING ORIGINAL ADMIN ROLES");
        console2.log("========================================\n");

        console2.log("Vault:", vaultAddress);
        console2.log("Admin to revoke:", currentAdmin);

        IAccessControl vault = IAccessControl(vaultAddress);

        vm.startBroadcast(deployerPrivateKey);

        console2.log("\nRevoking roles...");

        if (vault.hasRole(REBALANCER_ROLE, currentAdmin)) {
            vault.revokeRole(REBALANCER_ROLE, currentAdmin);
            console2.log("  REBALANCER_ROLE revoked");
        }

        if (vault.hasRole(ADMIN_ROLE, currentAdmin)) {
            vault.revokeRole(ADMIN_ROLE, currentAdmin);
            console2.log("  ADMIN_ROLE revoked");
        }

        if (vault.hasRole(DEFAULT_ADMIN_ROLE, currentAdmin)) {
            vault.revokeRole(DEFAULT_ADMIN_ROLE, currentAdmin);
            console2.log("  DEFAULT_ADMIN_ROLE revoked");
        }

        vm.stopBroadcast();

        console2.log("\n========================================");
        console2.log("REVOCATION COMPLETE");
        console2.log("========================================\n");
    }
}
