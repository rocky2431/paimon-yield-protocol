// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {PNGYVault} from "../src/PNGYVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockUSDT
/// @notice Mock USDT token for testing
contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

/// @title PNGYVaultTest
/// @notice Comprehensive tests for PNGYVault contract
contract PNGYVaultTest is BaseTest {
    // =============================================================================
    // State
    // =============================================================================

    PNGYVault public vault;
    MockUSDT public usdt;

    // Role hashes
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public override {
        super.setUp();

        // Deploy mock USDT
        usdt = new MockUSDT();

        // Deploy vault with admin
        vault = new PNGYVault(IERC20(address(usdt)), admin);

        // Mint USDT to test users
        usdt.mint(alice, INITIAL_BALANCE);
        usdt.mint(bob, INITIAL_BALANCE);
        usdt.mint(charlie, INITIAL_BALANCE);

        // Approve vault for all users
        vm.prank(alice);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(charlie);
        usdt.approve(address(vault), type(uint256).max);
    }

    // =============================================================================
    // Constructor Tests
    // =============================================================================

    function test_constructor_setsAsset() public view {
        assertEq(vault.asset(), address(usdt));
    }

    function test_constructor_setsName() public view {
        assertEq(vault.name(), "Paimon Yield Token");
    }

    function test_constructor_setsSymbol() public view {
        assertEq(vault.symbol(), "PNGY");
    }

    function test_constructor_grantsRoles() public view {
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(ADMIN_ROLE, admin));
        assertTrue(vault.hasRole(REBALANCER_ROLE, admin));
    }

    function test_constructor_revertsZeroAdmin() public {
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        new PNGYVault(IERC20(address(usdt)), address(0));
    }

    // =============================================================================
    // Deposit Tests
    // =============================================================================

    function test_deposit_success() public {
        uint256 depositAmount = MIN_DEPOSIT;

        vm.prank(alice);
        uint256 shares = vault.deposit(depositAmount, alice);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(usdt.balanceOf(address(vault)), depositAmount);
    }

    function test_deposit_emitsEvent() public {
        uint256 depositAmount = MIN_DEPOSIT;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PNGYVault.DepositProcessed(alice, alice, depositAmount, depositAmount);
        vault.deposit(depositAmount, alice);
    }

    function test_deposit_revertsWhenBelowMinimum() public {
        uint256 depositAmount = MIN_DEPOSIT - 1;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.DepositBelowMinimum.selector,
                depositAmount,
                MIN_DEPOSIT
            )
        );
        vault.deposit(depositAmount, alice);
    }

    function test_deposit_revertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(MIN_DEPOSIT, alice);
    }

    function test_deposit_revertsZeroReceiver() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        vault.deposit(MIN_DEPOSIT, address(0));
    }

    function test_deposit_differentReceiver() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, bob);

        assertEq(vault.balanceOf(bob), shares);
        assertEq(vault.balanceOf(alice), 0);
    }

    // =============================================================================
    // Mint Tests
    // =============================================================================

    function test_mint_success() public {
        uint256 sharesToMint = MIN_DEPOSIT;

        vm.prank(alice);
        uint256 assets = vault.mint(sharesToMint, alice);

        assertGt(assets, 0);
        assertEq(vault.balanceOf(alice), sharesToMint);
    }

    function test_mint_revertsZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.mint(0, alice);
    }

    function test_mint_revertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert();
        vault.mint(MIN_DEPOSIT, alice);
    }

    // =============================================================================
    // Withdraw Tests
    // =============================================================================

    function test_withdraw_success() public {
        // First deposit
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        // Then withdraw
        vm.prank(alice);
        uint256 shares = vault.withdraw(MIN_DEPOSIT, alice, alice);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_withdraw_emitsEvent() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit PNGYVault.WithdrawProcessed(alice, alice, alice, MIN_DEPOSIT, MIN_DEPOSIT);
        vault.withdraw(MIN_DEPOSIT, alice, alice);
    }

    function test_withdraw_revertsExceedsMaximum() public {
        uint256 withdrawAmount = vault.MAX_WITHDRAWAL() + 1;
        uint256 largeDeposit = withdrawAmount + MIN_DEPOSIT;
        usdt.mint(alice, largeDeposit);
        vm.prank(alice);
        usdt.approve(address(vault), largeDeposit);

        vm.prank(alice);
        vault.deposit(largeDeposit, alice);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.WithdrawalExceedsMaximum.selector,
                withdrawAmount,
                vault.MAX_WITHDRAWAL()
            )
        );
        vault.withdraw(withdrawAmount, alice, alice);
    }

    function test_withdraw_revertsWhenPaused() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert(PNGYVault.VaultPaused.selector);
        vault.withdraw(MIN_DEPOSIT, alice, alice);
    }

    function test_withdraw_worksWhenPausedWithEmergency() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();

        vm.prank(admin);
        vault.setEmergencyWithdraw(true);

        vm.prank(alice);
        vault.withdraw(MIN_DEPOSIT, alice, alice);

        assertEq(vault.balanceOf(alice), 0);
    }

    function test_withdraw_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.withdraw(0, alice, alice);
    }

    // =============================================================================
    // Redeem Tests
    // =============================================================================

    function test_redeem_success() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);

        assertGt(assets, 0);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_redeem_revertsZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.redeem(0, alice, alice);
    }

    function test_redeem_revertsWhenPaused() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert(PNGYVault.VaultPaused.selector);
        vault.redeem(shares, alice, alice);
    }

    // =============================================================================
    // Admin Functions Tests
    // =============================================================================

    function test_pause_onlyAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.pause();

        vm.prank(admin);
        vault.pause();
        assertTrue(vault.paused());
    }

    function test_unpause_onlyAdmin() public {
        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert();
        vault.unpause();

        vm.prank(admin);
        vault.unpause();
        assertFalse(vault.paused());
    }

    function test_updateManagedAssets_success() public {
        uint256 newAssets = 1_000_000e18;

        vm.prank(admin);
        vault.updateManagedAssets(newAssets);

        assertEq(vault.managedAssets(), newAssets);
    }

    function test_updateManagedAssets_emitsEvent() public {
        uint256 newAssets = 1_000_000e18;
        uint256 oldNav = vault.totalAssets();

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit PNGYVault.NavUpdated(oldNav, newAssets, block.timestamp);
        vault.updateManagedAssets(newAssets);
    }

    function test_updateManagedAssets_onlyRebalancer() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.updateManagedAssets(1_000_000e18);
    }

    function test_setEmergencyWithdraw_success() public {
        vm.prank(admin);
        vault.setEmergencyWithdraw(true);

        assertTrue(vault.emergencyWithdrawEnabled());
    }

    function test_setEmergencyWithdraw_emitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit PNGYVault.EmergencyModeChanged(true);
        vault.setEmergencyWithdraw(true);
    }

    function test_setEmergencyWithdraw_onlyAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setEmergencyWithdraw(true);
    }

    // =============================================================================
    // View Functions Tests
    // =============================================================================

    function test_totalAssets_includesManagedAssets() public {
        uint256 depositAmount = MIN_DEPOSIT;
        uint256 managedAmount = 1_000_000e18;

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vm.prank(admin);
        vault.updateManagedAssets(managedAmount);

        assertEq(vault.totalAssets(), depositAmount + managedAmount);
    }

    function test_sharePrice_initialPrice() public view {
        assertEq(vault.sharePrice(), vault.PRECISION());
    }

    function test_sharePrice_afterDeposit() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        // Share price should be 1:1 initially
        assertEq(vault.sharePrice(), vault.PRECISION());
    }

    function test_sharePrice_afterYieldAccrual() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        // Simulate yield by adding managed assets
        vm.prank(admin);
        vault.updateManagedAssets(MIN_DEPOSIT); // Double the total assets

        // Share price should be ~2x
        assertGt(vault.sharePrice(), vault.PRECISION());
    }

    function test_maxDeposit_whenPaused() public {
        vm.prank(admin);
        vault.pause();

        assertEq(vault.maxDeposit(alice), 0);
    }

    function test_maxMint_whenPaused() public {
        vm.prank(admin);
        vault.pause();

        assertEq(vault.maxMint(alice), 0);
    }

    function test_maxWithdraw_whenPaused() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();

        assertEq(vault.maxWithdraw(alice), 0);
    }

    function test_maxWithdraw_whenPausedWithEmergency() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();
        vm.prank(admin);
        vault.setEmergencyWithdraw(true);

        assertGt(vault.maxWithdraw(alice), 0);
    }

    function test_maxWithdraw_capsAtMaximum() public {
        uint256 largeDeposit = vault.MAX_WITHDRAWAL() * 2;
        usdt.mint(alice, largeDeposit);
        vm.prank(alice);
        usdt.approve(address(vault), largeDeposit);

        vm.prank(alice);
        vault.deposit(largeDeposit, alice);

        assertEq(vault.maxWithdraw(alice), vault.MAX_WITHDRAWAL());
    }

    function test_maxRedeem_whenPaused() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(admin);
        vault.pause();

        assertEq(vault.maxRedeem(alice), 0);
    }

    // =============================================================================
    // Interface Tests
    // =============================================================================

    function test_supportsInterface_accessControl() public view {
        // AccessControl interface ID
        bytes4 accessControlId = 0x7965db0b;
        assertTrue(vault.supportsInterface(accessControlId));
    }

    function test_decimals() public view {
        assertEq(vault.decimals(), 18);
    }
}
