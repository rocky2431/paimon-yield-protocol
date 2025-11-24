// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ChainlinkOracle} from "../src/oracles/ChainlinkOracle.sol";
import {IOracleAdapter} from "../src/interfaces/IOracleAdapter.sol";
import {MockChainlinkAggregator} from "./mocks/MockChainlinkAggregator.sol";

/// @title ChainlinkOracle Tests
/// @notice Comprehensive tests for Chainlink Oracle adapter
contract ChainlinkOracleTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    ChainlinkOracle public oracle;
    MockChainlinkAggregator public aggregator1;
    MockChainlinkAggregator public aggregator2;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public asset1 = makeAddr("asset1");
    address public asset2 = makeAddr("asset2");

    int256 public constant DEFAULT_PRICE = 1e8; // $1 with 8 decimals (Chainlink standard)
    uint256 public constant STALENESS_THRESHOLD = 2 hours;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Warp to a reasonable timestamp
        vm.warp(1700000000);

        // Deploy mock aggregators (8 decimals is Chainlink standard)
        aggregator1 = new MockChainlinkAggregator(8, "RWA1/USD");
        aggregator2 = new MockChainlinkAggregator(8, "RWA2/USD");

        // Deploy ChainlinkOracle
        vm.prank(admin);
        oracle = new ChainlinkOracle(admin);

        // Set default prices
        aggregator1.setAnswer(DEFAULT_PRICE);
        aggregator2.setAnswer(2e8); // $2
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_Constructor_SetsAdmin() public view {
        assertTrue(oracle.hasRole(oracle.ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_SetsDefaultStalenessThreshold() public view {
        assertEq(oracle.globalStalenessThreshold(), STALENESS_THRESHOLD);
    }

    function test_Constructor_RevertIf_ZeroAdmin() public {
        vm.expectRevert(ChainlinkOracle.ZeroAddress.selector);
        new ChainlinkOracle(address(0));
    }

    // =============================================================================
    // configureAsset Tests
    // =============================================================================

    function test_ConfigureAsset_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        assertTrue(oracle.isConfigured(asset1));
        assertEq(oracle.configuredAssetCount(), 1);
    }

    function test_ConfigureAsset_EmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit ChainlinkOracle.AssetConfigured(asset1, address(aggregator1), 8, 0);
        oracle.configureAsset(asset1, address(aggregator1), 0);
    }

    function test_ConfigureAsset_WithCustomThreshold() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), customThreshold);

        assertEq(oracle.getStalenessThreshold(asset1), customThreshold);
    }

    function test_ConfigureAsset_RevertIf_ZeroAsset() public {
        vm.prank(admin);
        vm.expectRevert(ChainlinkOracle.ZeroAddress.selector);
        oracle.configureAsset(address(0), address(aggregator1), 0);
    }

    function test_ConfigureAsset_RevertIf_ZeroAggregator() public {
        vm.prank(admin);
        vm.expectRevert(ChainlinkOracle.ZeroAddress.selector);
        oracle.configureAsset(asset1, address(0), 0);
    }

    function test_ConfigureAsset_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.configureAsset(asset1, address(aggregator1), 0);
    }

    function test_ConfigureAsset_UpdatesExisting() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);
        assertEq(oracle.configuredAssetCount(), 1);

        // Update configuration
        oracle.configureAsset(asset1, address(aggregator2), 1 hours);
        assertEq(oracle.configuredAssetCount(), 1); // Should not add duplicate

        ChainlinkOracle.AssetConfig memory config = oracle.getAssetConfig(asset1);
        assertEq(config.aggregator, address(aggregator2));
        assertEq(config.stalenessThreshold, 1 hours);
        vm.stopPrank();
    }

    // =============================================================================
    // removeAsset Tests
    // =============================================================================

    function test_RemoveAsset_Success() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);
        assertTrue(oracle.isConfigured(asset1));

        oracle.removeAsset(asset1);
        assertFalse(oracle.isConfigured(asset1));
        assertEq(oracle.configuredAssetCount(), 0);
        vm.stopPrank();
    }

    function test_RemoveAsset_EmitsEvent() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        vm.expectEmit(true, false, false, false);
        emit ChainlinkOracle.AssetRemoved(asset1);
        oracle.removeAsset(asset1);
        vm.stopPrank();
    }

    function test_RemoveAsset_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.AssetNotConfigured.selector, asset1));
        oracle.removeAsset(asset1);
    }

    // =============================================================================
    // getPrice Tests
    // =============================================================================

    function test_GetPrice_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        uint256 price = oracle.getPrice(asset1);
        // 1e8 (8 decimals) → 1e18 (18 decimals)
        assertEq(price, 1e18);
    }

    function test_GetPrice_ConvertsDecimals_8to18() public {
        aggregator1.setAnswer(123456789); // 1.23456789 with 8 decimals

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        uint256 price = oracle.getPrice(asset1);
        assertEq(price, 123456789 * 1e10); // Convert to 18 decimals
    }

    function test_GetPrice_ConvertsDecimals_18to18() public {
        MockChainlinkAggregator agg18 = new MockChainlinkAggregator(18, "RWA/USD");
        agg18.setAnswer(1.5e18);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(agg18), 0);

        uint256 price = oracle.getPrice(asset1);
        assertEq(price, 1.5e18);
    }

    function test_GetPrice_ConvertsDecimals_6to18() public {
        MockChainlinkAggregator agg6 = new MockChainlinkAggregator(6, "USDC/USD");
        agg6.setAnswer(1e6); // $1 with 6 decimals

        vm.prank(admin);
        oracle.configureAsset(asset1, address(agg6), 0);

        uint256 price = oracle.getPrice(asset1);
        assertEq(price, 1e18);
    }

    function test_GetPrice_RevertIf_NotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.AssetNotConfigured.selector, asset1));
        oracle.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_ZeroPrice() public {
        aggregator1.setAnswer(0);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidPrice.selector, asset1, int256(0)));
        oracle.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_NegativePrice() public {
        aggregator1.setAnswer(-1e8);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidPrice.selector, asset1, int256(-1e8)));
        oracle.getPrice(asset1);
    }

    function test_GetPrice_RevertIf_IncompleteRound() public {
        aggregator1.setIncompleteRound(1e8, 10, 9); // answeredInRound < roundId

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.IncompleteRound.selector, asset1, uint80(10), uint80(9)));
        oracle.getPrice(asset1);
    }

    // =============================================================================
    // getPriceWithTimestamp Tests
    // =============================================================================

    function test_GetPriceWithTimestamp_Success() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        (uint256 price, uint256 timestamp) = oracle.getPriceWithTimestamp(asset1);
        assertEq(price, 1e18);
        assertEq(timestamp, block.timestamp);
    }

    function test_GetPriceWithTimestamp_ReturnsCorrectTimestamp() public {
        uint256 customTimestamp = block.timestamp - 30 minutes;
        aggregator1.setAnswerWithTimestamp(DEFAULT_PRICE, customTimestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        (uint256 price, uint256 timestamp) = oracle.getPriceWithTimestamp(asset1);
        assertEq(price, 1e18);
        assertEq(timestamp, customTimestamp);
    }

    // =============================================================================
    // getPriceWithSource Tests
    // =============================================================================

    function test_GetPriceWithSource_ReturnsBackup() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        (uint256 price, uint256 timestamp, IOracleAdapter.OracleSource source) = oracle.getPriceWithSource(asset1);
        assertEq(price, 1e18);
        assertEq(timestamp, block.timestamp);
        assertEq(uint8(source), uint8(IOracleAdapter.OracleSource.BACKUP));
    }

    // =============================================================================
    // isPriceStale Tests
    // =============================================================================

    function test_IsPriceStale_ReturnsFalse_WhenFresh() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        assertFalse(oracle.isPriceStale(asset1));
    }

    function test_IsPriceStale_ReturnsTrue_WhenStale() public {
        uint256 staleTimestamp = block.timestamp - 3 hours;
        aggregator1.setAnswerWithTimestamp(DEFAULT_PRICE, staleTimestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        assertTrue(oracle.isPriceStale(asset1));
    }

    function test_IsPriceStale_UsesCustomThreshold() public {
        uint256 timestamp = block.timestamp - 45 minutes;
        aggregator1.setAnswerWithTimestamp(DEFAULT_PRICE, timestamp);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 30 minutes);

        // 45 minutes old with 30 minute threshold = stale
        assertTrue(oracle.isPriceStale(asset1));
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
        emit ChainlinkOracle.StalenessThresholdUpdated(STALENESS_THRESHOLD, newThreshold);
        oracle.setGlobalStalenessThreshold(newThreshold);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_Zero() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidStalenessThreshold.selector, 0));
        oracle.setGlobalStalenessThreshold(0);
    }

    function test_SetGlobalStalenessThreshold_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidStalenessThreshold.selector, 25 hours));
        oracle.setGlobalStalenessThreshold(25 hours);
    }

    // =============================================================================
    // setAggregator Tests
    // =============================================================================

    function test_SetAggregator_Success() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        oracle.setAggregator(asset1, address(aggregator2));

        assertEq(oracle.getAggregator(asset1), address(aggregator2));
        vm.stopPrank();
    }

    function test_SetAggregator_RevertIf_NotConfigured() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.AssetNotConfigured.selector, asset1));
        oracle.setAggregator(asset1, address(aggregator1));
    }

    function test_SetAggregator_RevertIf_ZeroAddress() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        vm.expectRevert(ChainlinkOracle.ZeroAddress.selector);
        oracle.setAggregator(asset1, address(0));
        vm.stopPrank();
    }

    // =============================================================================
    // View Function Tests
    // =============================================================================

    function test_GetConfiguredAssets_ReturnsAll() public {
        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);
        oracle.configureAsset(asset2, address(aggregator2), 0);
        vm.stopPrank();

        address[] memory assets = oracle.getConfiguredAssets();
        assertEq(assets.length, 2);
    }

    function test_GetAssetConfig_ReturnsCorrectData() public {
        uint256 customThreshold = 1 hours;

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), customThreshold);

        ChainlinkOracle.AssetConfig memory config = oracle.getAssetConfig(asset1);
        assertEq(config.aggregator, address(aggregator1));
        assertEq(config.decimals, 8);
        assertEq(config.stalenessThreshold, customThreshold);
        assertTrue(config.isConfigured);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_ConfigureAsset_AnyValidPrice(int256 price) public {
        // Constrain to prevent overflow when converting 8 → 18 decimals
        vm.assume(price > 0 && price < 1e28);

        aggregator1.setAnswer(price);

        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        // Price should be converted to 18 decimals
        uint256 expectedPrice = uint256(price) * 1e10; // 8 → 18 decimals
        assertEq(oracle.getPrice(asset1), expectedPrice);
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
        aggregator1.setAnswer(1e8);  // $1
        aggregator2.setAnswer(2e8);  // $2

        vm.startPrank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);
        oracle.configureAsset(asset2, address(aggregator2), 0);
        vm.stopPrank();

        assertEq(oracle.getPrice(asset1), 1e18);
        assertEq(oracle.getPrice(asset2), 2e18);
    }

    function test_PriceUpdate_ReflectsImmediately() public {
        vm.prank(admin);
        oracle.configureAsset(asset1, address(aggregator1), 0);

        assertEq(oracle.getPrice(asset1), 1e18);

        // Update price
        aggregator1.setAnswer(3e8);

        assertEq(oracle.getPrice(asset1), 3e18);
    }
}
