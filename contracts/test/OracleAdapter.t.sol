// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {IOracleAdapter} from "../src/interfaces/IOracleAdapter.sol";
import {MockOracleAdapter} from "./mocks/MockOracleAdapter.sol";

/// @title OracleAdapter Tests
/// @notice Comprehensive tests for dual Oracle adapter with failover support
contract OracleAdapterTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    OracleAdapter public adapter;
    MockOracleAdapter public primaryOracle;
    MockOracleAdapter public backupOracle;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public asset1 = makeAddr("asset1");
    address public asset2 = makeAddr("asset2");

    uint256 public constant DEFAULT_PRICE = 1e18; // $1
    uint256 public constant STALENESS_THRESHOLD = 2 hours;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Warp to a reasonable timestamp to avoid underflow in time-based tests
        vm.warp(1700000000); // Nov 2023

        // Deploy mock oracles
        primaryOracle = new MockOracleAdapter();
        backupOracle = new MockOracleAdapter();

        // Deploy OracleAdapter
        vm.prank(admin);
        adapter = new OracleAdapter(admin);

        // Set default prices
        primaryOracle.setPrice(asset1, DEFAULT_PRICE);
        primaryOracle.setPrice(asset2, 2e18);
        backupOracle.setPrice(asset1, DEFAULT_PRICE);
        backupOracle.setPrice(asset2, 2e18);
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_Constructor_SetsAdmin() public view {
        assertTrue(adapter.hasRole(adapter.ADMIN_ROLE(), admin));
        assertTrue(adapter.hasRole(adapter.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_SetsDefaultStalenessThreshold() public view {
        assertEq(adapter.globalStalenessThreshold(), STALENESS_THRESHOLD);
    }

    function test_Constructor_RevertIf_ZeroAdmin() public {
        vm.expectRevert(OracleAdapter.ZeroAddress.selector);
        new OracleAdapter(address(0));
    }

    // =============================================================================
    // configureOracle Tests
    // =============================================================================

    function test_ConfigureOracle_Success() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        assertTrue(adapter.isConfigured(asset1));
        assertEq(adapter.configuredAssetCount(), 1);
    }

    function test_ConfigureOracle_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit OracleAdapter.OracleConfigured(asset1, address(primaryOracle), address(backupOracle), 0);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);
    }

    function test_ConfigureOracle_WithCustomThreshold() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), customThreshold);

        assertEq(adapter.getStalenessThreshold(asset1), customThreshold);
    }

    function test_ConfigureOracle_OnlyPrimary() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(0), 0);

        assertTrue(adapter.isConfigured(asset1));

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.primaryOracle, address(primaryOracle));
        assertEq(config.backupOracle, address(0));
    }

    function test_ConfigureOracle_OnlyBackup() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(0), address(backupOracle), 0);

        assertTrue(adapter.isConfigured(asset1));

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.primaryOracle, address(0));
        assertEq(config.backupOracle, address(backupOracle));
    }

    function test_ConfigureOracle_RevertIf_ZeroAsset() public {
        vm.prank(admin);
        vm.expectRevert(OracleAdapter.ZeroAddress.selector);
        adapter.configureOracle(address(0), address(primaryOracle), address(backupOracle), 0);
    }

    function test_ConfigureOracle_RevertIf_BothOraclesZero() public {
        vm.prank(admin);
        vm.expectRevert(OracleAdapter.ZeroAddress.selector);
        adapter.configureOracle(asset1, address(0), address(0), 0);
    }

    function test_ConfigureOracle_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);
    }

    function test_ConfigureOracle_UpdatesExisting() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);
        assertEq(adapter.configuredAssetCount(), 1);

        // Update configuration
        adapter.configureOracle(asset1, address(backupOracle), address(primaryOracle), 1 hours);
        assertEq(adapter.configuredAssetCount(), 1); // Should not add duplicate

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.primaryOracle, address(backupOracle));
        assertEq(config.backupOracle, address(primaryOracle));
        vm.stopPrank();
    }

    // =============================================================================
    // removeOracle Tests
    // =============================================================================

    function test_RemoveOracle_Success() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);
        assertTrue(adapter.isConfigured(asset1));

        adapter.removeOracle(asset1);
        assertFalse(adapter.isConfigured(asset1));
        assertEq(adapter.configuredAssetCount(), 0);
        vm.stopPrank();
    }

    function test_RemoveOracle_EmitsEvent() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        vm.expectEmit(true, false, false, false);
        emit OracleAdapter.OracleRemoved(asset1);
        adapter.removeOracle(asset1);
        vm.stopPrank();
    }

    function test_RemoveOracle_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AssetNotConfigured.selector, asset1));
        adapter.removeOracle(asset1);
    }

    function test_RemoveOracle_RevertIf_NotAdmin() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        vm.prank(user);
        vm.expectRevert();
        adapter.removeOracle(asset1);
    }

    // =============================================================================
    // getPrice Tests
    // =============================================================================

    function test_GetPrice_UsesPrimaryOracle() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        uint256 price = adapter.getPrice(asset1);
        assertEq(price, DEFAULT_PRICE);
    }

    function test_GetPrice_FailoverToBackup_WhenPrimaryStale() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        // Make primary oracle stale
        primaryOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 3 hours);
        backupOracle.setPrice(asset1, 1.5e18);

        uint256 price = adapter.getPrice(asset1);
        assertEq(price, 1.5e18); // Should use backup price
    }

    function test_GetPrice_FailoverToBackup_WhenPrimaryZero() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        // Set primary price to zero
        primaryOracle.setPrice(asset1, 0);
        backupOracle.setPrice(asset1, 1.5e18);

        uint256 price = adapter.getPrice(asset1);
        assertEq(price, 1.5e18); // Should use backup price
    }

    function test_GetPrice_ReturnsStalePrice_WhenBothStale() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        // Make both oracles stale
        primaryOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 3 hours);
        backupOracle.setPriceWithTimestamp(asset1, 1.5e18, block.timestamp - 3 hours);

        // Should return backup stale price as last resort
        uint256 price = adapter.getPrice(asset1);
        assertEq(price, 1.5e18);
    }

    function test_GetPrice_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AssetNotConfigured.selector, asset1));
        adapter.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_AllOraclesFail() public {
        // Deploy a contract that will fail on getPriceWithTimestamp
        MockFailingOracle failingOracle = new MockFailingOracle();

        vm.prank(admin);
        adapter.configureOracle(asset1, address(failingOracle), address(0), 0);

        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AllOraclesFailed.selector, asset1));
        adapter.getPrice(asset1);
    }

    // =============================================================================
    // getPriceWithTimestamp Tests
    // =============================================================================

    function test_GetPriceWithTimestamp_Success() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        (uint256 price, uint256 timestamp) = adapter.getPriceWithTimestamp(asset1);
        assertEq(price, DEFAULT_PRICE);
        assertEq(timestamp, block.timestamp);
    }

    function test_GetPriceWithTimestamp_ReturnsCorrectTimestamp() public {
        uint256 customTimestamp = block.timestamp - 30 minutes;
        primaryOracle.setPriceWithTimestamp(asset1, 2e18, customTimestamp);

        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        (uint256 price, uint256 timestamp) = adapter.getPriceWithTimestamp(asset1);
        assertEq(price, 2e18);
        assertEq(timestamp, customTimestamp);
    }

    // =============================================================================
    // getPriceWithSource Tests
    // =============================================================================

    function test_GetPriceWithSource_ReturnsPrimary() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        (uint256 price, uint256 timestamp, IOracleAdapter.OracleSource source) = adapter.getPriceWithSource(asset1);
        assertEq(price, DEFAULT_PRICE);
        assertEq(timestamp, block.timestamp);
        assertEq(uint8(source), uint8(IOracleAdapter.OracleSource.PRIMARY));
    }

    function test_GetPriceWithSource_ReturnsBackup_OnFailover() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        // Make primary stale
        primaryOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 3 hours);

        (, , IOracleAdapter.OracleSource source) = adapter.getPriceWithSource(asset1);
        assertEq(uint8(source), uint8(IOracleAdapter.OracleSource.BACKUP));
    }

    // =============================================================================
    // isPriceStale Tests
    // =============================================================================

    function test_IsPriceStale_ReturnsFalse_WhenFresh() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        assertFalse(adapter.isPriceStale(asset1));
    }

    function test_IsPriceStale_ReturnsTrue_WhenStale() public {
        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        // Make both oracles return stale data
        primaryOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 3 hours);
        backupOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 3 hours);

        assertTrue(adapter.isPriceStale(asset1));
    }

    function test_IsPriceStale_UsesCustomThreshold() public {
        uint256 customThreshold = 30 minutes;

        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), customThreshold);

        // 45 minutes old - stale with custom threshold, fresh with default
        primaryOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 45 minutes);
        backupOracle.setPriceWithTimestamp(asset1, DEFAULT_PRICE, block.timestamp - 45 minutes);

        assertTrue(adapter.isPriceStale(asset1));
    }

    // =============================================================================
    // setGlobalStalenessThreshold Tests
    // =============================================================================

    function test_SetGlobalStalenessThreshold_Success() public {
        uint256 newThreshold = 4 hours;

        vm.prank(admin);
        adapter.setGlobalStalenessThreshold(newThreshold);

        assertEq(adapter.globalStalenessThreshold(), newThreshold);
    }

    function test_SetGlobalStalenessThreshold_EmitsEvent() public {
        uint256 newThreshold = 4 hours;

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit OracleAdapter.StalenessThresholdUpdated(STALENESS_THRESHOLD, newThreshold);
        adapter.setGlobalStalenessThreshold(newThreshold);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_Zero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.InvalidStalenessThreshold.selector, 0));
        adapter.setGlobalStalenessThreshold(0);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.InvalidStalenessThreshold.selector, 25 hours));
        adapter.setGlobalStalenessThreshold(25 hours);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        adapter.setGlobalStalenessThreshold(4 hours);
    }

    // =============================================================================
    // setPrimaryOracle Tests
    // =============================================================================

    function test_SetPrimaryOracle_Success() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        MockOracleAdapter newPrimary = new MockOracleAdapter();
        adapter.setPrimaryOracle(asset1, address(newPrimary));

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.primaryOracle, address(newPrimary));
        vm.stopPrank();
    }

    function test_SetPrimaryOracle_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AssetNotConfigured.selector, asset1));
        adapter.setPrimaryOracle(asset1, address(primaryOracle));
    }

    function test_SetPrimaryOracle_RevertIf_BothWouldBeZero() public {
        vm.startPrank(admin);
        // Configure with only primary oracle
        adapter.configureOracle(asset1, address(primaryOracle), address(0), 0);

        // Try to set primary to zero (would leave both zero)
        vm.expectRevert(OracleAdapter.ZeroAddress.selector);
        adapter.setPrimaryOracle(asset1, address(0));
        vm.stopPrank();
    }

    // =============================================================================
    // setBackupOracle Tests
    // =============================================================================

    function test_SetBackupOracle_Success() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        MockOracleAdapter newBackup = new MockOracleAdapter();
        adapter.setBackupOracle(asset1, address(newBackup));

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.backupOracle, address(newBackup));
        vm.stopPrank();
    }

    function test_SetBackupOracle_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AssetNotConfigured.selector, asset1));
        adapter.setBackupOracle(asset1, address(backupOracle));
    }

    // =============================================================================
    // View Function Tests
    // =============================================================================

    function test_GetConfiguredAssets_ReturnsAll() public {
        vm.startPrank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);
        adapter.configureOracle(asset2, address(primaryOracle), address(backupOracle), 0);
        vm.stopPrank();

        address[] memory assets = adapter.getConfiguredAssets();
        assertEq(assets.length, 2);
    }

    function test_GetOracleConfig_ReturnsCorrectData() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), customThreshold);

        OracleAdapter.OracleConfig memory config = adapter.getOracleConfig(asset1);
        assertEq(config.primaryOracle, address(primaryOracle));
        assertEq(config.backupOracle, address(backupOracle));
        assertEq(config.stalenessThreshold, customThreshold);
        assertTrue(config.isConfigured);
    }

    function test_GetOracleConfig_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(OracleAdapter.AssetNotConfigured.selector, asset1));
        adapter.getOracleConfig(asset1);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_ConfigureOracle_AnyValidPrice(uint256 price) public {
        vm.assume(price > 0 && price < type(uint128).max);

        primaryOracle.setPrice(asset1, price);

        vm.prank(admin);
        adapter.configureOracle(asset1, address(primaryOracle), address(backupOracle), 0);

        assertEq(adapter.getPrice(asset1), price);
    }

    function testFuzz_StalenessThreshold_ValidRange(uint256 threshold) public {
        vm.assume(threshold > 0 && threshold <= 24 hours);

        vm.prank(admin);
        adapter.setGlobalStalenessThreshold(threshold);

        assertEq(adapter.globalStalenessThreshold(), threshold);
    }
}

/// @notice Mock oracle that always fails
contract MockFailingOracle is IOracleAdapter {
    function getPrice(address) external pure override returns (uint256) {
        revert("Oracle failure");
    }

    function getPriceWithTimestamp(address) external pure override returns (uint256, uint256) {
        revert("Oracle failure");
    }

    function getPriceWithSource(address) external pure override returns (uint256, uint256, OracleSource) {
        revert("Oracle failure");
    }

    function isPriceStale(address) external pure override returns (bool) {
        revert("Oracle failure");
    }
}
