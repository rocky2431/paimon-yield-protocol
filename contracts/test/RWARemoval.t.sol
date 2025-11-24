// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PNGYVault} from "../src/PNGYVault.sol";
import {SwapHelper} from "../src/SwapHelper.sol";
import {AssetRegistry} from "../src/AssetRegistry.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";
import {MockPancakeRouter} from "./mocks/MockPancakeRouter.sol";
import {MockOracleAdapter} from "./mocks/MockOracleAdapter.sol";

/// @title RWA Asset Removal Tests
/// @notice Tests for markAssetForRemoval and removeRWAAssetWithLiquidation
contract RWARemovalTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    PNGYVault public vault;
    SwapHelper public swapHelper;
    AssetRegistry public registry;
    MockPancakeRouter public router;
    MockOracleAdapter public oracle;

    ERC20Mock public usdt;
    ERC20Mock public rwaToken1;
    ERC20Mock public rwaToken2;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");

    uint256 public constant INITIAL_BALANCE = 1_000_000e18;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Deploy mock tokens
        usdt = new ERC20Mock("USDT", "USDT", 18);
        rwaToken1 = new ERC20Mock("RWA Token 1", "RWA1", 18);
        rwaToken2 = new ERC20Mock("RWA Token 2", "RWA2", 18);

        // Deploy mock router
        router = new MockPancakeRouter();

        // Deploy SwapHelper
        vm.prank(admin);
        swapHelper = new SwapHelper(address(router), admin, 100);

        // Deploy AssetRegistry
        vm.prank(admin);
        registry = new AssetRegistry(admin);

        // Deploy Oracle
        oracle = new MockOracleAdapter();

        // Deploy PNGYVault
        vm.prank(admin);
        vault = new PNGYVault(IERC20(address(usdt)), admin);

        // Configure vault
        vm.startPrank(admin);
        vault.setAssetRegistry(address(registry));
        vault.setOracleAdapter(address(oracle));
        vault.setSwapHelper(address(swapHelper));

        // Register RWA tokens
        registry.registerAsset(
            address(rwaToken1),
            AssetRegistry.AssetType.TOKENIZED_BOND,
            address(oracle)
        );
        registry.registerAsset(
            address(rwaToken2),
            AssetRegistry.AssetType.TOKENIZED_STOCK,
            address(oracle)
        );

        // Add RWA assets to vault
        vault.addRWAAsset(address(rwaToken1), 5000);
        vault.addRWAAsset(address(rwaToken2), 5000);

        // Set oracle prices
        oracle.setPrice(address(rwaToken1), 1e18);
        oracle.setPrice(address(rwaToken2), 1e18);
        vm.stopPrank();

        // Setup exchange rates
        router.setExchangeRate(address(usdt), address(rwaToken1), 1e18);
        router.setExchangeRate(address(usdt), address(rwaToken2), 1e18);
        router.setExchangeRate(address(rwaToken1), address(usdt), 1e18);
        router.setExchangeRate(address(rwaToken2), address(usdt), 1e18);

        // Fund router
        rwaToken1.mint(address(router), INITIAL_BALANCE * 10);
        rwaToken2.mint(address(router), INITIAL_BALANCE * 10);
        usdt.mint(address(router), INITIAL_BALANCE * 10);

        // Fund user
        usdt.mint(user, INITIAL_BALANCE);

        // User approves vault
        vm.prank(user);
        usdt.approve(address(vault), type(uint256).max);
    }

    // =============================================================================
    // AssetRegistry.markAssetForRemoval Tests
    // =============================================================================

    function test_MarkAssetForRemoval_Success() public {
        vm.prank(admin);
        registry.markAssetForRemoval(address(rwaToken1));

        assertTrue(registry.isMarkedForRemoval(address(rwaToken1)));
        assertFalse(registry.isActive(address(rwaToken1)));
    }

    function test_MarkAssetForRemoval_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit AssetRegistry.AssetMarkedForRemoval(address(rwaToken1));
        registry.markAssetForRemoval(address(rwaToken1));
    }

    function test_MarkAssetForRemoval_DeactivatesAsset() public {
        assertTrue(registry.isActive(address(rwaToken1)));

        vm.prank(admin);
        registry.markAssetForRemoval(address(rwaToken1));

        assertFalse(registry.isActive(address(rwaToken1)));
    }

    function test_MarkAssetForRemoval_RevertIf_NotRegistered() public {
        address unregistered = makeAddr("unregistered");

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetNotFound.selector, unregistered));
        registry.markAssetForRemoval(unregistered);
    }

    function test_MarkAssetForRemoval_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        registry.markAssetForRemoval(address(rwaToken1));
    }

    function test_UnmarkAssetForRemoval_Success() public {
        vm.startPrank(admin);
        registry.markAssetForRemoval(address(rwaToken1));
        assertTrue(registry.isMarkedForRemoval(address(rwaToken1)));

        registry.unmarkAssetForRemoval(address(rwaToken1));
        assertFalse(registry.isMarkedForRemoval(address(rwaToken1)));
        vm.stopPrank();
    }

    function test_UnmarkAssetForRemoval_EmitsEvent() public {
        vm.startPrank(admin);
        registry.markAssetForRemoval(address(rwaToken1));

        vm.expectEmit(true, false, false, false);
        emit AssetRegistry.AssetUnmarkedForRemoval(address(rwaToken1));
        registry.unmarkAssetForRemoval(address(rwaToken1));
        vm.stopPrank();
    }

    // =============================================================================
    // PNGYVault.removeRWAAssetWithLiquidation Tests
    // =============================================================================

    function test_RemoveRWAAssetWithLiquidation_Success() public {
        // First deposit to get some RWA tokens
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 rwa1BalanceBefore = rwaToken1.balanceOf(address(vault));
        assertGt(rwa1BalanceBefore, 0, "Should have RWA tokens");

        // Liquidate and remove
        vm.prank(admin);
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        // Verify liquidation
        assertGt(usdtReceived, 0, "Should receive USDT from liquidation");
        assertEq(rwaToken1.balanceOf(address(vault)), 0, "Should have no RWA1 tokens");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "Should be removed from holdings");
    }

    function test_RemoveRWAAssetWithLiquidation_EmitsEvents() public {
        // First deposit
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 rwa1Balance = rwaToken1.balanceOf(address(vault));

        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit PNGYVault.RWAAssetLiquidated(address(rwaToken1), rwa1Balance, rwa1Balance);
        vault.removeRWAAssetWithLiquidation(address(rwaToken1));
    }

    function test_RemoveRWAAssetWithLiquidation_ZeroBalance() public {
        // Remove without any deposits (no tokens to sell)
        vm.prank(admin);
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        assertEq(usdtReceived, 0, "Should receive 0 USDT");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "Should be removed");
    }

    function test_RemoveRWAAssetWithLiquidation_NoSwapHelper() public {
        // Deposit first
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Remove swap helper
        vm.startPrank(admin);
        vault.setSwapHelper(address(0));

        // Should still remove (but no liquidation)
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        assertEq(usdtReceived, 0, "Should receive 0 USDT without swap helper");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "Should be removed");
        // Note: RWA tokens remain in vault but are not tracked
        vm.stopPrank();
    }

    function test_RemoveRWAAssetWithLiquidation_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        vault.removeRWAAssetWithLiquidation(address(rwaToken1));
    }

    function test_RemoveRWAAssetWithLiquidation_RevertIf_NotInHoldings() public {
        address notInHoldings = makeAddr("notInHoldings");

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.RWAAssetNotFound.selector, notInHoldings));
        vault.removeRWAAssetWithLiquidation(notInHoldings);
    }

    function test_RemoveRWAAssetWithLiquidation_UpdatesHoldingCount() public {
        assertEq(vault.rwaHoldingCount(), 2);

        vm.prank(admin);
        vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        assertEq(vault.rwaHoldingCount(), 1);
    }

    // =============================================================================
    // Integration: Full Removal Flow
    // =============================================================================

    function test_FullRemovalFlow() public {
        // 1. User deposits
        uint256 depositAmount = 10000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        // 2. Admin marks asset for removal in registry
        vm.startPrank(admin);
        registry.markAssetForRemoval(address(rwaToken1));
        assertTrue(registry.isMarkedForRemoval(address(rwaToken1)));
        assertFalse(registry.isActive(address(rwaToken1)));

        // 3. Admin liquidates and removes from vault
        uint256 vaultUsdtBefore = usdt.balanceOf(address(vault));
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        // 4. Verify results
        assertGt(usdtReceived, 0);
        assertEq(rwaToken1.balanceOf(address(vault)), 0);
        assertFalse(vault.isRWAHolding(address(rwaToken1)));
        assertGt(usdt.balanceOf(address(vault)), vaultUsdtBefore);

        // 5. Remove from registry
        registry.removeAsset(address(rwaToken1));
        assertFalse(registry.isRegistered(address(rwaToken1)));
        vm.stopPrank();
    }
}
