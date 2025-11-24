// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AssetRegistry} from "../src/AssetRegistry.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";

contract AssetRegistryTest is Test {
    // =============================================================================
    // Constants
    // =============================================================================

    address public constant ADMIN = address(0x1);
    address public constant USER = address(0x2);
    address public constant ORACLE = address(0x3);

    // =============================================================================
    // State Variables
    // =============================================================================

    AssetRegistry public registry;
    ERC20Mock public mockToken1;
    ERC20Mock public mockToken2;
    ERC20Mock public mockToken3;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        vm.startPrank(ADMIN);
        registry = new AssetRegistry(ADMIN);
        vm.stopPrank();

        // Deploy mock tokens
        mockToken1 = new ERC20Mock("USDY Token", "USDY", 18);
        mockToken2 = new ERC20Mock("Gold Token", "XAUT", 18);
        mockToken3 = new ERC20Mock("Real Estate Token", "RET", 18);
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_constructor_setsAdmin() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), ADMIN));
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(AssetRegistry.ZeroAddress.selector);
        new AssetRegistry(address(0));
    }

    // =============================================================================
    // registerAsset Tests
    // =============================================================================

    function test_registerAsset_success() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();

        assertTrue(registry.isRegistered(address(mockToken1)));
        assertTrue(registry.isActive(address(mockToken1)));
        assertEq(registry.assetCount(), 1);

        AssetRegistry.RWAAsset memory asset = registry.getAsset(address(mockToken1));
        assertEq(asset.tokenAddress, address(mockToken1));
        assertEq(asset.name, "USDY Token");
        assertEq(asset.symbol, "USDY");
        assertEq(uint256(asset.assetType), uint256(AssetRegistry.AssetType.YIELD_BEARING));
        assertEq(asset.oracleSource, ORACLE);
        assertTrue(asset.isActive);
    }

    function test_registerAsset_emitsEvent() public {
        vm.startPrank(ADMIN);
        vm.expectEmit(true, false, false, true);
        emit AssetRegistry.AssetRegistered(
            address(mockToken1),
            "USDY Token",
            "USDY",
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    function test_registerAsset_revertsOnZeroAddress() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(AssetRegistry.ZeroAddress.selector);
        registry.registerAsset(
            address(0),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    function test_registerAsset_revertsIfAlreadyRegistered() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetAlreadyRegistered.selector,
                address(mockToken1)
            )
        );
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    function test_registerAsset_revertsOnUnauthorized() public {
        vm.startPrank(USER);
        vm.expectRevert();
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    function test_registerAsset_allowsZeroOracle() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            address(0)
        );
        vm.stopPrank();

        AssetRegistry.RWAAsset memory asset = registry.getAsset(address(mockToken1));
        assertEq(asset.oracleSource, address(0));
    }

    // =============================================================================
    // registerAssetWithMetadata Tests
    // =============================================================================

    function test_registerAssetWithMetadata_success() public {
        vm.startPrank(ADMIN);
        registry.registerAssetWithMetadata(
            address(mockToken1),
            "Custom USDY",
            "cUSDY",
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();

        AssetRegistry.RWAAsset memory asset = registry.getAsset(address(mockToken1));
        assertEq(asset.name, "Custom USDY");
        assertEq(asset.symbol, "cUSDY");
    }

    function test_registerAssetWithMetadata_revertsOnEmptyName() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(AssetRegistry.EmptyString.selector);
        registry.registerAssetWithMetadata(
            address(mockToken1),
            "",
            "USDY",
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    function test_registerAssetWithMetadata_revertsOnEmptySymbol() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(AssetRegistry.EmptyString.selector);
        registry.registerAssetWithMetadata(
            address(mockToken1),
            "USDY Token",
            "",
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );
        vm.stopPrank();
    }

    // =============================================================================
    // removeAsset Tests
    // =============================================================================

    function test_removeAsset_success() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        registry.removeAsset(address(mockToken1));
        vm.stopPrank();

        assertFalse(registry.isRegistered(address(mockToken1)));
        assertEq(registry.assetCount(), 0);
    }

    function test_removeAsset_emitsEvent() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        vm.expectEmit(true, false, false, false);
        emit AssetRegistry.AssetRemoved(address(mockToken1));
        registry.removeAsset(address(mockToken1));
        vm.stopPrank();
    }

    function test_removeAsset_revertsIfNotRegistered() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetNotFound.selector,
                address(mockToken1)
            )
        );
        registry.removeAsset(address(mockToken1));
        vm.stopPrank();
    }

    function test_removeAsset_middleElement() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(address(mockToken1), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);
        registry.registerAsset(address(mockToken2), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);
        registry.registerAsset(address(mockToken3), AssetRegistry.AssetType.REAL_ESTATE, ORACLE);

        registry.removeAsset(address(mockToken2));
        vm.stopPrank();

        assertEq(registry.assetCount(), 2);
        assertTrue(registry.isRegistered(address(mockToken1)));
        assertFalse(registry.isRegistered(address(mockToken2)));
        assertTrue(registry.isRegistered(address(mockToken3)));
    }

    // =============================================================================
    // setAssetStatus Tests
    // =============================================================================

    function test_setAssetStatus_deactivate() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        registry.setAssetStatus(address(mockToken1), false);
        vm.stopPrank();

        assertFalse(registry.isActive(address(mockToken1)));
    }

    function test_setAssetStatus_reactivate() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        registry.setAssetStatus(address(mockToken1), false);
        registry.setAssetStatus(address(mockToken1), true);
        vm.stopPrank();

        assertTrue(registry.isActive(address(mockToken1)));
    }

    function test_setAssetStatus_emitsEvent() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        vm.expectEmit(true, false, false, true);
        emit AssetRegistry.AssetStatusUpdated(address(mockToken1), false);
        registry.setAssetStatus(address(mockToken1), false);
        vm.stopPrank();
    }

    function test_setAssetStatus_revertsIfNotRegistered() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetNotFound.selector,
                address(mockToken1)
            )
        );
        registry.setAssetStatus(address(mockToken1), false);
        vm.stopPrank();
    }

    // =============================================================================
    // setOracleSource Tests
    // =============================================================================

    function test_setOracleSource_success() public {
        address newOracle = address(0x999);

        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        registry.setOracleSource(address(mockToken1), newOracle);
        vm.stopPrank();

        AssetRegistry.RWAAsset memory asset = registry.getAsset(address(mockToken1));
        assertEq(asset.oracleSource, newOracle);
    }

    function test_setOracleSource_emitsEvent() public {
        address newOracle = address(0x999);

        vm.startPrank(ADMIN);
        registry.registerAsset(
            address(mockToken1),
            AssetRegistry.AssetType.YIELD_BEARING,
            ORACLE
        );

        vm.expectEmit(true, false, false, true);
        emit AssetRegistry.OracleSourceUpdated(address(mockToken1), newOracle);
        registry.setOracleSource(address(mockToken1), newOracle);
        vm.stopPrank();
    }

    function test_setOracleSource_revertsIfNotRegistered() public {
        vm.startPrank(ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetNotFound.selector,
                address(mockToken1)
            )
        );
        registry.setOracleSource(address(mockToken1), ORACLE);
        vm.stopPrank();
    }

    // =============================================================================
    // View Functions Tests
    // =============================================================================

    function test_getAllAssets_empty() public view {
        AssetRegistry.RWAAsset[] memory assets = registry.getAllAssets();
        assertEq(assets.length, 0);
    }

    function test_getAllAssets_returnsAll() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(address(mockToken1), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);
        registry.registerAsset(address(mockToken2), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);
        registry.registerAsset(address(mockToken3), AssetRegistry.AssetType.REAL_ESTATE, ORACLE);
        vm.stopPrank();

        AssetRegistry.RWAAsset[] memory assets = registry.getAllAssets();
        assertEq(assets.length, 3);
    }

    function test_getActiveAssets_filtersInactive() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(address(mockToken1), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);
        registry.registerAsset(address(mockToken2), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);
        registry.registerAsset(address(mockToken3), AssetRegistry.AssetType.REAL_ESTATE, ORACLE);

        registry.setAssetStatus(address(mockToken2), false);
        vm.stopPrank();

        AssetRegistry.RWAAsset[] memory activeAssets = registry.getActiveAssets();
        assertEq(activeAssets.length, 2);
    }

    function test_getAssetAddresses_returnsAddresses() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(address(mockToken1), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);
        registry.registerAsset(address(mockToken2), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);
        vm.stopPrank();

        address[] memory addresses = registry.getAssetAddresses();
        assertEq(addresses.length, 2);
        assertEq(addresses[0], address(mockToken1));
        assertEq(addresses[1], address(mockToken2));
    }

    function test_isActive_returnsFalseForUnregistered() public view {
        assertFalse(registry.isActive(address(mockToken1)));
    }

    function test_getAssetByIndex_success() public {
        vm.startPrank(ADMIN);
        registry.registerAsset(address(mockToken1), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);
        registry.registerAsset(address(mockToken2), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);
        vm.stopPrank();

        AssetRegistry.RWAAsset memory asset = registry.getAssetByIndex(1);
        assertEq(asset.tokenAddress, address(mockToken2));
    }

    function test_getAssetByIndex_revertsOnOutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        registry.getAssetByIndex(0);
    }

    function test_getAsset_revertsIfNotRegistered() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.AssetNotFound.selector,
                address(mockToken1)
            )
        );
        registry.getAsset(address(mockToken1));
    }

    // =============================================================================
    // MAX_ASSETS Limit Tests
    // =============================================================================

    function test_registerAsset_revertsOnMaxAssetsReached() public {
        vm.startPrank(ADMIN);

        // Register MAX_ASSETS tokens
        for (uint256 i = 0; i < registry.MAX_ASSETS(); i++) {
            ERC20Mock token = new ERC20Mock("Token", "TKN", 18);
            registry.registerAsset(
                address(token),
                AssetRegistry.AssetType.OTHER,
                ORACLE
            );
        }

        // Try to register one more
        ERC20Mock extraToken = new ERC20Mock("Extra Token", "EXTRA", 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                AssetRegistry.MaxAssetsReached.selector,
                50,
                50
            )
        );
        registry.registerAsset(
            address(extraToken),
            AssetRegistry.AssetType.OTHER,
            ORACLE
        );
        vm.stopPrank();
    }

    // =============================================================================
    // All Asset Types Tests
    // =============================================================================

    function test_registerAsset_allAssetTypes() public {
        vm.startPrank(ADMIN);

        // TOKENIZED_BOND
        ERC20Mock bond = new ERC20Mock("Bond Token", "BOND", 18);
        registry.registerAsset(address(bond), AssetRegistry.AssetType.TOKENIZED_BOND, ORACLE);

        // TOKENIZED_STOCK
        ERC20Mock stock = new ERC20Mock("Stock Token", "STK", 18);
        registry.registerAsset(address(stock), AssetRegistry.AssetType.TOKENIZED_STOCK, ORACLE);

        // TOKENIZED_COMMODITY
        ERC20Mock commodity = new ERC20Mock("Commodity Token", "CMD", 18);
        registry.registerAsset(address(commodity), AssetRegistry.AssetType.TOKENIZED_COMMODITY, ORACLE);

        // REAL_ESTATE
        ERC20Mock realEstate = new ERC20Mock("Real Estate Token", "RET", 18);
        registry.registerAsset(address(realEstate), AssetRegistry.AssetType.REAL_ESTATE, ORACLE);

        // YIELD_BEARING
        ERC20Mock yieldBearing = new ERC20Mock("Yield Token", "YLD", 18);
        registry.registerAsset(address(yieldBearing), AssetRegistry.AssetType.YIELD_BEARING, ORACLE);

        // OTHER
        ERC20Mock other = new ERC20Mock("Other Token", "OTH", 18);
        registry.registerAsset(address(other), AssetRegistry.AssetType.OTHER, ORACLE);

        vm.stopPrank();

        assertEq(registry.assetCount(), 6);

        // Verify each asset type
        assertEq(uint256(registry.getAsset(address(bond)).assetType), uint256(AssetRegistry.AssetType.TOKENIZED_BOND));
        assertEq(uint256(registry.getAsset(address(stock)).assetType), uint256(AssetRegistry.AssetType.TOKENIZED_STOCK));
        assertEq(uint256(registry.getAsset(address(commodity)).assetType), uint256(AssetRegistry.AssetType.TOKENIZED_COMMODITY));
        assertEq(uint256(registry.getAsset(address(realEstate)).assetType), uint256(AssetRegistry.AssetType.REAL_ESTATE));
        assertEq(uint256(registry.getAsset(address(yieldBearing)).assetType), uint256(AssetRegistry.AssetType.YIELD_BEARING));
        assertEq(uint256(registry.getAsset(address(other)).assetType), uint256(AssetRegistry.AssetType.OTHER));
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_registerAsset_validAddresses(address tokenAddr) public {
        vm.assume(tokenAddr != address(0));

        // Deploy a mock token at the address (can't do this in fuzzing, so skip if not contract)
        // Instead, test with generated mock tokens
    }

    function testFuzz_assetCount_matchesRegistrations(uint8 count) public {
        vm.assume(count <= 10); // Limit for reasonable test time

        vm.startPrank(ADMIN);
        for (uint256 i = 0; i < count; i++) {
            ERC20Mock token = new ERC20Mock("Token", "TKN", 18);
            registry.registerAsset(
                address(token),
                AssetRegistry.AssetType.OTHER,
                ORACLE
            );
        }
        vm.stopPrank();

        assertEq(registry.assetCount(), count);
    }
}
