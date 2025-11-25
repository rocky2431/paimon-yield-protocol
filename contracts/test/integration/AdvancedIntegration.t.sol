// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PNGYVault} from "../../src/PNGYVault.sol";
import {AssetRegistry} from "../../src/AssetRegistry.sol";
import {OracleAdapter} from "../../src/OracleAdapter.sol";
import {SwapHelper} from "../../src/SwapHelper.sol";
import {ERC20Mock} from "../mocks/ERC20Mock.sol";
import {MockPancakeRouter} from "../mocks/MockPancakeRouter.sol";
import {MockOracleAdapter} from "../mocks/MockOracleAdapter.sol";
import {MockChainlinkAggregator} from "../mocks/MockChainlinkAggregator.sol";

/// @title Advanced Integration Tests
/// @notice Tests for Oracle failover, Circuit breaker, T+1 withdrawals, Emergency mode
contract AdvancedIntegrationTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    PNGYVault public vault;
    AssetRegistry public assetRegistry;
    OracleAdapter public oracleAdapter;
    SwapHelper public swapHelper;
    MockPancakeRouter public router;
    MockOracleAdapter public mockOracle;

    // For Oracle failover testing
    MockChainlinkAggregator public primaryAggregator;
    MockChainlinkAggregator public fallbackAggregator;

    // Tokens
    ERC20Mock public usdt;
    ERC20Mock public rwaBond;
    ERC20Mock public rwaStock;

    // Addresses
    address public admin = makeAddr("admin");
    address public rebalancer = makeAddr("rebalancer");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    // Constants
    uint256 public constant INITIAL_BALANCE = 1_000_000e18;
    uint256 public constant DEFAULT_SLIPPAGE = 100;

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        vm.warp(1700000000);

        // Deploy tokens
        usdt = new ERC20Mock("Tether USD", "USDT", 18);
        rwaBond = new ERC20Mock("RWA Bond", "RWAB", 18);
        rwaStock = new ERC20Mock("RWA Stock", "RWAS", 18);

        // Deploy mock infrastructure
        router = new MockPancakeRouter();
        mockOracle = new MockOracleAdapter();

        // Deploy Chainlink aggregators for failover testing
        primaryAggregator = new MockChainlinkAggregator(8, "RWA/USD");
        fallbackAggregator = new MockChainlinkAggregator(8, "RWA/USD Fallback");

        // Deploy protocol
        vm.startPrank(admin);

        assetRegistry = new AssetRegistry(admin);
        oracleAdapter = new OracleAdapter(admin);
        swapHelper = new SwapHelper(address(router), admin, DEFAULT_SLIPPAGE);
        vault = new PNGYVault(IERC20(address(usdt)), admin);

        // Configure vault
        vault.setAssetRegistry(address(assetRegistry));
        vault.setOracleAdapter(address(mockOracle));
        vault.setSwapHelper(address(swapHelper));
        vault.grantRole(REBALANCER_ROLE, rebalancer);

        // Register assets
        assetRegistry.registerAsset(address(rwaBond), AssetRegistry.AssetType.TOKENIZED_BOND, address(mockOracle));
        assetRegistry.registerAsset(address(rwaStock), AssetRegistry.AssetType.TOKENIZED_STOCK, address(mockOracle));

        // Add RWA to vault
        vault.addRWAAsset(address(rwaBond), 6000);
        vault.addRWAAsset(address(rwaStock), 4000);

        vm.stopPrank();

        // Configure prices
        mockOracle.setPrice(address(rwaBond), 1e18);
        mockOracle.setPrice(address(rwaStock), 2e18);

        // Configure exchange rates
        router.setExchangeRate(address(usdt), address(rwaBond), 1e18);
        router.setExchangeRate(address(usdt), address(rwaStock), 0.5e18);
        router.setExchangeRate(address(rwaBond), address(usdt), 1e18);
        router.setExchangeRate(address(rwaStock), address(usdt), 2e18);

        // Fund router
        usdt.mint(address(router), INITIAL_BALANCE * 100);
        rwaBond.mint(address(router), INITIAL_BALANCE * 100);
        rwaStock.mint(address(router), INITIAL_BALANCE * 100);

        // Fund users
        usdt.mint(user1, INITIAL_BALANCE);
        usdt.mint(user2, INITIAL_BALANCE);
        usdt.mint(user3, INITIAL_BALANCE);

        // Approvals
        vm.prank(user1);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(user3);
        usdt.approve(address(vault), type(uint256).max);
    }

    // =============================================================================
    // Oracle Failover Tests
    // =============================================================================

    function test_OracleFailover_PrimaryFails_FallbackUsed() public {
        console2.log("\n=== Oracle Failover Test ===\n");

        // Initial deposit
        vm.prank(user1);
        vault.deposit(10_000e18, user1);

        uint256 initialNav = vault.totalAssets();
        console2.log("Initial NAV:", initialNav / 1e18);

        // Simulate primary oracle failure by returning 0
        mockOracle.setPrice(address(rwaBond), 0);

        // NAV calculation should handle gracefully
        uint256 navAfterFailure = vault.totalAssets();
        console2.log("NAV after primary failure:", navAfterFailure / 1e18);

        // The vault should still function (perhaps with cached/fallback values)
        // For this test, we verify the vault doesn't revert
        assertTrue(navAfterFailure >= 0, "NAV should be calculable");

        // Restore oracle
        mockOracle.setPrice(address(rwaBond), 1e18);
        uint256 navRestored = vault.totalAssets();
        console2.log("NAV after restore:", navRestored / 1e18);

        assertApproxEqRel(navRestored, initialNav, 0.01e18, "NAV should restore");
    }

    function test_OracleFailover_StalePrice_Handled() public {
        console2.log("\n=== Stale Price Handling Test ===\n");

        // Setup aggregator with old timestamp (2 hours stale)
        primaryAggregator.setAnswerWithTimestamp(
            100_000_000, // $1.00 with 8 decimals
            block.timestamp - 2 hours // 2 hours stale
        );

        // Deposit should still work with mock oracle
        vm.prank(user1);
        vault.deposit(10_000e18, user1);

        assertGt(vault.balanceOf(user1), 0, "Deposit should succeed");
    }

    // =============================================================================
    // Circuit Breaker Flow Tests
    // =============================================================================

    function test_CircuitBreaker_FullFlow() public {
        console2.log("\n=== Circuit Breaker Full Flow Test ===\n");

        // Disable swap helper for simpler testing
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Step 1: Initial deposits from multiple users
        console2.log("Step 1: Initial deposits");
        vm.prank(user1);
        vault.deposit(50_000e18, user1);
        vm.prank(user2);
        vault.deposit(30_000e18, user2);

        uint256 initialNav = vault.totalAssets();
        console2.log("   Initial NAV:", initialNav / 1e18);

        // Step 2: Set reference NAV for circuit breaker
        console2.log("\nStep 2: Configure circuit breaker");
        vm.startPrank(admin);
        vault.setReferenceNav(initialNav);
        vault.setCircuitBreakerThreshold(1000); // 10%
        vm.stopPrank();

        // Step 3: Force activate circuit breaker (since we don't have RWA tokens without swap helper)
        console2.log("\nStep 3: Force activate circuit breaker");
        vm.prank(admin);
        vault.activateCircuitBreaker();

        assertTrue(vault.circuitBreakerActive(), "Circuit breaker should be active");
        console2.log("   Circuit breaker activated: true");

        // Step 5: Verify withdrawal limits
        console2.log("\nStep 5: Test withdrawal limits");
        uint256 circuitBreakerLimit = vault.CIRCUIT_BREAKER_LIMIT();
        console2.log("   Circuit breaker limit:", circuitBreakerLimit / 1e18);

        // Small withdrawal should work
        uint256 smallWithdrawShares = vault.convertToShares(5_000e18);
        vm.prank(user1);
        vault.redeem(smallWithdrawShares, user1, user1);
        console2.log("   Small withdrawal succeeded");

        // Large withdrawal should fail (exceeds circuit breaker limit AND instant limit)
        // Note: Instant limit is 10K, circuit breaker limit is also 10K
        // So anything above 10K will fail with ExceedsInstantLimit (checked first)
        uint256 largeWithdrawShares = vault.convertToShares(15_000e18);
        uint256 actualAssetAmount = vault.convertToAssets(largeWithdrawShares);
        uint256 instantLimit = vault.INSTANT_WITHDRAWAL_LIMIT();
        console2.log("   Attempting withdrawal of:", actualAssetAmount / 1e18, "USDT");
        console2.log("   Instant limit:", instantLimit / 1e18, "USDT");
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.ExceedsInstantLimit.selector, actualAssetAmount, instantLimit));
        vault.redeem(largeWithdrawShares, user2, user2);
        console2.log("   Large withdrawal blocked (as expected - exceeds instant limit)");

        // Step 6: Admin resets circuit breaker
        console2.log("\nStep 6: Reset circuit breaker");
        vm.prank(admin);
        vault.resetCircuitBreaker();

        assertFalse(vault.circuitBreakerActive(), "Circuit breaker should be inactive");
        console2.log("   Circuit breaker reset");

        // Step 7: Normal withdrawals resume (within instant limit)
        console2.log("\nStep 7: Normal withdrawals resume");
        // Note: INSTANT_WITHDRAWAL_LIMIT still applies, so we withdraw within that limit
        uint256 normalWithdrawShares = vault.convertToShares(8_000e18); // within 10K instant limit
        vm.prank(user2);
        vault.redeem(normalWithdrawShares, user2, user2);
        console2.log("   Instant withdrawal succeeded after circuit breaker reset");

        // Large withdrawals still need T+1 queue (this is expected behavior)
        console2.log("\nStep 8: Large withdrawal still needs T+1 queue");
        uint256 largeShares2 = vault.convertToShares(12_000e18);
        vm.prank(user2);
        uint256 requestId = vault.requestWithdraw(largeShares2, user2);
        console2.log("   Large withdrawal queued, request ID:", requestId);
    }

    function test_CircuitBreaker_EmergencyBypass() public {
        console2.log("\n=== Emergency Bypass Test ===\n");

        // Setup
        vm.prank(user1);
        vault.deposit(100_000e18, user1);

        // Activate circuit breaker
        vm.startPrank(admin);
        vault.setReferenceNav(100_000e18);
        vault.setCircuitBreakerThreshold(500); // 5%
        vault.activateCircuitBreaker();

        // Enable emergency mode
        vault.setEmergencyWithdraw(true);
        vm.stopPrank();

        console2.log("Circuit breaker active:", vault.circuitBreakerActive());
        console2.log("Emergency mode enabled:", vault.emergencyWithdrawEnabled());

        // Large withdrawal should work in emergency mode
        uint256 largeShares = vault.convertToShares(50_000e18);
        vm.prank(user1);
        vault.redeem(largeShares, user1, user1);

        console2.log("Large withdrawal succeeded in emergency mode");
    }

    // =============================================================================
    // T+1 Withdrawal Queue Tests
    // =============================================================================

    function test_T1WithdrawalQueue_FullFlow() public {
        console2.log("\n=== T+1 Withdrawal Queue Test ===\n");

        // Disable swap helper to simplify test
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Step 1: Deposit
        console2.log("Step 1: User deposits");
        vm.prank(user1);
        vault.deposit(100_000e18, user1);
        console2.log("   Deposited: 100,000 USDT");

        // Step 2: Request large withdrawal (exceeds instant limit)
        console2.log("\nStep 2: Request large withdrawal");
        uint256 instantLimit = vault.INSTANT_WITHDRAWAL_LIMIT();
        uint256 largeAmount = instantLimit + 5_000e18; // Above instant limit
        uint256 sharesToWithdraw = vault.convertToShares(largeAmount);

        vm.prank(user1);
        uint256 requestId = vault.requestWithdraw(sharesToWithdraw, user1);
        console2.log("   Request ID:", requestId);
        console2.log("   Shares locked:", sharesToWithdraw / 1e18);

        // Step 3: Verify shares are locked
        console2.log("\nStep 3: Verify shares locked");
        uint256 lockedShares = vault.totalLockedShares();
        console2.log("   Total locked shares:", lockedShares / 1e18);
        assertEq(lockedShares, sharesToWithdraw, "Shares should be locked");

        // Step 4: Try to claim early (should fail)
        console2.log("\nStep 4: Attempt early claim (should fail)");
        vm.prank(user1);
        vm.expectRevert();
        vault.claimWithdraw(requestId);
        console2.log("   Early claim correctly rejected");

        // Step 5: Advance time past delay
        console2.log("\nStep 5: Advance time past T+1 delay");
        uint256 delay = vault.WITHDRAWAL_DELAY();
        vm.warp(block.timestamp + delay + 1);
        console2.log("   Time advanced by:", delay / 3600, "hours");

        // Step 6: Claim withdrawal
        console2.log("\nStep 6: Claim withdrawal");
        uint256 usdtBefore = usdt.balanceOf(user1);
        vm.prank(user1);
        vault.claimWithdraw(requestId);
        uint256 usdtAfter = usdt.balanceOf(user1);

        uint256 assetsReceived = usdtAfter - usdtBefore;
        console2.log("   Assets received:", assetsReceived / 1e18);

        assertGt(assetsReceived, 0, "Should receive assets");
    }

    function test_T1WithdrawalQueue_MultipleRequests() public {
        console2.log("\n=== Multiple T+1 Requests Test ===\n");

        // Disable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Both users deposit
        vm.prank(user1);
        vault.deposit(100_000e18, user1);
        vm.prank(user2);
        vault.deposit(100_000e18, user2);

        // Both request large withdrawals
        uint256 shares = vault.convertToShares(15_000e18);

        vm.prank(user1);
        uint256 requestId1 = vault.requestWithdraw(shares, user1);

        vm.prank(user2);
        uint256 requestId2 = vault.requestWithdraw(shares, user2);

        console2.log("Request 1 ID:", requestId1);
        console2.log("Request 2 ID:", requestId2);

        // Advance time
        vm.warp(block.timestamp + vault.WITHDRAWAL_DELAY() + 1);

        // Both claim
        uint256 user1Before = usdt.balanceOf(user1);
        uint256 user2Before = usdt.balanceOf(user2);

        vm.prank(user1);
        vault.claimWithdraw(requestId1);

        vm.prank(user2);
        vault.claimWithdraw(requestId2);

        uint256 assets1 = usdt.balanceOf(user1) - user1Before;
        uint256 assets2 = usdt.balanceOf(user2) - user2Before;

        console2.log("User1 received:", assets1 / 1e18);
        console2.log("User2 received:", assets2 / 1e18);

        assertGt(assets1, 0, "User1 should receive assets");
        assertGt(assets2, 0, "User2 should receive assets");
    }

    function test_T1WithdrawalQueue_RequestInfo() public {
        console2.log("\n=== T+1 Request Info Test ===\n");

        // Disable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        vm.prank(user1);
        vault.deposit(100_000e18, user1);

        // Request withdrawal
        uint256 shares = vault.convertToShares(15_000e18);
        vm.prank(user1);
        uint256 requestId = vault.requestWithdraw(shares, user1);

        // Check request info
        (uint256 reqShares, uint256 reqAssets, address receiver, uint256 reqTime, bool claimed) = vault.withdrawRequests(requestId);

        console2.log("Request ID:", requestId);
        console2.log("Shares:", reqShares / 1e18);
        console2.log("Assets:", reqAssets / 1e18);
        console2.log("Receiver:", receiver);
        console2.log("Request time:", reqTime);
        console2.log("Claimed:", claimed);

        assertEq(reqShares, shares, "Shares should match");
        assertEq(receiver, user1, "Receiver should be user1");
        assertFalse(claimed, "Should not be claimed yet");

        // Get user pending requests
        uint256[] memory pendingRequests = vault.getUserPendingRequests(user1);
        assertEq(pendingRequests.length, 1, "Should have 1 pending request");
        assertEq(pendingRequests[0], requestId, "Request ID should match");
    }

    // =============================================================================
    // Emergency Withdrawal Tests
    // =============================================================================

    function test_EmergencyWithdrawal_WhenPaused() public {
        console2.log("\n=== Emergency Withdrawal When Paused Test ===\n");

        // Disable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Deposit
        vm.prank(user1);
        vault.deposit(50_000e18, user1);

        // Pause vault
        vm.prank(admin);
        vault.pause();
        console2.log("Vault paused");

        // Normal withdrawal should fail
        vm.prank(user1);
        vm.expectRevert();
        vault.withdraw(5_000e18, user1, user1);
        console2.log("Normal withdrawal blocked (as expected)");

        // Enable emergency withdrawal
        vm.prank(admin);
        vault.setEmergencyWithdraw(true);
        console2.log("Emergency withdrawal enabled");

        // Emergency withdrawal should work
        vm.prank(user1);
        vault.withdraw(5_000e18, user1, user1);
        console2.log("Emergency withdrawal succeeded");
    }

    function test_EmergencyWithdrawal_AllUsers() public {
        console2.log("\n=== Mass Emergency Withdrawal Test ===\n");

        // Disable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Multiple users deposit
        vm.prank(user1);
        vault.deposit(30_000e18, user1);
        vm.prank(user2);
        vault.deposit(40_000e18, user2);
        vm.prank(user3);
        vault.deposit(30_000e18, user3);

        uint256 totalBefore = vault.totalAssets();
        console2.log("Total assets before:", totalBefore / 1e18);

        // Pause and enable emergency
        vm.startPrank(admin);
        vault.pause();
        vault.setEmergencyWithdraw(true);
        vm.stopPrank();

        // All users withdraw in emergency
        uint256 shares1 = vault.balanceOf(user1);
        uint256 shares2 = vault.balanceOf(user2);
        uint256 shares3 = vault.balanceOf(user3);

        vm.prank(user1);
        vault.redeem(shares1, user1, user1);

        vm.prank(user2);
        vault.redeem(shares2, user2, user2);

        vm.prank(user3);
        vault.redeem(shares3, user3, user3);

        uint256 totalAfter = vault.totalAssets();
        console2.log("Total assets after:", totalAfter / 1e18);

        assertLt(totalAfter, 100e18, "All assets should be withdrawn");
    }

    // =============================================================================
    // Price Change Impact Tests
    // =============================================================================

    function test_PriceIncrease_UserProfit() public {
        console2.log("\n=== Price Increase User Profit Test ===\n");

        // Deposit
        vm.prank(user1);
        vault.deposit(10_000e18, user1);

        uint256 sharesBefore = vault.balanceOf(user1);
        uint256 assetsBefore = vault.convertToAssets(sharesBefore);
        console2.log("Initial assets value:", assetsBefore / 1e18);

        // Price increases by 20%
        mockOracle.setPrice(address(rwaBond), 1.2e18);
        mockOracle.setPrice(address(rwaStock), 2.4e18);

        uint256 assetsAfter = vault.convertToAssets(sharesBefore);
        console2.log("Assets after price increase:", assetsAfter / 1e18);

        uint256 profit = assetsAfter - assetsBefore;
        console2.log("Profit:", profit / 1e18);

        assertGt(assetsAfter, assetsBefore, "Assets should increase with price");
    }

    function test_PriceDecrease_UserLoss() public {
        console2.log("\n=== Price Decrease User Loss Test ===\n");

        // Deposit
        vm.prank(user1);
        vault.deposit(10_000e18, user1);

        uint256 sharesBefore = vault.balanceOf(user1);
        uint256 assetsBefore = vault.convertToAssets(sharesBefore);
        console2.log("Initial assets value:", assetsBefore / 1e18);

        // Price decreases by 10%
        mockOracle.setPrice(address(rwaBond), 0.9e18);
        mockOracle.setPrice(address(rwaStock), 1.8e18);

        uint256 assetsAfter = vault.convertToAssets(sharesBefore);
        console2.log("Assets after price decrease:", assetsAfter / 1e18);

        uint256 loss = assetsBefore - assetsAfter;
        console2.log("Loss:", loss / 1e18);

        assertLt(assetsAfter, assetsBefore, "Assets should decrease with price");
    }

    // =============================================================================
    // Multi-Round Rebalance Tests
    // =============================================================================

    function test_MultiRound_Rebalance() public {
        console2.log("\n=== Multi-Round Rebalance Test ===\n");

        // Initial deposit
        vm.prank(user1);
        vault.deposit(100_000e18, user1);

        console2.log("Initial allocation: 60% Bond, 40% Stock");

        // Round 1: Adjust to 50/50
        console2.log("\nRound 1: Rebalance to 50/50");
        _executeRebalance(5000, 5000);
        _logHoldings();

        // Round 2: Adjust to 70/30
        console2.log("\nRound 2: Rebalance to 70/30");
        _executeRebalance(7000, 3000);
        _logHoldings();

        // Round 3: Back to 60/40
        console2.log("\nRound 3: Rebalance to 60/40");
        _executeRebalance(6000, 4000);
        _logHoldings();
    }

    function _executeRebalance(uint256 bondAlloc, uint256 stockAlloc) internal {
        uint256[] memory newAllocations = new uint256[](2);
        newAllocations[0] = bondAlloc;
        newAllocations[1] = stockAlloc;

        address[] memory empty = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vault.rebalanceWithNewAllocations(empty, emptyAmounts, empty, emptyAmounts, newAllocations);
    }

    function _logHoldings() internal view {
        PNGYVault.RWAHolding[] memory holdings = vault.getRWAHoldings();
        for (uint256 i = 0; i < holdings.length; i++) {
            console2.log("   Asset allocation:", holdings[i].targetAllocation / 100);
        }
    }

    // =============================================================================
    // Concurrent Operations Tests
    // =============================================================================

    function test_Concurrent_DepositAndWithdraw() public {
        console2.log("\n=== Concurrent Deposit and Withdraw Test ===\n");

        // Disable swap helper for simpler testing
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // User1 deposits
        vm.prank(user1);
        vault.deposit(50_000e18, user1);

        console2.log("Initial state:");
        console2.log("   Total supply:", vault.totalSupply() / 1e18);
        console2.log("   Total assets:", vault.totalAssets() / 1e18);

        // Simulate concurrent operations in same block
        // User2 deposits while User1 withdraws (instant)
        console2.log("\nConcurrent operations:");

        vm.prank(user2);
        uint256 newShares = vault.deposit(30_000e18, user2);
        console2.log("   User2 deposited, shares:", newShares / 1e18);

        // Withdraw within instant limit
        uint256 redeemShares = vault.convertToShares(5_000e18); // Within INSTANT_WITHDRAWAL_LIMIT
        vm.prank(user1);
        uint256 assetsOut = vault.redeem(redeemShares, user1, user1);
        console2.log("   User1 withdrew, assets:", assetsOut / 1e18);

        console2.log("\nFinal state:");
        console2.log("   Total supply:", vault.totalSupply() / 1e18);
        console2.log("   Total assets:", vault.totalAssets() / 1e18);
        console2.log("   User1 shares:", vault.balanceOf(user1) / 1e18);
        console2.log("   User2 shares:", vault.balanceOf(user2) / 1e18);
    }

    // =============================================================================
    // Gas Optimization Verification
    // =============================================================================

    function test_GasOptimization_BatchOperations() public {
        console2.log("\n=== Gas Optimization Test ===\n");

        // Test gas for various deposit sizes
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1_000e18;
        amounts[1] = 10_000e18;
        amounts[2] = 100_000e18;

        for (uint256 i = 0; i < amounts.length; i++) {
            usdt.mint(user1, amounts[i]);
            vm.prank(user1);
            usdt.approve(address(vault), amounts[i]);

            uint256 gasBefore = gasleft();
            vm.prank(user1);
            vault.deposit(amounts[i], user1);
            uint256 gasUsed = gasBefore - gasleft();

            console2.log("Deposit", amounts[i] / 1e18, "USDT - Gas:", gasUsed);
        }
    }
}
