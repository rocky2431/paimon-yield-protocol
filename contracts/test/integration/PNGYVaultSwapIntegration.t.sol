// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PNGYVault} from "../../src/PNGYVault.sol";
import {SwapHelper} from "../../src/SwapHelper.sol";
import {AssetRegistry} from "../../src/AssetRegistry.sol";
import {ISwapHelper} from "../../src/interfaces/ISwapHelper.sol";
import {ERC20Mock} from "../mocks/ERC20Mock.sol";
import {MockPancakeRouter} from "../mocks/MockPancakeRouter.sol";
import {MockOracleAdapter} from "../mocks/MockOracleAdapter.sol";

/// @title PNGYVault SwapHelper Integration Tests
/// @notice Tests for deposit/withdraw with automatic RWA token swaps
contract PNGYVaultSwapIntegrationTest is Test {
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
    uint256 public constant MIN_DEPOSIT = 500e18;
    uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%

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

        // Add RWA assets to vault with target allocations (50% each)
        vault.addRWAAsset(address(rwaToken1), 5000); // 50%
        vault.addRWAAsset(address(rwaToken2), 5000); // 50%

        // Set oracle prices (1:1 with USDT)
        oracle.setPrice(address(rwaToken1), 1e18);
        oracle.setPrice(address(rwaToken2), 1e18);
        vm.stopPrank();

        // Setup exchange rates (1:1)
        router.setExchangeRate(address(usdt), address(rwaToken1), 1e18);
        router.setExchangeRate(address(usdt), address(rwaToken2), 1e18);
        router.setExchangeRate(address(rwaToken1), address(usdt), 1e18);
        router.setExchangeRate(address(rwaToken2), address(usdt), 1e18);

        // Fund router with RWA tokens for swaps
        rwaToken1.mint(address(router), INITIAL_BALANCE * 10);
        rwaToken2.mint(address(router), INITIAL_BALANCE * 10);
        usdt.mint(address(router), INITIAL_BALANCE * 10);

        // Fund user with USDT
        usdt.mint(user, INITIAL_BALANCE);

        // User approves vault
        vm.prank(user);
        usdt.approve(address(vault), type(uint256).max);
    }

    // =============================================================================
    // setSwapHelper Tests
    // =============================================================================

    function test_SetSwapHelper_Success() public {
        address newSwapHelper = makeAddr("newSwapHelper");

        vm.prank(admin);
        vault.setSwapHelper(newSwapHelper);

        assertEq(address(vault.swapHelper()), newSwapHelper);
    }

    function test_SetSwapHelper_EmitsEvent() public {
        address newSwapHelper = makeAddr("newSwapHelper");

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit PNGYVault.SwapHelperUpdated(address(swapHelper), newSwapHelper);
        vault.setSwapHelper(newSwapHelper);
    }

    function test_SetSwapHelper_RevertIf_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setSwapHelper(makeAddr("newSwapHelper"));
    }

    // =============================================================================
    // setDefaultSwapSlippage Tests
    // =============================================================================

    function test_SetDefaultSwapSlippage_Success() public {
        uint256 newSlippage = 150; // 1.5%

        vm.prank(admin);
        vault.setDefaultSwapSlippage(newSlippage);

        assertEq(vault.defaultSwapSlippage(), newSlippage);
    }

    function test_SetDefaultSwapSlippage_RevertIf_TooHigh() public {
        vm.prank(admin);
        vm.expectRevert();
        vault.setDefaultSwapSlippage(300); // 3% exceeds max 2%
    }

    // =============================================================================
    // Deposit with RWA Purchase Tests
    // =============================================================================

    function test_Deposit_PurchasesRWATokens() public {
        uint256 depositAmount = 1000e18;

        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Check user received shares
        assertGt(vault.balanceOf(user), 0);

        // Check vault holds RWA tokens (50% each allocation)
        // With 1000 USDT, should buy ~500 of each RWA token
        uint256 rwa1Balance = rwaToken1.balanceOf(address(vault));
        uint256 rwa2Balance = rwaToken2.balanceOf(address(vault));

        assertGt(rwa1Balance, 0, "Should have RWA1 tokens");
        assertGt(rwa2Balance, 0, "Should have RWA2 tokens");
    }

    function test_Deposit_AllocatesAccordingToTargets() public {
        uint256 depositAmount = 1000e18;

        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 rwa1Balance = rwaToken1.balanceOf(address(vault));
        uint256 rwa2Balance = rwaToken2.balanceOf(address(vault));

        // With 50%/50% allocation, balances should be roughly equal
        // Allow 1% tolerance for slippage
        uint256 diff = rwa1Balance > rwa2Balance
            ? rwa1Balance - rwa2Balance
            : rwa2Balance - rwa1Balance;
        uint256 tolerance = depositAmount / 100; // 1%

        assertLt(diff, tolerance, "Allocations should be roughly equal");
    }

    function test_Deposit_WorksWithNoRWAAssets() public {
        // Remove all RWA assets
        vm.startPrank(admin);
        vault.removeRWAAsset(address(rwaToken1));
        vault.removeRWAAsset(address(rwaToken2));
        vm.stopPrank();

        uint256 depositAmount = 1000e18;

        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Should just hold USDT
        assertEq(usdt.balanceOf(address(vault)), depositAmount);
        assertGt(vault.balanceOf(user), 0);
    }

    function test_Deposit_WorksWithoutSwapHelper() public {
        // Remove swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        uint256 depositAmount = 1000e18;

        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Should just hold USDT (no swaps)
        assertEq(usdt.balanceOf(address(vault)), depositAmount);
    }

    function test_Deposit_HandlesSlippageError() public {
        // Set high slippage that will cause failure
        router.setSimulatedSlippage(300); // 3% slippage, exceeds 2% max

        uint256 depositAmount = 1000e18;

        // Should revert due to slippage
        vm.prank(user);
        vm.expectRevert();
        vault.deposit(depositAmount, user);
    }

    // =============================================================================
    // Withdraw with RWA Sale Tests
    // =============================================================================

    function test_Withdraw_SellsRWATokens() public {
        // First deposit
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 sharesBefore = vault.balanceOf(user);
        uint256 withdrawAmount = 500e18;

        // Withdraw
        vm.prank(user);
        vault.withdraw(withdrawAmount, user, user);

        // User should have received USDT
        assertGt(usdt.balanceOf(user), INITIAL_BALANCE - depositAmount);

        // User shares should have decreased
        assertLt(vault.balanceOf(user), sharesBefore);
    }

    function test_Withdraw_SellsProportionalRWA() public {
        // First deposit
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 rwa1Before = rwaToken1.balanceOf(address(vault));
        uint256 rwa2Before = rwaToken2.balanceOf(address(vault));

        // Withdraw 50%
        uint256 withdrawAmount = 500e18;
        vm.prank(user);
        vault.withdraw(withdrawAmount, user, user);

        uint256 rwa1After = rwaToken1.balanceOf(address(vault));
        uint256 rwa2After = rwaToken2.balanceOf(address(vault));

        // Should have sold roughly 50% of each RWA
        assertLt(rwa1After, rwa1Before, "Should have sold some RWA1");
        assertLt(rwa2After, rwa2Before, "Should have sold some RWA2");
    }

    function test_Withdraw_WorksWithOnlyUSDT() public {
        // Remove swap helper so deposit doesn't buy RWA
        vm.prank(admin);
        vault.setSwapHelper(address(0));

        // Deposit (only USDT)
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Re-enable swap helper
        vm.prank(admin);
        vault.setSwapHelper(address(swapHelper));

        // Withdraw (should work with just USDT)
        uint256 withdrawAmount = 500e18;
        vm.prank(user);
        vault.withdraw(withdrawAmount, user, user);

        assertGt(usdt.balanceOf(user), INITIAL_BALANCE - depositAmount);
    }

    // =============================================================================
    // Redeem with RWA Sale Tests
    // =============================================================================

    function test_Redeem_SellsRWATokens() public {
        // First deposit
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        uint256 shares = vault.balanceOf(user);
        uint256 redeemShares = shares / 2;

        // Redeem half
        vm.prank(user);
        vault.redeem(redeemShares, user, user);

        // User should have received USDT
        assertGt(usdt.balanceOf(user), INITIAL_BALANCE - depositAmount);
    }

    // =============================================================================
    // Edge Cases
    // =============================================================================

    function test_Deposit_WithZeroAllocation() public {
        // Set one asset to 0% allocation
        vm.prank(admin);
        vault.updateTargetAllocation(address(rwaToken2), 0);

        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Should only buy RWA1
        assertGt(rwaToken1.balanceOf(address(vault)), 0);
        assertEq(rwaToken2.balanceOf(address(vault)), 0);
    }

    function test_Withdraw_InsufficientLiquidity() public {
        // Deposit first
        uint256 depositAmount = 1000e18;
        vm.prank(user);
        vault.deposit(depositAmount, user);

        // Drain router's USDT (simulate no liquidity)
        uint256 routerBalance = usdt.balanceOf(address(router));
        vm.prank(address(router));
        usdt.transfer(makeAddr("drain"), routerBalance);

        // Withdraw should fail
        vm.prank(user);
        vm.expectRevert();
        vault.withdraw(500e18, user, user);
    }

    // =============================================================================
    // Gas Optimization Tests
    // =============================================================================

    function test_Deposit_GasUsage() public {
        uint256 depositAmount = 1000e18;

        uint256 gasBefore = gasleft();
        vm.prank(user);
        vault.deposit(depositAmount, user);
        uint256 gasUsed = gasBefore - gasleft();

        // Log gas usage for analysis
        console2.log("Deposit with RWA purchase gas used:", gasUsed);

        // Should be reasonable (< 500K for 2 swaps)
        assertLt(gasUsed, 500_000, "Gas usage too high");
    }
}
