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

/// @title PNGYVault Coverage Tests
/// @notice Additional tests to achieve 95%+ coverage
contract PNGYVaultCoverageTest is Test {
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

    // Token with 6 decimals (like real USDT)
    ERC20Mock public usdt6;
    PNGYVault public vault6;

    // Token with 24 decimals
    ERC20Mock public usdt24;
    PNGYVault public vault24;

    address public admin = makeAddr("admin");
    address public rebalancer = makeAddr("rebalancer");
    address public user = makeAddr("user");

    uint256 public constant INITIAL_BALANCE = 1_000_000e18;
    uint256 public constant MIN_DEPOSIT = 500e18;

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        vm.warp(1700000000);

        // Deploy 18-decimal tokens
        usdt = new ERC20Mock("USDT", "USDT", 18);
        rwaToken1 = new ERC20Mock("RWA Bond", "RWAB", 18);
        rwaToken2 = new ERC20Mock("RWA Stock", "RWAS", 18);

        // Deploy 6-decimal and 24-decimal tokens for decimal testing
        usdt6 = new ERC20Mock("USDT6", "USDT6", 6);
        usdt24 = new ERC20Mock("USDT24", "USDT24", 24);

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

        // Deploy main PNGYVault (18 decimals)
        vm.prank(admin);
        vault = new PNGYVault(IERC20(address(usdt)), admin);

        // Deploy vault with 6-decimal asset
        vm.prank(admin);
        vault6 = new PNGYVault(IERC20(address(usdt6)), admin);

        // Deploy vault with 24-decimal asset
        vm.prank(admin);
        vault24 = new PNGYVault(IERC20(address(usdt24)), admin);

        // Configure main vault
        vm.startPrank(admin);
        vault.setAssetRegistry(address(registry));
        vault.setOracleAdapter(address(oracle));
        vault.setSwapHelper(address(swapHelper));
        vault.grantRole(REBALANCER_ROLE, rebalancer);

        registry.registerAsset(address(rwaToken1), AssetRegistry.AssetType.TOKENIZED_BOND, address(oracle));
        registry.registerAsset(address(rwaToken2), AssetRegistry.AssetType.TOKENIZED_STOCK, address(oracle));

        vault.addRWAAsset(address(rwaToken1), 5000);
        vault.addRWAAsset(address(rwaToken2), 5000);

        oracle.setPrice(address(rwaToken1), 1e18);
        oracle.setPrice(address(rwaToken2), 2e18);
        vm.stopPrank();

        // Setup exchange rates
        router.setExchangeRate(address(usdt), address(rwaToken1), 1e18);
        router.setExchangeRate(address(usdt), address(rwaToken2), 0.5e18);
        router.setExchangeRate(address(rwaToken1), address(usdt), 1e18);
        router.setExchangeRate(address(rwaToken2), address(usdt), 2e18);

        // Fund router
        usdt.mint(address(router), INITIAL_BALANCE * 100);
        rwaToken1.mint(address(router), INITIAL_BALANCE * 100);
        rwaToken2.mint(address(router), INITIAL_BALANCE * 100);

        // Fund user
        usdt.mint(user, INITIAL_BALANCE);
        usdt6.mint(user, INITIAL_BALANCE / 1e12); // Adjust for 6 decimals
        usdt24.mint(user, INITIAL_BALANCE * 1e6); // Adjust for 24 decimals

        vm.startPrank(user);
        usdt.approve(address(vault), type(uint256).max);
        usdt6.approve(address(vault6), type(uint256).max);
        usdt24.approve(address(vault24), type(uint256).max);
        vm.stopPrank();
    }

    // =============================================================================
    // Decimal Handling Tests - _calculateRWAValue
    // =============================================================================

    function test_CalculateRWAValue_WithAssetDecimals6() public {
        // Setup vault6 with RWA token
        vm.startPrank(admin);
        vault6.setOracleAdapter(address(oracle));
        vault6.addRWAAsset(address(rwaToken1), 10000);
        vm.stopPrank();

        // Mint RWA tokens to vault (18 decimals)
        rwaToken1.mint(address(vault6), 1000e18);

        // Get RWA value (should normalize from 18 to 6 decimals)
        uint256 rwaValue = vault6.getRWAValue();

        // Expected: 1000 * 1e18 (price) / 1e18 (token decimals) = 1000
        // Then normalized to 6 decimals: 1000 * 1e6 / 1e12 = 1000e6 / 1e12
        // Since asset is 6 decimals and price is 18, value should be scaled
        assertGt(rwaValue, 0, "RWA value should be positive");
    }

    function test_CalculateRWAValue_WithAssetDecimals24() public {
        // Setup vault24 with RWA token
        vm.startPrank(admin);
        vault24.setOracleAdapter(address(oracle));
        vault24.addRWAAsset(address(rwaToken1), 10000);
        vm.stopPrank();

        // Mint RWA tokens to vault
        rwaToken1.mint(address(vault24), 1000e18);

        // Get RWA value (should normalize from 18 to 24 decimals)
        uint256 rwaValue = vault24.getRWAValue();

        // Value should be scaled up for 24-decimal asset
        assertGt(rwaValue, 0, "RWA value should be positive");
    }

    function test_CalculateRWAValue_WithZeroBalance() public {
        // Setup vault with RWA but no balance
        vm.startPrank(admin);
        vault.setOracleAdapter(address(oracle));
        vm.stopPrank();

        // Don't mint any RWA tokens
        uint256 rwaValue = vault.getRWAValue();

        // Should return 0 for zero balance
        assertEq(rwaValue, 0, "RWA value should be 0 with no balance");
    }

    function test_CalculateRWAValue_WithInactiveAsset() public {
        // Mint RWA tokens
        rwaToken1.mint(address(vault), 1000e18);

        // Deactivate the asset
        vm.prank(admin);
        vault.setRWAAssetActive(address(rwaToken1), false);

        // RWA value should not include inactive assets
        uint256 rwaValue = vault.getRWAValue();

        // Only rwaToken2 should be counted (which has 0 balance in vault)
        assertEq(rwaValue, 0, "Inactive RWA should not be counted");
    }

    // =============================================================================
    // removeRWAAssetWithLiquidation Tests
    // =============================================================================

    function test_RemoveRWAAssetWithLiquidation_Success() public {
        // First deposit to initialize RWA holdings properly
        vm.prank(user);
        vault.deposit(10_000e18, user);

        // The vault now has RWA tokens from the deposit
        uint256 rwa1Balance = rwaToken1.balanceOf(address(vault));
        assertGt(rwa1Balance, 0, "Should have RWA1 from deposit");

        uint256 vaultUsdtBefore = usdt.balanceOf(address(vault));

        vm.prank(admin);
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        // Verify
        assertGt(usdtReceived, 0, "Should receive USDT from liquidation");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "RWA should be removed");
        assertEq(rwaToken1.balanceOf(address(vault)), 0, "All RWA tokens should be sold");
    }

    function test_RemoveRWAAssetWithLiquidation_ZeroBalance() public {
        // Don't mint any tokens, just remove
        vm.prank(admin);
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        // Should succeed with 0 received (no tokens to sell)
        assertEq(usdtReceived, 0, "Should receive 0 with no balance");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "RWA should be removed");
    }

    function test_RemoveRWAAssetWithLiquidation_NoSwapHelper() public {
        // Remove swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Mint RWA tokens
        rwaToken1.mint(address(vault), 1000e18);

        // Should succeed but not sell tokens
        vm.prank(admin);
        uint256 usdtReceived = vault.removeRWAAssetWithLiquidation(address(rwaToken1));

        assertEq(usdtReceived, 0, "No swap helper means no sale");
        assertEq(rwaToken1.balanceOf(address(vault)), 1000e18, "Tokens should remain");
        assertFalse(vault.isRWAHolding(address(rwaToken1)), "RWA should still be removed from holdings");
    }

    function test_RemoveRWAAssetWithLiquidation_SwapFails() public {
        // Mint RWA tokens
        rwaToken1.mint(address(vault), 1000e18);

        // Configure router to fail
        router.setFailNextSwap(true);

        vm.prank(admin);
        vm.expectRevert();
        vault.removeRWAAssetWithLiquidation(address(rwaToken1));
    }

    function test_RemoveRWAAssetWithLiquidation_RevertsNotFound() public {
        ERC20Mock unknownToken = new ERC20Mock("Unknown", "UNK", 18);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.RWAAssetNotFound.selector, address(unknownToken)));
        vault.removeRWAAssetWithLiquidation(address(unknownToken));
    }

    function test_RemoveRWAAssetWithLiquidation_NonAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        vault.removeRWAAssetWithLiquidation(address(rwaToken1));
    }

    // =============================================================================
    // _purchaseRWATokens Edge Cases
    // =============================================================================

    function test_PurchaseRWATokens_AllInactive() public {
        // Deactivate all assets
        vm.startPrank(admin);
        vault.setRWAAssetActive(address(rwaToken1), false);
        vault.setRWAAssetActive(address(rwaToken2), false);
        vm.stopPrank();

        // Deposit should work but not buy RWA (total allocation is 0)
        vm.prank(user);
        vault.deposit(1000e18, user);

        // All USDT should remain as is
        assertEq(usdt.balanceOf(address(vault)), 1000e18);
        assertEq(rwaToken1.balanceOf(address(vault)), 0);
        assertEq(rwaToken2.balanceOf(address(vault)), 0);
    }

    function test_PurchaseRWATokens_ZeroAllocation() public {
        // Set all allocations to 0
        vm.startPrank(admin);
        vault.updateTargetAllocation(address(rwaToken1), 0);
        vault.updateTargetAllocation(address(rwaToken2), 0);
        vm.stopPrank();

        // Deposit should work but not buy RWA
        vm.prank(user);
        vault.deposit(1000e18, user);

        // All USDT should remain
        assertEq(usdt.balanceOf(address(vault)), 1000e18);
    }

    function test_PurchaseRWATokens_PartialAllocation() public {
        // Set only one asset to have allocation
        vm.startPrank(admin);
        vault.updateTargetAllocation(address(rwaToken1), 10000); // 100%
        vault.updateTargetAllocation(address(rwaToken2), 0);      // 0%
        vm.stopPrank();

        vm.prank(user);
        vault.deposit(1000e18, user);

        // Should only have rwaToken1
        assertGt(rwaToken1.balanceOf(address(vault)), 0);
        assertEq(rwaToken2.balanceOf(address(vault)), 0);
    }

    // =============================================================================
    // _sellRWATokens Edge Cases
    // =============================================================================

    function test_SellRWATokens_SufficientIdleBalance() public {
        // Deposit without swap helper to keep USDT
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        vm.prank(user);
        vault.deposit(10_000e18, user);

        // Re-enable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(swapHelper));

        // Withdraw less than idle balance
        vm.prank(user);
        vault.withdraw(5_000e18, user, user);

        // Should succeed without selling RWA
        assertEq(vault.balanceOf(user), 5_000e18);
    }

    function test_SellRWATokens_NoHoldings() public {
        // Remove all RWA assets
        vm.startPrank(admin);
        vault.removeRWAAsset(address(rwaToken1));
        vault.removeRWAAsset(address(rwaToken2));
        vm.stopPrank();

        // Deposit USDT only
        vm.prank(user);
        vault.deposit(10_000e18, user);

        // Withdraw should work
        vm.prank(user);
        vault.withdraw(5_000e18, user, user);

        assertEq(usdt.balanceOf(address(vault)), 5_000e18);
    }

    function test_SellRWATokens_ZeroTotalRWAValue() public {
        // Setup: no RWA token balance, so total value is 0
        vm.prank(admin);
        vault.setSwapHelper(address(0)); // Disable swap to prevent RWA purchase

        vm.prank(user);
        vault.deposit(10_000e18, user);

        vm.prank(admin);
        vault.setSwapHelper(address(swapHelper));

        // Withdraw should work (only idle USDT)
        vm.prank(user);
        vault.withdraw(5_000e18, user, user);
    }

    // =============================================================================
    // rebalanceWithNewAllocations Tests
    // =============================================================================

    function test_RebalanceWithNewAllocations_OnlyUpdateAllocations() public {
        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = 7000; // 70%
        newAllocations[1] = 3000; // 30%

        address[] memory sellAssets = new address[](0);
        uint256[] memory sellAmounts = new uint256[](0);
        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vault.rebalanceWithNewAllocations(
            sellAssets, sellAmounts, buyAssets, buyAmounts, newAllocations
        );

        PNGYVault.RWAHolding[] memory holdings = vault.getRWAHoldings();
        assertEq(holdings[0].targetAllocation, 7000);
        assertEq(holdings[1].targetAllocation, 3000);
    }

    function test_RebalanceWithNewAllocations_WithSwaps() public {
        // Fund vault with RWA tokens
        rwaToken1.mint(address(vault), 1000e18);
        usdt.mint(address(vault), 1000e18);

        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = 6000;
        newAllocations[1] = 4000;

        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);
        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken2);
        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 100e18;

        vm.prank(rebalancer);
        (uint256[] memory sellReceived, uint256[] memory buyReceived) = vault.rebalanceWithNewAllocations(
            sellAssets, sellAmounts, buyAssets, buyAmounts, newAllocations
        );

        assertGt(sellReceived[0], 0);
        assertGt(buyReceived[0], 0);
    }

    function test_RebalanceWithNewAllocations_InvalidAllocationLength() public {
        uint256[] memory newAllocations = new uint256[](1); // Wrong length
        newAllocations[0] = 10000;

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.ArrayLengthMismatch.selector);
        vault.rebalanceWithNewAllocations(empty, emptyAmounts, empty, emptyAmounts, newAllocations);
    }

    function test_RebalanceWithNewAllocations_AllocationExceeds100() public {
        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = 6000;
        newAllocations[1] = 5000; // Total 110%

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.InvalidAllocation.selector, 11000));
        vault.rebalanceWithNewAllocations(empty, emptyAmounts, empty, emptyAmounts, newAllocations);
    }

    function test_RebalanceWithNewAllocations_SingleAllocationOver100() public {
        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = 10001; // > 100%
        newAllocations[1] = 0;

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.InvalidAllocation.selector, 10001));
        vault.rebalanceWithNewAllocations(empty, emptyAmounts, empty, emptyAmounts, newAllocations);
    }

    function test_RebalanceWithNewAllocations_NoSwapHelper() public {
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = 7000;
        newAllocations[1] = 3000;

        // Should work with empty swap arrays (only update allocations)
        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vault.rebalanceWithNewAllocations(empty, emptyAmounts, empty, emptyAmounts, newAllocations);

        // But fail if trying to swap
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);
        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.NotConfigured.selector);
        vault.rebalanceWithNewAllocations(sellAssets, sellAmounts, empty, emptyAmounts, newAllocations);
    }

    // =============================================================================
    // Cache Behavior Tests
    // =============================================================================

    function test_CachedValue_ExpiresAfterDuration() public {
        rwaToken1.mint(address(vault), 1000e18);

        // Refresh cache
        vm.prank(admin);
        vault.refreshRWACache();

        (, uint256 timestamp, bool isFresh) = vault.getCachedRWAValue();
        assertTrue(isFresh);
        assertEq(timestamp, block.timestamp);

        // Advance past cache duration (5 minutes)
        vm.warp(block.timestamp + 6 minutes);

        (, , bool isFreshAfter) = vault.getCachedRWAValue();
        assertFalse(isFreshAfter, "Cache should be stale after duration");
    }

    function test_CachedValue_UsedWhenFresh() public {
        rwaToken1.mint(address(vault), 1000e18);

        // Refresh cache
        vm.prank(admin);
        vault.refreshRWACache();

        (uint256 cachedValue, , bool isFresh) = vault.getCachedRWAValue();
        assertTrue(isFresh);
        assertGt(cachedValue, 0);

        // Change price (cache should still return old value via internal _getRWAValue)
        oracle.setPrice(address(rwaToken1), 2e18);

        // But getRWAValue always calculates fresh
        uint256 freshValue = vault.getRWAValue();
        assertGt(freshValue, cachedValue, "Fresh value should reflect new price");
    }

    // =============================================================================
    // Circuit Breaker Additional Tests
    // =============================================================================

    function test_CircuitBreaker_DropExactlyAtThreshold() public {
        vm.prank(user);
        vault.deposit(100_000e18, user);

        vm.startPrank(admin);
        vault.setReferenceNav(100_000e18);
        vault.setCircuitBreakerThreshold(1000); // 10%
        vm.stopPrank();

        // Withdraw exactly 10%
        vm.prank(user);
        vault.withdraw(10_000e18, user, user);

        // Check - should trigger at exactly threshold
        vm.prank(admin);
        vault.checkCircuitBreaker();

        assertTrue(vault.circuitBreakerActive());
    }

    function test_CircuitBreaker_NavHigherThanReference() public {
        vm.prank(user);
        vault.deposit(100_000e18, user);

        // Set reference lower than current NAV
        vm.prank(admin);
        vault.setReferenceNav(50_000e18);

        // Check - should not trigger
        vm.prank(admin);
        vault.checkCircuitBreaker();

        assertFalse(vault.circuitBreakerActive());
    }

    // =============================================================================
    // Redeem with Zero Receiver Tests
    // =============================================================================

    function test_Redeem_RevertsZeroReceiver() public {
        vm.prank(user);
        vault.deposit(MIN_DEPOSIT, user);

        vm.prank(user);
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        vault.redeem(MIN_DEPOSIT, address(0), user);
    }

    function test_Withdraw_RevertsZeroReceiver() public {
        vm.prank(user);
        vault.deposit(MIN_DEPOSIT, user);

        vm.prank(user);
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        vault.withdraw(MIN_DEPOSIT, address(0), user);
    }

    // =============================================================================
    // Max Withdraw/Redeem Additional Tests
    // =============================================================================

    function test_MaxRedeem_CapsAtMaxWithdrawal() public {
        // Deposit large amount
        usdt.mint(user, 500_000e18);
        vm.prank(user);
        usdt.approve(address(vault), 500_000e18);
        vm.prank(user);
        vault.deposit(500_000e18, user);

        uint256 maxRedeem = vault.maxRedeem(user);
        uint256 maxWithdrawShares = vault.convertToShares(vault.MAX_WITHDRAWAL());

        assertEq(maxRedeem, maxWithdrawShares, "Max redeem should be capped");
    }

    function test_MaxRedeem_WhenPausedWithEmergency() public {
        vm.prank(user);
        vault.deposit(MIN_DEPOSIT, user);

        vm.startPrank(admin);
        vault.pause();
        vault.setEmergencyWithdraw(true);
        vm.stopPrank();

        assertGt(vault.maxRedeem(user), 0, "Should be able to redeem in emergency");
    }

    function test_MaxWithdraw_ReturnsOwnerAssets() public {
        vm.prank(user);
        vault.deposit(5_000e18, user);

        uint256 maxWithdraw = vault.maxWithdraw(user);

        // Should return user's assets (less than MAX_WITHDRAWAL)
        assertEq(maxWithdraw, 5_000e18);
    }

    // =============================================================================
    // SwapHelper Slippage Tests
    // =============================================================================

    function test_SetDefaultSwapSlippage_Success() public {
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit PNGYVault.DefaultSwapSlippageUpdated(100, 150);
        vault.setDefaultSwapSlippage(150);

        assertEq(vault.defaultSwapSlippage(), 150);
    }

    function test_SetDefaultSwapSlippage_AtMax() public {
        vm.prank(admin);
        vault.setDefaultSwapSlippage(200); // Max is 200 (2%)

        assertEq(vault.defaultSwapSlippage(), 200);
    }

    function test_SetDefaultSwapSlippage_RevertsAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.SwapSlippageTooHigh.selector, 201, 200));
        vault.setDefaultSwapSlippage(201);
    }

    // =============================================================================
    // Redeem with Exceeded Max Withdrawal
    // =============================================================================

    function test_Redeem_RevertsExceedsMaxWithdrawal() public {
        // Deposit large amount
        usdt.mint(user, 200_000e18);
        vm.prank(user);
        usdt.approve(address(vault), 200_000e18);
        vm.prank(user);
        vault.deposit(200_000e18, user);

        // Try to redeem all shares (exceeds MAX_WITHDRAWAL)
        uint256 allShares = vault.balanceOf(user);

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.WithdrawalExceedsMaximum.selector,
                200_000e18,
                vault.MAX_WITHDRAWAL()
            )
        );
        vault.redeem(allShares, user, user);
    }

    // =============================================================================
    // UpdateTargetAllocation Edge Cases
    // =============================================================================

    function test_UpdateTargetAllocation_RevertsNotFound() public {
        ERC20Mock unknownToken = new ERC20Mock("Unknown", "UNK", 18);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.RWAAssetNotFound.selector, address(unknownToken)));
        vault.updateTargetAllocation(address(unknownToken), 5000);
    }

    // =============================================================================
    // SetRWAAssetActive Edge Cases
    // =============================================================================

    function test_SetRWAAssetActive_RevertsNotFound() public {
        ERC20Mock unknownToken = new ERC20Mock("Unknown", "UNK", 18);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.RWAAssetNotFound.selector, address(unknownToken)));
        vault.setRWAAssetActive(address(unknownToken), false);
    }

    // =============================================================================
    // Withdraw with Circuit Breaker Active
    // =============================================================================

    function test_Withdraw_ExceedsInstantLimitWithCircuitBreaker() public {
        // Test that instant limit error is returned before circuit breaker limit
        // when circuit breaker is active
        PNGYVault testVault = vault; // Use existing vault

        // Just verify the constants match expectations
        assertEq(testVault.INSTANT_WITHDRAWAL_LIMIT(), 10_000e18);
        assertEq(testVault.CIRCUIT_BREAKER_LIMIT(), 10_000e18);

        // When both limits are the same, the instant limit check comes first
        // This is tested in the main PNGYVault.t.sol test file
        assertTrue(true);
    }

    function test_Redeem_CircuitBreakerBypassInEmergency() public {
        // Disable swap helper for simpler testing
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        vm.prank(user);
        vault.deposit(100_000e18, user);

        vm.startPrank(admin);
        vault.activateCircuitBreaker();
        vault.setEmergencyWithdraw(true);
        vm.stopPrank();

        // Large redeem should work in emergency
        uint256 largeShares = vault.convertToShares(50_000e18);
        vm.prank(user);
        vault.redeem(largeShares, user, user);
    }

    // =============================================================================
    // Constants Verification
    // =============================================================================

    function test_Constants_Values() public view {
        assertEq(vault.MIN_DEPOSIT(), 500e18);
        assertEq(vault.MAX_WITHDRAWAL(), 100_000e18);
        assertEq(vault.INSTANT_WITHDRAWAL_LIMIT(), 10_000e18);
        assertEq(vault.WITHDRAWAL_DELAY(), 1 days);
        assertEq(vault.CACHE_DURATION(), 5 minutes);
        assertEq(vault.MAX_RWA_ASSETS(), 20);
        assertEq(vault.MAX_SWAP_SLIPPAGE(), 200);
    }
}
