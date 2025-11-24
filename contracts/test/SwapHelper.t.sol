// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SwapHelper} from "../src/SwapHelper.sol";
import {ISwapHelper} from "../src/interfaces/ISwapHelper.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";
import {MockPancakeRouter} from "./mocks/MockPancakeRouter.sol";

/// @title SwapHelper Unit Tests
/// @notice Comprehensive tests for SwapHelper DEX integration
contract SwapHelperTest is Test {
    // =============================================================================
    // State
    // =============================================================================

    SwapHelper public swapHelper;
    MockPancakeRouter public router;
    ERC20Mock public tokenA;
    ERC20Mock public tokenB;
    ERC20Mock public rwaToken;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");

    uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%
    uint256 public constant MAX_SLIPPAGE = 200; // 2%
    uint256 public constant INITIAL_BALANCE = 1000 ether;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Deploy mock tokens
        tokenA = new ERC20Mock("Token A", "TKA", 18);
        tokenB = new ERC20Mock("Token B", "TKB", 18);
        rwaToken = new ERC20Mock("RWA Token", "RWA", 18);

        // Deploy mock router
        router = new MockPancakeRouter();

        // Deploy SwapHelper
        vm.prank(admin);
        swapHelper = new SwapHelper(address(router), admin, DEFAULT_SLIPPAGE);

        // Setup exchange rates (1:1 default)
        router.setExchangeRate(address(tokenA), address(tokenB), 1e18);
        router.setExchangeRate(address(tokenB), address(tokenA), 1e18);
        router.setExchangeRate(address(tokenA), address(rwaToken), 1e18);
        router.setExchangeRate(address(rwaToken), address(tokenA), 1e18);

        // Fund user with tokens
        tokenA.mint(user, INITIAL_BALANCE);
        tokenB.mint(user, INITIAL_BALANCE);
        rwaToken.mint(user, INITIAL_BALANCE);

        // Fund router with tokens for swap outputs
        tokenA.mint(address(router), INITIAL_BALANCE * 10);
        tokenB.mint(address(router), INITIAL_BALANCE * 10);
        rwaToken.mint(address(router), INITIAL_BALANCE * 10);

        // Approve SwapHelper to spend user tokens
        vm.startPrank(user);
        tokenA.approve(address(swapHelper), type(uint256).max);
        tokenB.approve(address(swapHelper), type(uint256).max);
        rwaToken.approve(address(swapHelper), type(uint256).max);
        vm.stopPrank();
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_Constructor_SetsStateCorrectly() public view {
        assertEq(swapHelper.router(), address(router));
        assertEq(swapHelper.defaultMaxSlippage(), DEFAULT_SLIPPAGE);
        assertTrue(swapHelper.hasRole(swapHelper.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(swapHelper.hasRole(swapHelper.ADMIN_ROLE(), admin));
    }

    function test_Constructor_RevertIf_ZeroRouter() public {
        vm.expectRevert(ISwapHelper.ZeroAddress.selector);
        new SwapHelper(address(0), admin, DEFAULT_SLIPPAGE);
    }

    function test_Constructor_RevertIf_ZeroAdmin() public {
        vm.expectRevert(ISwapHelper.ZeroAddress.selector);
        new SwapHelper(address(router), address(0), DEFAULT_SLIPPAGE);
    }

    function test_Constructor_RevertIf_SlippageTooHigh() public {
        vm.expectRevert(
            abi.encodeWithSelector(ISwapHelper.SlippageTooHigh.selector, 300, MAX_SLIPPAGE)
        );
        new SwapHelper(address(router), admin, 300);
    }

    // =============================================================================
    // buyRWAAsset Tests
    // =============================================================================

    function test_BuyRWAAsset_Success() public {
        uint256 amountIn = 100 ether;

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        assertEq(amountOut, amountIn); // 1:1 rate
        assertEq(tokenA.balanceOf(user), INITIAL_BALANCE - amountIn);
        assertEq(rwaToken.balanceOf(user), INITIAL_BALANCE + amountOut);
    }

    function test_BuyRWAAsset_UsesDefaultSlippage() public {
        uint256 amountIn = 100 ether;

        // Set small slippage in router
        router.setSimulatedSlippage(50); // 0.5%

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            0 // Use default
        );

        // Should succeed with default 1% slippage tolerance
        assertGt(amountOut, 0);
    }

    function test_BuyRWAAsset_RevertIf_ZeroTokenIn() public {
        vm.prank(user);
        vm.expectRevert(ISwapHelper.ZeroAddress.selector);
        swapHelper.buyRWAAsset(address(0), address(rwaToken), 100 ether, DEFAULT_SLIPPAGE);
    }

    function test_BuyRWAAsset_RevertIf_ZeroTokenOut() public {
        vm.prank(user);
        vm.expectRevert(ISwapHelper.ZeroAddress.selector);
        swapHelper.buyRWAAsset(address(tokenA), address(0), 100 ether, DEFAULT_SLIPPAGE);
    }

    function test_BuyRWAAsset_RevertIf_ZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(ISwapHelper.ZeroInputAmount.selector);
        swapHelper.buyRWAAsset(address(tokenA), address(rwaToken), 0, DEFAULT_SLIPPAGE);
    }

    function test_BuyRWAAsset_RevertIf_SlippageTooHigh() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ISwapHelper.SlippageTooHigh.selector, 300, MAX_SLIPPAGE)
        );
        swapHelper.buyRWAAsset(address(tokenA), address(rwaToken), 100 ether, 300);
    }

    // =============================================================================
    // sellRWAAsset Tests
    // =============================================================================

    function test_SellRWAAsset_Success() public {
        uint256 amountIn = 100 ether;

        vm.prank(user);
        uint256 amountOut = swapHelper.sellRWAAsset(
            address(rwaToken),
            address(tokenA),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        assertEq(amountOut, amountIn); // 1:1 rate
        assertEq(rwaToken.balanceOf(user), INITIAL_BALANCE - amountIn);
        assertEq(tokenA.balanceOf(user), INITIAL_BALANCE + amountOut);
    }

    function test_SellRWAAsset_WithCustomRate() public {
        uint256 amountIn = 100 ether;
        uint256 rate = 2e18; // 1 RWA = 2 tokenA

        router.setExchangeRate(address(rwaToken), address(tokenA), rate);

        vm.prank(user);
        uint256 amountOut = swapHelper.sellRWAAsset(
            address(rwaToken),
            address(tokenA),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        assertEq(amountOut, 200 ether); // 100 * 2 = 200
    }

    function test_SellRWAAsset_RevertIf_ZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(ISwapHelper.ZeroInputAmount.selector);
        swapHelper.sellRWAAsset(address(rwaToken), address(tokenA), 0, DEFAULT_SLIPPAGE);
    }

    // =============================================================================
    // Slippage Protection Tests
    // =============================================================================

    function test_SlippageProtection_WithinLimits() public {
        uint256 amountIn = 100 ether;

        // Simulate 0.5% slippage (within 1% tolerance)
        router.setSimulatedSlippage(50);

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        // Output should be 99.5 ether (100 * 0.995)
        assertEq(amountOut, 99.5 ether);
    }

    function test_SlippageProtection_AtMaxLimit() public {
        uint256 amountIn = 100 ether;

        // Simulate exactly 1% slippage (at limit)
        router.setSimulatedSlippage(100);

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        // Output should be 99 ether (100 * 0.99)
        assertEq(amountOut, 99 ether);
    }

    function test_SlippageProtection_RevertIf_ExceedsLimit() public {
        uint256 amountIn = 100 ether;

        // Simulate 1.5% slippage (exceeds 1% tolerance)
        router.setSimulatedSlippage(150);

        vm.prank(user);
        vm.expectRevert("Slippage exceeded");
        swapHelper.buyRWAAsset(address(tokenA), address(rwaToken), amountIn, DEFAULT_SLIPPAGE);
    }

    function test_SlippageProtection_WithMaxAllowedSlippage() public {
        uint256 amountIn = 100 ether;

        // Simulate 1.5% slippage with 2% tolerance
        router.setSimulatedSlippage(150);

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            MAX_SLIPPAGE // 2%
        );

        // Output should be 98.5 ether (100 * 0.985)
        assertEq(amountOut, 98.5 ether);
    }

    // =============================================================================
    // getAmountOut Tests
    // =============================================================================

    function test_GetAmountOut_Returns_ExpectedAmount() public view {
        uint256 amountIn = 100 ether;

        uint256 amountOut = swapHelper.getAmountOut(
            address(tokenA),
            address(tokenB),
            amountIn
        );

        assertEq(amountOut, amountIn); // 1:1 rate
    }

    function test_GetAmountOut_WithCustomRate() public {
        uint256 amountIn = 100 ether;
        uint256 rate = 15e17; // 1.5x

        router.setExchangeRate(address(tokenA), address(tokenB), rate);

        uint256 amountOut = swapHelper.getAmountOut(
            address(tokenA),
            address(tokenB),
            amountIn
        );

        assertEq(amountOut, 150 ether); // 100 * 1.5
    }

    function test_GetAmountOut_ReturnsZero_ForZeroInput() public view {
        uint256 amountOut = swapHelper.getAmountOut(address(tokenA), address(tokenB), 0);
        assertEq(amountOut, 0);
    }

    // =============================================================================
    // Admin Functions Tests
    // =============================================================================

    function test_SetRouter_Success() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(admin);
        swapHelper.setRouter(newRouter);

        assertEq(swapHelper.router(), newRouter);
    }

    function test_SetRouter_EmitsEvent() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit ISwapHelper.RouterUpdated(address(router), newRouter);
        swapHelper.setRouter(newRouter);
    }

    function test_SetRouter_RevertIf_NotAdmin() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(user);
        vm.expectRevert();
        swapHelper.setRouter(newRouter);
    }

    function test_SetRouter_RevertIf_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ISwapHelper.ZeroAddress.selector);
        swapHelper.setRouter(address(0));
    }

    function test_SetDefaultMaxSlippage_Success() public {
        uint256 newSlippage = 150; // 1.5%

        vm.prank(admin);
        swapHelper.setDefaultMaxSlippage(newSlippage);

        assertEq(swapHelper.defaultMaxSlippage(), newSlippage);
    }

    function test_SetDefaultMaxSlippage_EmitsEvent() public {
        uint256 newSlippage = 150;

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit ISwapHelper.MaxSlippageUpdated(DEFAULT_SLIPPAGE, newSlippage);
        swapHelper.setDefaultMaxSlippage(newSlippage);
    }

    function test_SetDefaultMaxSlippage_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        swapHelper.setDefaultMaxSlippage(150);
    }

    function test_SetDefaultMaxSlippage_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(ISwapHelper.SlippageTooHigh.selector, 300, MAX_SLIPPAGE)
        );
        swapHelper.setDefaultMaxSlippage(300);
    }

    // =============================================================================
    // Router Failure Tests
    // =============================================================================

    function test_Swap_RevertIf_RouterFails() public {
        router.setFailNextSwap(true);

        vm.prank(user);
        vm.expectRevert("Swap failed");
        swapHelper.buyRWAAsset(address(tokenA), address(rwaToken), 100 ether, DEFAULT_SLIPPAGE);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_BuyRWAAsset(uint256 amountIn) public {
        amountIn = bound(amountIn, 1, INITIAL_BALANCE);

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            DEFAULT_SLIPPAGE
        );

        assertEq(amountOut, amountIn); // 1:1 rate
    }

    function testFuzz_SlippageBounds(uint256 slippage) public {
        slippage = bound(slippage, 1, MAX_SLIPPAGE);
        uint256 amountIn = 100 ether;

        vm.prank(user);
        uint256 amountOut = swapHelper.buyRWAAsset(
            address(tokenA),
            address(rwaToken),
            amountIn,
            slippage
        );

        assertGt(amountOut, 0);
    }
}
