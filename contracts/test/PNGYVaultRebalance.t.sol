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

/// @title PNGYVault Rebalance Tests
/// @notice Comprehensive tests for rebalance function
contract PNGYVaultRebalanceTest is Test {
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
    ERC20Mock public rwaToken3;

    address public admin = makeAddr("admin");
    address public rebalancer = makeAddr("rebalancer");
    address public user = makeAddr("user");

    uint256 public constant INITIAL_BALANCE = 1_000_000e18;
    uint256 public constant MIN_DEPOSIT = 500e18;
    uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Warp to reasonable timestamp
        vm.warp(1700000000);

        // Deploy mock tokens
        usdt = new ERC20Mock("USDT", "USDT", 18);
        rwaToken1 = new ERC20Mock("RWA Bond", "RWAB", 18);
        rwaToken2 = new ERC20Mock("RWA Stock", "RWAS", 18);
        rwaToken3 = new ERC20Mock("RWA REIT", "RWAR", 18);

        // Deploy mock router
        router = new MockPancakeRouter();

        // Deploy SwapHelper
        vm.prank(admin);
        swapHelper = new SwapHelper(address(router), admin, DEFAULT_SLIPPAGE);

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

        // Grant rebalancer role
        vault.grantRole(REBALANCER_ROLE, rebalancer);

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
        registry.registerAsset(
            address(rwaToken3),
            AssetRegistry.AssetType.REAL_ESTATE,
            address(oracle)
        );

        // Add RWA assets to vault
        vault.addRWAAsset(address(rwaToken1), 4000); // 40%
        vault.addRWAAsset(address(rwaToken2), 3500); // 35%
        vault.addRWAAsset(address(rwaToken3), 2500); // 25%

        // Set oracle prices
        oracle.setPrice(address(rwaToken1), 1e18);  // $1
        oracle.setPrice(address(rwaToken2), 2e18);  // $2
        oracle.setPrice(address(rwaToken3), 10e18); // $10
        vm.stopPrank();

        // Setup exchange rates
        router.setExchangeRate(address(usdt), address(rwaToken1), 1e18);
        router.setExchangeRate(address(usdt), address(rwaToken2), 0.5e18); // 2 USDT = 1 RWA2
        router.setExchangeRate(address(usdt), address(rwaToken3), 0.1e18); // 10 USDT = 1 RWA3
        router.setExchangeRate(address(rwaToken1), address(usdt), 1e18);
        router.setExchangeRate(address(rwaToken2), address(usdt), 2e18);
        router.setExchangeRate(address(rwaToken3), address(usdt), 10e18);

        // Fund router with tokens
        usdt.mint(address(router), INITIAL_BALANCE * 100);
        rwaToken1.mint(address(router), INITIAL_BALANCE * 100);
        rwaToken2.mint(address(router), INITIAL_BALANCE * 100);
        rwaToken3.mint(address(router), INITIAL_BALANCE * 100);

        // Fund user and deposit to create initial holdings
        usdt.mint(user, INITIAL_BALANCE);
        vm.prank(user);
        usdt.approve(address(vault), type(uint256).max);

        // Initial deposit to create RWA positions
        vm.prank(user);
        vault.deposit(10_000e18, user);

        // Fund vault with extra RWA tokens for testing
        rwaToken1.mint(address(vault), 5000e18);
        rwaToken2.mint(address(vault), 2500e18);
        rwaToken3.mint(address(vault), 500e18);

        // Approve swap helper for vault
        vm.startPrank(address(vault));
        rwaToken1.approve(address(swapHelper), type(uint256).max);
        rwaToken2.approve(address(swapHelper), type(uint256).max);
        rwaToken3.approve(address(swapHelper), type(uint256).max);
        usdt.approve(address(swapHelper), type(uint256).max);
        vm.stopPrank();
    }

    // =============================================================================
    // Rebalance Success Tests
    // =============================================================================

    function test_Rebalance_SellAndBuy_Success() public {
        // Prepare sell and buy arrays
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 1000e18;

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken2);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 1000e18; // USDT to spend

        uint256 rwa1Before = rwaToken1.balanceOf(address(vault));
        uint256 rwa2Before = rwaToken2.balanceOf(address(vault));

        vm.prank(rebalancer);
        (uint256[] memory sellReceived, uint256[] memory buyReceived) = vault.rebalance(
            sellAssets,
            sellAmounts,
            buyAssets,
            buyAmounts
        );

        // Verify sell
        assertEq(rwaToken1.balanceOf(address(vault)), rwa1Before - sellAmounts[0]);
        assertGt(sellReceived[0], 0, "Should receive USDT from sell");

        // Verify buy
        assertGt(rwaToken2.balanceOf(address(vault)), rwa2Before, "Should have more RWA2");
        assertGt(buyReceived[0], 0, "Should receive RWA2 tokens");
    }

    function test_Rebalance_SellOnly_Success() public {
        address[] memory sellAssets = new address[](2);
        sellAssets[0] = address(rwaToken1);
        sellAssets[1] = address(rwaToken2);

        uint256[] memory sellAmounts = new uint256[](2);
        sellAmounts[0] = 500e18;
        sellAmounts[1] = 250e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        uint256 usdtBefore = usdt.balanceOf(address(vault));

        vm.prank(rebalancer);
        (uint256[] memory sellReceived, ) = vault.rebalance(
            sellAssets,
            sellAmounts,
            buyAssets,
            buyAmounts
        );

        assertGt(usdt.balanceOf(address(vault)), usdtBefore, "Should have more USDT");
        assertEq(sellReceived.length, 2, "Should have 2 sell results");
    }

    function test_Rebalance_BuyOnly_Success() public {
        // First ensure vault has USDT
        usdt.mint(address(vault), 5000e18);

        address[] memory sellAssets = new address[](0);
        uint256[] memory sellAmounts = new uint256[](0);

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken3);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 1000e18;

        uint256 rwa3Before = rwaToken3.balanceOf(address(vault));

        vm.prank(rebalancer);
        (, uint256[] memory buyReceived) = vault.rebalance(
            sellAssets,
            sellAmounts,
            buyAssets,
            buyAmounts
        );

        assertGt(rwaToken3.balanceOf(address(vault)), rwa3Before, "Should have more RWA3");
        assertGt(buyReceived[0], 0, "Should receive RWA3 tokens");
    }

    function test_Rebalance_EmitsEvent() public {
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken2);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 100e18;

        vm.prank(rebalancer);
        vm.expectEmit(false, false, false, false); // Just check event is emitted
        emit PNGYVault.RebalanceExecuted(
            sellAssets, sellAmounts, new uint256[](1),
            buyAssets, buyAmounts, new uint256[](1),
            block.timestamp
        );
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_UpdatesTargetAllocation() public {
        address[] memory sellAssets = new address[](0);
        uint256[] memory sellAmounts = new uint256[](0);
        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        uint256[] memory newAllocations = new uint256[](3);
        newAllocations[0] = 5000; // 50%
        newAllocations[1] = 3000; // 30%
        newAllocations[2] = 2000; // 20%

        vm.prank(rebalancer);
        vault.rebalanceWithNewAllocations(
            sellAssets,
            sellAmounts,
            buyAssets,
            buyAmounts,
            newAllocations
        );

        // Verify allocations updated
        PNGYVault.RWAHolding[] memory holdings = vault.getRWAHoldings();
        assertEq(holdings[0].targetAllocation, 5000);
        assertEq(holdings[1].targetAllocation, 3000);
        assertEq(holdings[2].targetAllocation, 2000);
    }

    // =============================================================================
    // Access Control Tests
    // =============================================================================

    function test_Rebalance_RevertIf_NotRebalancer() public {
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(user);
        vm.expectRevert();
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_WorksWith_AdminRole() public {
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        // Admin also has rebalancer role
        vm.prank(admin);
        (uint256[] memory sellReceived, ) = vault.rebalance(
            sellAssets, sellAmounts, buyAssets, buyAmounts
        );
        assertGt(sellReceived[0], 0);
    }

    // =============================================================================
    // Validation Tests
    // =============================================================================

    function test_Rebalance_RevertIf_ArrayLengthMismatch_Sell() public {
        address[] memory sellAssets = new address[](2);
        sellAssets[0] = address(rwaToken1);
        sellAssets[1] = address(rwaToken2);

        uint256[] memory sellAmounts = new uint256[](1); // Mismatch!
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.ArrayLengthMismatch.selector);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_ArrayLengthMismatch_Buy() public {
        address[] memory sellAssets = new address[](0);
        uint256[] memory sellAmounts = new uint256[](0);

        address[] memory buyAssets = new address[](2);
        buyAssets[0] = address(rwaToken1);
        buyAssets[1] = address(rwaToken2);

        uint256[] memory buyAmounts = new uint256[](1); // Mismatch!
        buyAmounts[0] = 100e18;

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.ArrayLengthMismatch.selector);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_ZeroSellAmount() public {
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 0; // Zero!

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_ZeroBuyAmount() public {
        address[] memory sellAssets = new address[](0);
        uint256[] memory sellAmounts = new uint256[](0);

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken1);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 0; // Zero!

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_InsufficientBalance() public {
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 999_999_999e18; // Way more than vault has

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(); // Will revert due to insufficient balance
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_AssetNotInHoldings() public {
        ERC20Mock unknownToken = new ERC20Mock("Unknown", "UNK", 18);

        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(unknownToken);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(PNGYVault.RWAAssetNotFound.selector, address(unknownToken)));
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_NoSwapHelper() public {
        // Remove swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert(PNGYVault.NotConfigured.selector);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    function test_Rebalance_RevertIf_Paused() public {
        vm.prank(admin);
        vault.pause();

        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;

        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vm.expectRevert();
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
    }

    // =============================================================================
    // Integration with RebalanceStrategy
    // =============================================================================

    function test_Rebalance_MultipleAssetsComplex() public {
        // Complex rebalance: sell 2 assets, buy 1
        address[] memory sellAssets = new address[](2);
        sellAssets[0] = address(rwaToken1);
        sellAssets[1] = address(rwaToken2);

        uint256[] memory sellAmounts = new uint256[](2);
        sellAmounts[0] = 200e18;
        sellAmounts[1] = 100e18;

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaToken3);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 300e18; // Use USDT from sells

        uint256 rwa1Before = rwaToken1.balanceOf(address(vault));
        uint256 rwa2Before = rwaToken2.balanceOf(address(vault));
        uint256 rwa3Before = rwaToken3.balanceOf(address(vault));

        vm.prank(rebalancer);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);

        assertEq(rwaToken1.balanceOf(address(vault)), rwa1Before - 200e18);
        assertEq(rwaToken2.balanceOf(address(vault)), rwa2Before - 100e18);
        assertGt(rwaToken3.balanceOf(address(vault)), rwa3Before);
    }

    // =============================================================================
    // Cache Invalidation Tests
    // =============================================================================

    function test_Rebalance_InvalidatesCache() public {
        // Refresh cache first
        vm.prank(admin);
        vault.refreshRWACache();

        (, uint256 timestampBefore, bool isFreshBefore) = vault.getCachedRWAValue();
        assertTrue(isFreshBefore, "Cache should be fresh before rebalance");

        // Execute rebalance
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaToken1);
        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 100e18;
        address[] memory buyAssets = new address[](0);
        uint256[] memory buyAmounts = new uint256[](0);

        vm.prank(rebalancer);
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);

        // Cache should be invalidated
        (, uint256 timestampAfter, bool isFreshAfter) = vault.getCachedRWAValue();
        assertEq(timestampAfter, 0, "Cache timestamp should be reset");
        assertFalse(isFreshAfter, "Cache should not be fresh after rebalance");
    }
}
