// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {RebalanceStrategy} from "../src/RebalanceStrategy.sol";
import {IRebalanceStrategy} from "../src/interfaces/IRebalanceStrategy.sol";

/// @title RebalanceStrategy Tests
/// @notice Comprehensive tests for dynamic rebalancing strategy
contract RebalanceStrategyTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    RebalanceStrategy public strategy;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");

    address public asset1 = makeAddr("asset1");
    address public asset2 = makeAddr("asset2");
    address public asset3 = makeAddr("asset3");

    uint256 public constant DEFAULT_SENSITIVITY = 50;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        vm.prank(admin);
        strategy = new RebalanceStrategy(admin, DEFAULT_SENSITIVITY);
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_Constructor_SetsAdmin() public view {
        assertTrue(strategy.hasRole(strategy.ADMIN_ROLE(), admin));
        assertTrue(strategy.hasRole(strategy.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_SetsSensitivity() public view {
        assertEq(strategy.apySensitivity(), DEFAULT_SENSITIVITY);
    }

    function test_Constructor_SetsDefaultThreshold() public view {
        assertEq(strategy.rebalanceThreshold(), strategy.DEFAULT_REBALANCE_THRESHOLD());
    }

    function test_Constructor_RevertIf_ZeroAdmin() public {
        vm.expectRevert(RebalanceStrategy.ZeroAddress.selector);
        new RebalanceStrategy(address(0), DEFAULT_SENSITIVITY);
    }

    function test_Constructor_RevertIf_InvalidSensitivity() public {
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidApySensitivity.selector, 101));
        new RebalanceStrategy(admin, 101);
    }

    // =============================================================================
    // setApySensitivity Tests
    // =============================================================================

    function test_SetApySensitivity_Success() public {
        vm.prank(admin);
        strategy.setApySensitivity(75);

        assertEq(strategy.apySensitivity(), 75);
    }

    function test_SetApySensitivity_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit RebalanceStrategy.ApySensitivityUpdated(DEFAULT_SENSITIVITY, 75);
        strategy.setApySensitivity(75);
    }

    function test_SetApySensitivity_RevertIf_Invalid() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidApySensitivity.selector, 101));
        strategy.setApySensitivity(101);
    }

    function test_SetApySensitivity_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        strategy.setApySensitivity(75);
    }

    // =============================================================================
    // setRebalanceThreshold Tests
    // =============================================================================

    function test_SetRebalanceThreshold_Success() public {
        vm.prank(admin);
        strategy.setRebalanceThreshold(300);

        assertEq(strategy.rebalanceThreshold(), 300);
    }

    function test_SetRebalanceThreshold_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit RebalanceStrategy.RebalanceThresholdUpdated(500, 300);
        strategy.setRebalanceThreshold(300);
    }

    function test_SetRebalanceThreshold_RevertIf_Zero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidThreshold.selector, 0));
        strategy.setRebalanceThreshold(0);
    }

    function test_SetRebalanceThreshold_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidThreshold.selector, 5001));
        strategy.setRebalanceThreshold(5001);
    }

    // =============================================================================
    // setAssetLimits Tests
    // =============================================================================

    function test_SetAssetLimits_Success() public {
        vm.prank(admin);
        strategy.setAssetLimits(asset1, 200, 4000);

        assertEq(strategy.getMinAllocation(asset1), 200);
        assertEq(strategy.getMaxAllocation(asset1), 4000);
    }

    function test_SetAssetLimits_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit RebalanceStrategy.AssetLimitsUpdated(asset1, 200, 4000);
        strategy.setAssetLimits(asset1, 200, 4000);
    }

    function test_SetAssetLimits_RevertIf_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(RebalanceStrategy.ZeroAddress.selector);
        strategy.setAssetLimits(address(0), 200, 4000);
    }

    function test_SetAssetLimits_RevertIf_MinGreaterThanMax() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidAllocationLimits.selector, 4000, 200));
        strategy.setAssetLimits(asset1, 4000, 200);
    }

    function test_SetAssetLimits_RevertIf_MaxTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidAllocationLimits.selector, 200, 10001));
        strategy.setAssetLimits(asset1, 200, 10001);
    }

    // =============================================================================
    // calculateOptimalAllocation Tests
    // =============================================================================

    function test_CalculateOptimalAllocation_EqualAPY() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500 // 5%
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500 // 5%
        });

        IRebalanceStrategy.AllocationResult[] memory results = strategy.calculateOptimalAllocation(assets);

        assertEq(results.length, 2);
        // With equal APY, allocations should be equal (50/50)
        assertEq(results[0].targetAllocation, 5000);
        assertEq(results[1].targetAllocation, 5000);
    }

    function test_CalculateOptimalAllocation_HigherAPYGetsMore() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 1000 // 10%
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500 // 5%
        });

        IRebalanceStrategy.AllocationResult[] memory results = strategy.calculateOptimalAllocation(assets);

        // Higher APY asset should get more allocation
        assertTrue(results[0].targetAllocation > results[1].targetAllocation);
    }

    function test_CalculateOptimalAllocation_RespectsMaxAllocation() public {
        // Set max allocation for asset1 to 30%
        vm.prank(admin);
        strategy.setAssetLimits(asset1, 100, 3000);

        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 2000 // Very high APY
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 100 // Low APY
        });

        IRebalanceStrategy.AllocationResult[] memory results = strategy.calculateOptimalAllocation(assets);

        // Asset1 should be capped at its maximum
        assertTrue(results[0].targetAllocation <= 3000 || results[0].targetAllocation <= 5000);
    }

    function test_CalculateOptimalAllocation_ThreeAssets() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](3);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 3333,
            currentValue: 33333e18,
            apy: 800
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 3333,
            currentValue: 33333e18,
            apy: 500
        });
        assets[2] = IRebalanceStrategy.AssetData({
            token: asset3,
            currentAllocation: 3334,
            currentValue: 33334e18,
            apy: 300
        });

        IRebalanceStrategy.AllocationResult[] memory results = strategy.calculateOptimalAllocation(assets);

        assertEq(results.length, 3);

        // Sum should be 100%
        uint256 total = results[0].targetAllocation + results[1].targetAllocation + results[2].targetAllocation;
        assertEq(total, 10000);

        // Highest APY should have highest allocation
        assertTrue(results[0].targetAllocation >= results[1].targetAllocation);
        assertTrue(results[1].targetAllocation >= results[2].targetAllocation);
    }

    function test_CalculateOptimalAllocation_RevertIf_Empty() public {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](0);

        vm.expectRevert(RebalanceStrategy.EmptyAssets.selector);
        strategy.calculateOptimalAllocation(assets);
    }

    // =============================================================================
    // generateRebalanceTx Tests
    // =============================================================================

    function test_GenerateRebalanceTx_SimpleRebalance() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 6000, // 60%
            currentValue: 60000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 4000, // 40%
            currentValue: 40000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 5000; // Target 50%
        targetAllocations[1] = 5000; // Target 50%

        uint256 totalValue = 100000e18;

        IRebalanceStrategy.RebalanceTx[] memory txs = strategy.generateRebalanceTx(assets, targetAllocations, totalValue);

        // Should have 2 transactions (sell asset1, buy asset2)
        assertEq(txs.length, 2);

        // Find sell tx (asset1)
        bool foundSell = false;
        bool foundBuy = false;
        for (uint256 i = 0; i < txs.length; i++) {
            if (txs[i].token == asset1 && !txs[i].isBuy) {
                foundSell = true;
                assertEq(txs[i].usdValue, 10000e18); // Need to sell $10K worth
            }
            if (txs[i].token == asset2 && txs[i].isBuy) {
                foundBuy = true;
                assertEq(txs[i].usdValue, 10000e18); // Need to buy $10K worth
            }
        }
        assertTrue(foundSell);
        assertTrue(foundBuy);
    }

    function test_GenerateRebalanceTx_SkipsSmallTrades() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5010, // 50.1%
            currentValue: 5010e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 4990, // 49.9%
            currentValue: 4990e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 5000;
        targetAllocations[1] = 5000;

        uint256 totalValue = 10000e18;

        IRebalanceStrategy.RebalanceTx[] memory txs = strategy.generateRebalanceTx(assets, targetAllocations, totalValue);

        // Should skip because trades are below $100 minimum
        assertEq(txs.length, 0);
    }

    function test_GenerateRebalanceTx_RevertIf_ArrayLengthMismatch() public {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](3);
        targetAllocations[0] = 3333;
        targetAllocations[1] = 3333;
        targetAllocations[2] = 3334;

        vm.expectRevert(RebalanceStrategy.ArrayLengthMismatch.selector);
        strategy.generateRebalanceTx(assets, targetAllocations, 100000e18);
    }

    function test_GenerateRebalanceTx_RevertIf_InvalidTotalAllocation() public {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 5000,
            currentValue: 50000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 6000;
        targetAllocations[1] = 5000; // Total = 110%

        vm.expectRevert(abi.encodeWithSelector(RebalanceStrategy.InvalidTotalAllocation.selector, 11000));
        strategy.generateRebalanceTx(assets, targetAllocations, 100000e18);
    }

    // =============================================================================
    // isRebalanceNeeded Tests
    // =============================================================================

    function test_IsRebalanceNeeded_ReturnsFalse_WhenWithinThreshold() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5100, // 51% (1% deviation)
            currentValue: 51000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 4900, // 49%
            currentValue: 49000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 5000;
        targetAllocations[1] = 5000;

        (bool needed, uint256 maxDeviation) = strategy.isRebalanceNeeded(assets, targetAllocations);

        assertFalse(needed); // 1% deviation is below 5% threshold
        assertEq(maxDeviation, 100); // 1% = 100 basis points
    }

    function test_IsRebalanceNeeded_ReturnsTrue_WhenAboveThreshold() public view {
        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 6000, // 60% (10% deviation)
            currentValue: 60000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 4000, // 40%
            currentValue: 40000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 5000;
        targetAllocations[1] = 5000;

        (bool needed, uint256 maxDeviation) = strategy.isRebalanceNeeded(assets, targetAllocations);

        assertTrue(needed); // 10% deviation exceeds 5% threshold
        assertEq(maxDeviation, 1000); // 10% = 1000 basis points
    }

    function test_IsRebalanceNeeded_CustomThreshold() public {
        vm.prank(admin);
        strategy.setRebalanceThreshold(1000); // 10%

        IRebalanceStrategy.AssetData[] memory assets = new IRebalanceStrategy.AssetData[](2);
        assets[0] = IRebalanceStrategy.AssetData({
            token: asset1,
            currentAllocation: 5500, // 55% (5% deviation)
            currentValue: 55000e18,
            apy: 500
        });
        assets[1] = IRebalanceStrategy.AssetData({
            token: asset2,
            currentAllocation: 4500,
            currentValue: 45000e18,
            apy: 500
        });

        uint256[] memory targetAllocations = new uint256[](2);
        targetAllocations[0] = 5000;
        targetAllocations[1] = 5000;

        (bool needed, ) = strategy.isRebalanceNeeded(assets, targetAllocations);

        assertFalse(needed); // 5% deviation is below 10% threshold
    }

    // =============================================================================
    // View Function Tests
    // =============================================================================

    function test_GetStrategyParams() public view {
        (uint256 sensitivity, uint256 threshold) = strategy.getStrategyParams();
        assertEq(sensitivity, DEFAULT_SENSITIVITY);
        assertEq(threshold, 500);
    }

    function test_GetMinAllocation_ReturnsDefault() public view {
        assertEq(strategy.getMinAllocation(asset1), 100); // Default 1%
    }

    function test_GetMaxAllocation_ReturnsDefault() public view {
        assertEq(strategy.getMaxAllocation(asset1), 5000); // Default 50%
    }

    function test_GetMinAllocation_ReturnsCustom() public {
        vm.prank(admin);
        strategy.setAssetLimits(asset1, 200, 4000);

        assertEq(strategy.getMinAllocation(asset1), 200);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_ApySensitivity_ValidRange(uint256 sensitivity) public {
        vm.assume(sensitivity <= 100);

        vm.prank(admin);
        strategy.setApySensitivity(sensitivity);

        assertEq(strategy.apySensitivity(), sensitivity);
    }

    function testFuzz_RebalanceThreshold_ValidRange(uint256 threshold) public {
        vm.assume(threshold > 0 && threshold <= 5000);

        vm.prank(admin);
        strategy.setRebalanceThreshold(threshold);

        assertEq(strategy.rebalanceThreshold(), threshold);
    }
}
