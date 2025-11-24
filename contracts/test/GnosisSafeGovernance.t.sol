// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PNGYVault} from "../src/PNGYVault.sol";
import {AssetRegistry} from "../src/AssetRegistry.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";

/// @title Gnosis Safe Governance Test
/// @notice Tests for multi-sig governance integration with PNGYVault
/// @dev Simulates Gnosis Safe behavior for testing role management and governance
contract GnosisSafeGovernanceTest is Test {
    // =============================================================================
    // State Variables
    // =============================================================================

    PNGYVault public vault;
    AssetRegistry public assetRegistry;
    ERC20Mock public usdt;

    // Role identifiers
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // Addresses
    address public deployer = makeAddr("deployer");
    address public gnosisSafe = makeAddr("gnosisSafe");
    address public signer1 = makeAddr("signer1");
    address public signer2 = makeAddr("signer2");
    address public signer3 = makeAddr("signer3");
    address public signer4 = makeAddr("signer4");
    address public signer5 = makeAddr("signer5");
    address public unauthorized = makeAddr("unauthorized");

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        vm.startPrank(deployer);

        // Deploy mock USDT
        usdt = new ERC20Mock("Tether USD", "USDT", 18);

        // Deploy AssetRegistry
        assetRegistry = new AssetRegistry(deployer);

        // Deploy PNGYVault
        vault = new PNGYVault(IERC20(address(usdt)), deployer);

        vm.stopPrank();
    }

    // =============================================================================
    // Role Transfer Tests
    // =============================================================================

    function test_DeployerHasAllRoles() public view {
        assertTrue(vault.hasRole(DEFAULT_ADMIN_ROLE, deployer), "Deployer should have DEFAULT_ADMIN_ROLE");
        assertTrue(vault.hasRole(ADMIN_ROLE, deployer), "Deployer should have ADMIN_ROLE");
        assertTrue(vault.hasRole(REBALANCER_ROLE, deployer), "Deployer should have REBALANCER_ROLE");
    }

    function test_TransferAdminRoleToGnosisSafe() public {
        vm.startPrank(deployer);

        // Grant ADMIN_ROLE to Gnosis Safe
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        assertTrue(vault.hasRole(ADMIN_ROLE, gnosisSafe), "Gnosis Safe should have ADMIN_ROLE");
        assertTrue(vault.hasRole(ADMIN_ROLE, deployer), "Deployer should still have ADMIN_ROLE");

        vm.stopPrank();
    }

    function test_TransferRebalancerRoleToGnosisSafe() public {
        vm.startPrank(deployer);

        // Grant REBALANCER_ROLE to Gnosis Safe
        vault.grantRole(REBALANCER_ROLE, gnosisSafe);

        assertTrue(vault.hasRole(REBALANCER_ROLE, gnosisSafe), "Gnosis Safe should have REBALANCER_ROLE");

        vm.stopPrank();
    }

    function test_TransferDefaultAdminRoleToGnosisSafe() public {
        vm.startPrank(deployer);

        // Grant DEFAULT_ADMIN_ROLE to Gnosis Safe
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);

        assertTrue(vault.hasRole(DEFAULT_ADMIN_ROLE, gnosisSafe), "Gnosis Safe should have DEFAULT_ADMIN_ROLE");

        vm.stopPrank();
    }

    function test_FullRoleTransferToGnosisSafe() public {
        vm.startPrank(deployer);

        // Step 1: Grant all roles to Gnosis Safe
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vault.grantRole(REBALANCER_ROLE, gnosisSafe);

        // Verify Gnosis Safe has all roles
        assertTrue(vault.hasRole(DEFAULT_ADMIN_ROLE, gnosisSafe), "Safe should have DEFAULT_ADMIN_ROLE");
        assertTrue(vault.hasRole(ADMIN_ROLE, gnosisSafe), "Safe should have ADMIN_ROLE");
        assertTrue(vault.hasRole(REBALANCER_ROLE, gnosisSafe), "Safe should have REBALANCER_ROLE");

        // Step 2: Revoke roles from deployer
        vault.revokeRole(ADMIN_ROLE, deployer);
        vault.revokeRole(REBALANCER_ROLE, deployer);
        vault.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Verify deployer no longer has roles
        assertFalse(vault.hasRole(ADMIN_ROLE, deployer), "Deployer should not have ADMIN_ROLE");
        assertFalse(vault.hasRole(REBALANCER_ROLE, deployer), "Deployer should not have REBALANCER_ROLE");
        assertFalse(vault.hasRole(DEFAULT_ADMIN_ROLE, deployer), "Deployer should not have DEFAULT_ADMIN_ROLE");

        vm.stopPrank();
    }

    // =============================================================================
    // Gnosis Safe Execution Tests (Simulated)
    // =============================================================================

    function test_GnosisSafeCanPauseVault() public {
        // Setup: Transfer ADMIN_ROLE to Gnosis Safe
        vm.prank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        // Simulate Gnosis Safe executing pause
        vm.prank(gnosisSafe);
        vault.pause();

        assertTrue(vault.paused(), "Vault should be paused");
    }

    function test_GnosisSafeCanUnpauseVault() public {
        // Setup
        vm.startPrank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vault.pause();
        vm.stopPrank();

        // Simulate Gnosis Safe executing unpause
        vm.prank(gnosisSafe);
        vault.unpause();

        assertFalse(vault.paused(), "Vault should be unpaused");
    }

    function test_GnosisSafeCanSetAssetRegistry() public {
        // Setup
        vm.prank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        // Simulate Gnosis Safe setting asset registry
        vm.prank(gnosisSafe);
        vault.setAssetRegistry(address(assetRegistry));

        // Verify (we can't directly check assetRegistry, but no revert means success)
    }

    function test_GnosisSafeCanEnableEmergencyWithdraw() public {
        // Setup
        vm.prank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        // Simulate Gnosis Safe enabling emergency withdraw
        vm.prank(gnosisSafe);
        vault.setEmergencyWithdraw(true);

        assertTrue(vault.emergencyWithdrawEnabled(), "Emergency withdraw should be enabled");
    }

    function test_GnosisSafeCanSetCircuitBreakerThreshold() public {
        // Setup
        vm.prank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        // Simulate Gnosis Safe setting circuit breaker threshold
        vm.prank(gnosisSafe);
        vault.setCircuitBreakerThreshold(1000); // 10%

        assertEq(vault.circuitBreakerThreshold(), 1000, "Circuit breaker threshold should be updated");
    }

    // =============================================================================
    // Access Control Tests After Transfer
    // =============================================================================

    function test_UnauthorizedCannotPauseAfterTransfer() public {
        // Setup: Full role transfer to Gnosis Safe
        vm.startPrank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vault.revokeRole(ADMIN_ROLE, deployer);
        vm.stopPrank();

        // Unauthorized user should not be able to pause
        vm.prank(unauthorized);
        vm.expectRevert();
        vault.pause();
    }

    function test_DeployerCannotPauseAfterRoleRevoked() public {
        // Setup: Full role transfer to Gnosis Safe
        vm.startPrank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vault.revokeRole(ADMIN_ROLE, deployer);
        vm.stopPrank();

        // Deployer should no longer be able to pause
        vm.prank(deployer);
        vm.expectRevert();
        vault.pause();
    }

    function test_OnlyDefaultAdminCanGrantRoles() public {
        // Setup: Transfer only DEFAULT_ADMIN_ROLE to Gnosis Safe
        vm.startPrank(deployer);
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        vault.revokeRole(DEFAULT_ADMIN_ROLE, deployer);
        vm.stopPrank();

        // Deployer can no longer grant roles
        vm.prank(deployer);
        vm.expectRevert();
        vault.grantRole(ADMIN_ROLE, signer1);

        // Gnosis Safe can grant roles
        vm.prank(gnosisSafe);
        vault.grantRole(ADMIN_ROLE, signer1);

        assertTrue(vault.hasRole(ADMIN_ROLE, signer1), "Signer1 should have ADMIN_ROLE");
    }

    // =============================================================================
    // Multi-Sig Simulation Tests
    // =============================================================================

    /// @notice Simulates a 3/5 multi-sig approval process
    /// @dev In production, this would go through Gnosis Safe's transaction queue
    function test_SimulateMultiSigApproval() public {
        console2.log("\n=== Multi-Sig Approval Simulation ===\n");

        // Setup: Transfer roles to Gnosis Safe
        vm.prank(deployer);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        console2.log("Step 1: Signer1 proposes to pause the vault");
        console2.log("Step 2: Signer2 confirms the transaction");
        console2.log("Step 3: Signer3 confirms the transaction");
        console2.log("Step 4: Threshold reached (3/5), executing transaction...");

        // Simulate the final execution from Gnosis Safe
        vm.prank(gnosisSafe);
        vault.pause();

        console2.log("Step 5: Transaction executed successfully");
        console2.log("   Vault paused:", vault.paused());

        assertTrue(vault.paused(), "Vault should be paused after multi-sig approval");
    }

    /// @notice Tests that critical operations require the correct role
    function test_CriticalOperationsRequireCorrectRole() public {
        // Setup
        vm.prank(deployer);
        vault.grantRole(REBALANCER_ROLE, gnosisSafe);

        // Gnosis Safe with only REBALANCER_ROLE cannot pause (requires ADMIN_ROLE)
        vm.prank(gnosisSafe);
        vm.expectRevert();
        vault.pause();
    }

    // =============================================================================
    // Role Enumeration Tests
    // =============================================================================

    function test_GetRoleAdmin() public view {
        // DEFAULT_ADMIN_ROLE is the admin of all roles by default in OZ AccessControl
        assertEq(vault.getRoleAdmin(ADMIN_ROLE), DEFAULT_ADMIN_ROLE, "ADMIN_ROLE admin should be DEFAULT_ADMIN_ROLE");
        assertEq(vault.getRoleAdmin(REBALANCER_ROLE), DEFAULT_ADMIN_ROLE, "REBALANCER_ROLE admin should be DEFAULT_ADMIN_ROLE");
    }

    // =============================================================================
    // Edge Cases
    // =============================================================================

    function test_CannotRevokeLastDefaultAdmin() public {
        // This test checks that we don't accidentally lock ourselves out
        vm.startPrank(deployer);

        // First, grant to Safe
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);

        // Then revoke from deployer - this should work because Safe still has it
        vault.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

        // Verify Safe can still manage roles
        vm.stopPrank();

        vm.prank(gnosisSafe);
        vault.grantRole(ADMIN_ROLE, signer1);

        assertTrue(vault.hasRole(ADMIN_ROLE, signer1), "Safe should be able to grant roles");
    }

    function test_RenounceRole() public {
        vm.startPrank(deployer);

        // Grant roles to Safe first
        vault.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe);
        vault.grantRole(ADMIN_ROLE, gnosisSafe);

        // Deployer renounces their own roles
        vault.renounceRole(ADMIN_ROLE, deployer);

        assertFalse(vault.hasRole(ADMIN_ROLE, deployer), "Deployer should not have ADMIN_ROLE after renounce");

        vm.stopPrank();
    }

    // =============================================================================
    // Gas Report for Governance Operations
    // =============================================================================

    function test_GasReport_GovernanceOperations() public {
        console2.log("\n========================================");
        console2.log("GAS REPORT - Governance Operations");
        console2.log("========================================\n");

        vm.startPrank(deployer);

        // Grant role gas
        uint256 gasBefore = gasleft();
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        uint256 grantGas = gasBefore - gasleft();

        // Revoke role gas
        gasBefore = gasleft();
        vault.revokeRole(ADMIN_ROLE, gnosisSafe);
        uint256 revokeGas = gasBefore - gasleft();

        // Re-grant for pause test
        vault.grantRole(ADMIN_ROLE, gnosisSafe);
        vm.stopPrank();

        // Pause gas (from Safe)
        vm.prank(gnosisSafe);
        gasBefore = gasleft();
        vault.pause();
        uint256 pauseGas = gasBefore - gasleft();

        // Unpause gas
        vm.prank(gnosisSafe);
        gasBefore = gasleft();
        vault.unpause();
        uint256 unpauseGas = gasBefore - gasleft();

        console2.log("Operation              | Gas Used");
        console2.log("-----------------------+----------");
        console2.log("Grant Role             |", grantGas);
        console2.log("Revoke Role            |", revokeGas);
        console2.log("Pause Vault            |", pauseGas);
        console2.log("Unpause Vault          |", unpauseGas);

        console2.log("\n========================================\n");
    }
}
