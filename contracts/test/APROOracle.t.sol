// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {APROOracle} from "../src/oracles/APROOracle.sol";
import {IOracleAdapter} from "../src/interfaces/IOracleAdapter.sol";
import {MockApi3Server} from "./mocks/MockApi3Server.sol";

/// @title APROOracle Tests
/// @notice Comprehensive tests for APRO (API3) Oracle adapter
contract APROOracleTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    APROOracle public oracle;
    MockApi3Server public api3Server;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public asset1 = makeAddr("asset1");
    address public asset2 = makeAddr("asset2");

    bytes32 public constant DATA_FEED_ID_1 = keccak256("RWA1/USD");
    bytes32 public constant DATA_FEED_ID_2 = keccak256("RWA2/USD");
    bytes32 public constant DAPI_NAME_1 = bytes32("RWA1/USD");

    int224 public constant DEFAULT_PRICE = int224(int256(1e18)); // $1
    uint256 public constant STALENESS_THRESHOLD = 2 hours;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Warp to a reasonable timestamp
        vm.warp(1700000000);

        // Deploy mock API3 server
        api3Server = new MockApi3Server();

        // Deploy APROOracle
        vm.prank(admin);
        oracle = new APROOracle(address(api3Server), admin);

        // Set default prices
        api3Server.setDataFeed(DATA_FEED_ID_1, DEFAULT_PRICE);
        api3Server.setDataFeed(DATA_FEED_ID_2, int224(int256(2e18)));

        // Set dAPI name mapping
        api3Server.setDapiNameMapping(DAPI_NAME_1, DATA_FEED_ID_1);
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_Constructor_SetsAdmin() public view {
        assertTrue(oracle.hasRole(oracle.ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_SetsApi3Server() public view {
        assertEq(oracle.getApi3Server(), address(api3Server));
    }

    function test_Constructor_SetsDefaultStalenessThreshold() public view {
        assertEq(oracle.globalStalenessThreshold(), STALENESS_THRESHOLD);
    }

    function test_Constructor_RevertIf_ZeroApi3Server() public {
        vm.expectRevert(APROOracle.ZeroAddress.selector);
        new APROOracle(address(0), admin);
    }

    function test_Constructor_RevertIf_ZeroAdmin() public {
        vm.expectRevert(APROOracle.ZeroAddress.selector);
        new APROOracle(address(api3Server), address(0));
    }

    // =============================================================================
    // configureAsset Tests
    // =============================================================================

    function test_ConfigureAsset_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        assertTrue(oracle.isConfigured(asset1));
        assertEq(oracle.configuredAssetCount(), 1);
    }

    function test_ConfigureAsset_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit APROOracle.AssetConfigured(asset1, DATA_FEED_ID_1, 0);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
    }

    function test_ConfigureAsset_WithCustomThreshold() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, customThreshold);

        assertEq(oracle.getStalenessThreshold(asset1), customThreshold);
    }

    function test_ConfigureAsset_RevertIf_ZeroAsset() public {
        vm.prank(admin);
        vm.expectRevert(APROOracle.ZeroAddress.selector);
        oracle.configureAsset(address(0), DATA_FEED_ID_1, 0);
    }

    function test_ConfigureAsset_RevertIf_ZeroDataFeedId() public {
        vm.prank(admin);
        vm.expectRevert(APROOracle.ZeroDataFeedId.selector);
        oracle.configureAsset(asset1, bytes32(0), 0);
    }

    function test_ConfigureAsset_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
    }

    function test_ConfigureAsset_UpdatesExisting() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
        assertEq(oracle.configuredAssetCount(), 1);

        // Update configuration
        oracle.configureAsset(asset1, DATA_FEED_ID_2, 1 hours);
        assertEq(oracle.configuredAssetCount(), 1); // Should not add duplicate

        APROOracle.AssetConfig memory config = oracle.getAssetConfig(asset1);
        assertEq(config.dataFeedId, DATA_FEED_ID_2);
        assertEq(config.stalenessThreshold, 1 hours);
        vm.stopPrank();
    }

    // =============================================================================
    // configureAssetWithDapiName Tests
    // =============================================================================

    function test_ConfigureAssetWithDapiName_Success() public {
        vm.prank(admin);
        oracle.configureAssetWithDapiName(asset1, DAPI_NAME_1, 0);

        assertTrue(oracle.isConfigured(asset1));

        APROOracle.AssetConfig memory config = oracle.getAssetConfig(asset1);
        assertEq(config.dataFeedId, DATA_FEED_ID_1);
    }

    function test_ConfigureAssetWithDapiName_RevertIf_ZeroName() public {
        vm.prank(admin);
        vm.expectRevert(APROOracle.ZeroDataFeedId.selector);
        oracle.configureAssetWithDapiName(asset1, bytes32(0), 0);
    }

    // =============================================================================
    // removeAsset Tests
    // =============================================================================

    function test_RemoveAsset_Success() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
        assertTrue(oracle.isConfigured(asset1));

        oracle.removeAsset(asset1);
        assertFalse(oracle.isConfigured(asset1));
        assertEq(oracle.configuredAssetCount(), 0);
        vm.stopPrank();
    }

    function test_RemoveAsset_EmitsEvent() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        vm.expectEmit(true, false, false, false);
        emit APROOracle.AssetRemoved(asset1);
        oracle.removeAsset(asset1);
        vm.stopPrank();
    }

    function test_RemoveAsset_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(APROOracle.AssetNotConfigured.selector, asset1));
        oracle.removeAsset(asset1);
    }

    function test_RemoveAsset_RevertIf_NotAdmin() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        vm.prank(user);
        vm.expectRevert();
        oracle.removeAsset(asset1);
    }

    // =============================================================================
    // getPrice Tests
    // =============================================================================

    function test_GetPrice_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        uint256 price = oracle.getPrice(asset1);
        assertEq(price, uint256(uint224(DEFAULT_PRICE)));
    }

    function test_GetPrice_ReturnsCorrectValue() public {
        int224 customPrice = int224(int256(1.5e18));
        api3Server.setDataFeed(DATA_FEED_ID_1, customPrice);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        uint256 price = oracle.getPrice(asset1);
        assertEq(price, uint256(uint224(customPrice)));
    }

    function test_GetPrice_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(APROOracle.AssetNotConfigured.selector, asset1));
        oracle.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_ZeroPrice() public {
        api3Server.setDataFeed(DATA_FEED_ID_1, 0);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        vm.expectRevert(abi.encodeWithSelector(APROOracle.InvalidPrice.selector, asset1, int224(0)));
        oracle.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_NegativePrice() public {
        api3Server.setDataFeed(DATA_FEED_ID_1, -1e18);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        vm.expectRevert(abi.encodeWithSelector(APROOracle.InvalidPrice.selector, asset1, int224(-1e18)));
        oracle.getPrice(asset1);
    }

    // =============================================================================
    // getPriceWithTimestamp Tests
    // =============================================================================

    function test_GetPriceWithTimestamp_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        (uint256 price, uint256 timestamp) = oracle.getPriceWithTimestamp(asset1);
        assertEq(price, uint256(uint224(DEFAULT_PRICE)));
        assertEq(timestamp, block.timestamp);
    }

    function test_GetPriceWithTimestamp_ReturnsCorrectTimestamp() public {
        uint32 customTimestamp = uint32(block.timestamp - 30 minutes);
        api3Server.setDataFeedWithTimestamp(DATA_FEED_ID_1, DEFAULT_PRICE, customTimestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        (uint256 price, uint256 timestamp) = oracle.getPriceWithTimestamp(asset1);
        assertEq(price, uint256(uint224(DEFAULT_PRICE)));
        assertEq(timestamp, uint256(customTimestamp));
    }

    // =============================================================================
    // getPriceWithSource Tests
    // =============================================================================

    function test_GetPriceWithSource_ReturnsPrimary() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        (uint256 price, uint256 timestamp, IOracleAdapter.OracleSource source) = oracle.getPriceWithSource(asset1);
        assertEq(price, uint256(uint224(DEFAULT_PRICE)));
        assertEq(timestamp, block.timestamp);
        assertEq(uint8(source), uint8(IOracleAdapter.OracleSource.PRIMARY));
    }

    // =============================================================================
    // isPriceStale Tests
    // =============================================================================

    function test_IsPriceStale_ReturnsFalse_WhenFresh() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        assertFalse(oracle.isPriceStale(asset1));
    }

    function test_IsPriceStale_ReturnsTrue_WhenStale() public {
        uint32 staleTimestamp = uint32(block.timestamp - 3 hours);
        api3Server.setDataFeedWithTimestamp(DATA_FEED_ID_1, DEFAULT_PRICE, staleTimestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        assertTrue(oracle.isPriceStale(asset1));
    }

    function test_IsPriceStale_UsesCustomThreshold() public {
        uint32 timestamp = uint32(block.timestamp - 45 minutes);
        api3Server.setDataFeedWithTimestamp(DATA_FEED_ID_1, DEFAULT_PRICE, timestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 30 minutes);

        // 45 minutes old with 30 minute threshold = stale
        assertTrue(oracle.isPriceStale(asset1));
    }

    function test_IsPriceStale_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(APROOracle.AssetNotConfigured.selector, asset1));
        oracle.isPriceStale(asset1);
    }

    // =============================================================================
    // setGlobalStalenessThreshold Tests
    // =============================================================================

    function test_SetGlobalStalenessThreshold_Success() public {
        uint256 newThreshold = 4 hours;

        vm.prank(admin);
        oracle.setGlobalStalenessThreshold(newThreshold);

        assertEq(oracle.globalStalenessThreshold(), newThreshold);
    }

    function test_SetGlobalStalenessThreshold_EmitsEvent() public {
        uint256 newThreshold = 4 hours;

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit APROOracle.StalenessThresholdUpdated(STALENESS_THRESHOLD, newThreshold);
        oracle.setGlobalStalenessThreshold(newThreshold);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_Zero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(APROOracle.InvalidStalenessThreshold.selector, 0));
        oracle.setGlobalStalenessThreshold(0);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(APROOracle.InvalidStalenessThreshold.selector, 25 hours));
        oracle.setGlobalStalenessThreshold(25 hours);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setGlobalStalenessThreshold(4 hours);
    }

    // =============================================================================
    // View Function Tests
    // =============================================================================

    function test_GetConfiguredAssets_ReturnsAll() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
        oracle.configureAsset(asset2, DATA_FEED_ID_2, 0);
        vm.stopPrank();

        address[] memory assets = oracle.getConfiguredAssets();
        assertEq(assets.length, 2);
    }

    function test_GetAssetConfig_ReturnsCorrectData() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, customThreshold);

        APROOracle.AssetConfig memory config = oracle.getAssetConfig(asset1);
        assertEq(config.dataFeedId, DATA_FEED_ID_1);
        assertEq(config.stalenessThreshold, customThreshold);
        assertTrue(config.isConfigured);
    }

    function test_GetAssetConfig_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(APROOracle.AssetNotConfigured.selector, asset1));
        oracle.getAssetConfig(asset1);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_ConfigureAsset_AnyValidPrice(int224 price) public {
        vm.assume(price > 0);

        api3Server.setDataFeed(DATA_FEED_ID_1, price);

        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        assertEq(oracle.getPrice(asset1), uint256(uint224(price)));
    }

    function testFuzz_StalenessThreshold_ValidRange(uint256 threshold) public {
        vm.assume(threshold > 0 && threshold <= 24 hours);

        vm.prank(admin);
        oracle.setGlobalStalenessThreshold(threshold);

        assertEq(oracle.globalStalenessThreshold(), threshold);
    }

    // =============================================================================
    // Integration Tests
    // =============================================================================

    function test_MultipleAssets_IndependentPrices() public {
        api3Server.setDataFeed(DATA_FEED_ID_1, int224(int256(1e18)));
        api3Server.setDataFeed(DATA_FEED_ID_2, int224(int256(2e18)));

        vm.startPrank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);
        oracle.configureAsset(asset2, DATA_FEED_ID_2, 0);
        vm.stopPrank();

        assertEq(oracle.getPrice(asset1), 1e18);
        assertEq(oracle.getPrice(asset2), 2e18);
    }

    function test_PriceUpdate_ReflectsImmediately() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, DATA_FEED_ID_1, 0);

        assertEq(oracle.getPrice(asset1), uint256(uint224(DEFAULT_PRICE)));

        // Update price
        api3Server.setDataFeed(DATA_FEED_ID_1, int224(int256(3e18)));

        assertEq(oracle.getPrice(asset1), 3e18);
    }
}
