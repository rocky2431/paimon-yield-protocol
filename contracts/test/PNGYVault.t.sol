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

    // =============================================================================
    // Fuzz Tests - Deposit
    // =============================================================================

    function testFuzz_deposit_validAmounts(uint256 amount) public {
        // Bound amount between MIN_DEPOSIT and user's balance
        amount = bound(amount, MIN_DEPOSIT, INITIAL_BALANCE);

        vm.prank(alice);
        uint256 shares = vault.deposit(amount, alice);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(usdt.balanceOf(address(vault)), amount);
    }

    function testFuzz_deposit_invalidAmounts(uint256 amount) public {
        // Bound amount to be between 1 and MIN_DEPOSIT - 1
        amount = bound(amount, 1, MIN_DEPOSIT - 1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.DepositBelowMinimum.selector,
                amount,
                MIN_DEPOSIT
            )
        );
        vault.deposit(amount, alice);
    }

    function testFuzz_deposit_multipleUsers(uint256 aliceAmount, uint256 bobAmount) public {
        aliceAmount = bound(aliceAmount, MIN_DEPOSIT, INITIAL_BALANCE / 2);
        bobAmount = bound(bobAmount, MIN_DEPOSIT, INITIAL_BALANCE / 2);

        vm.prank(alice);
        uint256 aliceShares = vault.deposit(aliceAmount, alice);

        vm.prank(bob);
        uint256 bobShares = vault.deposit(bobAmount, bob);

        assertEq(vault.balanceOf(alice), aliceShares);
        assertEq(vault.balanceOf(bob), bobShares);
        assertEq(vault.totalAssets(), aliceAmount + bobAmount);
    }

    // =============================================================================
    // Fuzz Tests - Mint
    // =============================================================================

    function testFuzz_mint_validShares(uint256 shares) public {
        // Bound shares to reasonable range
        shares = bound(shares, MIN_DEPOSIT, INITIAL_BALANCE);

        vm.prank(alice);
        uint256 assets = vault.mint(shares, alice);

        assertGt(assets, 0);
        assertEq(vault.balanceOf(alice), shares);
    }

    // =============================================================================
    // Boundary Tests - Deposit
    // =============================================================================

    function test_deposit_exactMinimum() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        assertEq(shares, MIN_DEPOSIT); // 1:1 ratio initially
        assertEq(vault.balanceOf(alice), MIN_DEPOSIT);
    }

    function test_deposit_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.deposit(0, alice);
    }

    function test_deposit_largeAmount() public {
        uint256 largeAmount = 10_000_000e18;
        usdt.mint(alice, largeAmount);
        vm.prank(alice);
        usdt.approve(address(vault), largeAmount);

        vm.prank(alice);
        uint256 shares = vault.deposit(largeAmount, alice);

        assertEq(shares, largeAmount);
        assertEq(vault.totalAssets(), largeAmount);
    }

    // =============================================================================
    // Boundary Tests - Mint
    // =============================================================================

    function test_mint_exactMinimumShares() public {
        vm.prank(alice);
        uint256 assets = vault.mint(MIN_DEPOSIT, alice);

        assertEq(assets, MIN_DEPOSIT);
        assertEq(vault.balanceOf(alice), MIN_DEPOSIT);
    }

    function test_mint_revertsWhenAssetsBelowMinimum() public {
        // Try to mint shares that would require less than MIN_DEPOSIT assets
        uint256 smallShares = MIN_DEPOSIT / 2;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.DepositBelowMinimum.selector,
                smallShares, // previewMint returns same amount initially
                MIN_DEPOSIT
            )
        );
        vault.mint(smallShares, alice);
    }

    function test_mint_revertsZeroReceiver() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        vault.mint(MIN_DEPOSIT, address(0));
    }

    function test_mint_differentReceiver() public {
        vm.prank(alice);
        vault.mint(MIN_DEPOSIT, bob);

        assertEq(vault.balanceOf(bob), MIN_DEPOSIT);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_mint_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PNGYVault.DepositProcessed(alice, alice, MIN_DEPOSIT, MIN_DEPOSIT);
        vault.mint(MIN_DEPOSIT, alice);
    }

    // =============================================================================
    // Multi-User Scenarios
    // =============================================================================

    function test_deposit_multipleDepositsFromSameUser() public {
        vm.startPrank(alice);
        vault.deposit(MIN_DEPOSIT, alice);
        vault.deposit(MIN_DEPOSIT * 2, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), MIN_DEPOSIT * 3);
        assertEq(vault.totalAssets(), MIN_DEPOSIT * 3);
    }

    function test_deposit_shareRatioAfterYield() public {
        // Alice deposits first
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        // Simulate yield by updating managed assets
        vm.prank(admin);
        vault.updateManagedAssets(MIN_DEPOSIT); // Double the assets

        // Bob deposits after yield
        vm.prank(bob);
        uint256 bobShares = vault.deposit(MIN_DEPOSIT, bob);

        // Bob should get fewer shares because share price increased
        assertLt(bobShares, MIN_DEPOSIT);
        // Alice should have more value now
        assertGt(vault.convertToAssets(vault.balanceOf(alice)), MIN_DEPOSIT);
    }

    // =============================================================================
    // Gas Optimization Verification
    // =============================================================================

    function test_deposit_gasUsage() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        vault.deposit(MIN_DEPOSIT, alice);
        uint256 gasUsed = gasBefore - gasleft();

        // Log gas usage for reference (should be < 100k gas)
        assertLt(gasUsed, 150_000);
    }

    function test_mint_gasUsage() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        vault.mint(MIN_DEPOSIT, alice);
        uint256 gasUsed = gasBefore - gasleft();

        // Log gas usage for reference
        assertLt(gasUsed, 150_000);
    }

    // =============================================================================
    // Instant Withdrawal Limit Tests
    // =============================================================================

    function test_withdraw_instantLimitEnforced() public {
        // Deposit large amount
        uint256 largeDeposit = vault.INSTANT_WITHDRAWAL_LIMIT() + MIN_DEPOSIT;
        usdt.mint(alice, largeDeposit);
        vm.prank(alice);
        usdt.approve(address(vault), largeDeposit);
        vm.prank(alice);
        vault.deposit(largeDeposit, alice);

        // Try to withdraw more than instant limit
        uint256 withdrawAmount = vault.INSTANT_WITHDRAWAL_LIMIT() + 1;
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.ExceedsInstantLimit.selector,
                withdrawAmount,
                vault.INSTANT_WITHDRAWAL_LIMIT()
            )
        );
        vault.withdraw(withdrawAmount, alice, alice);
    }

    function test_withdraw_belowInstantLimitSucceeds() public {
        // Deposit at instant limit
        uint256 depositAmount = vault.INSTANT_WITHDRAWAL_LIMIT();
        usdt.mint(alice, depositAmount);
        vm.prank(alice);
        usdt.approve(address(vault), depositAmount);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        // Withdraw exactly at instant limit
        vm.prank(alice);
        vault.withdraw(depositAmount, alice, alice);

        assertEq(vault.balanceOf(alice), 0);
    }

    function test_redeem_instantLimitEnforced() public {
        // Deposit large amount
        uint256 largeDeposit = vault.INSTANT_WITHDRAWAL_LIMIT() + MIN_DEPOSIT;
        usdt.mint(alice, largeDeposit);
        vm.prank(alice);
        usdt.approve(address(vault), largeDeposit);
        vm.prank(alice);
        uint256 shares = vault.deposit(largeDeposit, alice);

        // Try to redeem more than instant limit worth
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.ExceedsInstantLimit.selector,
                largeDeposit,
                vault.INSTANT_WITHDRAWAL_LIMIT()
            )
        );
        vault.redeem(shares, alice, alice);
    }

    function test_withdraw_bypassInstantLimitInEmergency() public {
        // Deposit large amount
        uint256 largeDeposit = vault.INSTANT_WITHDRAWAL_LIMIT() * 2;
        usdt.mint(alice, largeDeposit);
        vm.prank(alice);
        usdt.approve(address(vault), largeDeposit);
        vm.prank(alice);
        vault.deposit(largeDeposit, alice);

        // Enable emergency mode
        vm.prank(admin);
        vault.setEmergencyWithdraw(true);

        // Withdraw above instant limit should work
        uint256 withdrawAmount = vault.INSTANT_WITHDRAWAL_LIMIT() * 2;
        vm.prank(alice);
        vault.withdraw(withdrawAmount, alice, alice);

        assertEq(vault.balanceOf(alice), 0);
    }

    // =============================================================================
    // T+1 Withdrawal Queue Tests
    // =============================================================================

    function test_requestWithdraw_success() public {
        // Setup: deposit
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        // Request withdrawal
        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        // Verify request created
        (uint256 reqShares, uint256 reqAssets, address receiver, uint256 requestTime, bool claimed) =
            vault.withdrawRequests(requestId);

        assertEq(reqShares, shares);
        assertGt(reqAssets, 0);
        assertEq(receiver, alice);
        assertEq(requestTime, block.timestamp);
        assertFalse(claimed);

        // Verify shares transferred to vault
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.balanceOf(address(vault)), shares);
        assertEq(vault.totalLockedShares(), shares);
    }

    function test_requestWithdraw_createsRequest() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        // Verify request was created with correct ID
        assertEq(requestId, 0);

        // Verify request data
        (uint256 reqShares,,,, bool claimed) = vault.withdrawRequests(requestId);
        assertEq(reqShares, shares);
        assertFalse(claimed);
    }

    function test_requestWithdraw_revertsZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAmount.selector);
        vault.requestWithdraw(0, alice);
    }

    function test_requestWithdraw_revertsZeroReceiver() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        vm.expectRevert(PNGYVault.ZeroAddress.selector);
        vault.requestWithdraw(MIN_DEPOSIT, address(0));
    }

    function test_requestWithdraw_revertsInsufficientShares() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.InsufficientShares.selector,
                MIN_DEPOSIT,
                MIN_DEPOSIT * 2
            )
        );
        vault.requestWithdraw(MIN_DEPOSIT * 2, alice);
    }

    function test_claimWithdraw_success() public {
        // Setup
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        // Wait for delay
        skip(vault.WITHDRAWAL_DELAY());

        // Claim
        uint256 balanceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        vault.claimWithdraw(requestId);

        // Verify
        assertGt(usdt.balanceOf(alice), balanceBefore);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.totalLockedShares(), 0);

        // Verify request marked as claimed
        (,,,, bool claimed) = vault.withdrawRequests(requestId);
        assertTrue(claimed);
    }

    function test_claimWithdraw_emitsEvent() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        skip(vault.WITHDRAWAL_DELAY());

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PNGYVault.WithdrawClaimed(requestId, alice, alice, MIN_DEPOSIT);
        vault.claimWithdraw(requestId);
    }

    function test_claimWithdraw_revertsBeforeDelay() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        // Try to claim before delay
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PNGYVault.WithdrawalDelayNotMet.selector,
                block.timestamp,
                block.timestamp,
                vault.WITHDRAWAL_DELAY()
            )
        );
        vault.claimWithdraw(requestId);
    }

    function test_claimWithdraw_revertsAlreadyClaimed() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(MIN_DEPOSIT, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        skip(vault.WITHDRAWAL_DELAY());

        vm.prank(alice);
        vault.claimWithdraw(requestId);

        // Try to claim again
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(PNGYVault.RequestAlreadyClaimed.selector, requestId)
        );
        vault.claimWithdraw(requestId);
    }

    function test_claimWithdraw_revertsRequestNotFound() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(PNGYVault.RequestNotFound.selector, 999)
        );
        vault.claimWithdraw(999);
    }

    function test_getUserPendingRequests() public {
        // Use alice's existing balance and approval from setUp
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT * 3, alice);

        // Create 3 requests
        vm.startPrank(alice);
        vault.requestWithdraw(MIN_DEPOSIT, alice);
        vault.requestWithdraw(MIN_DEPOSIT, alice);
        vault.requestWithdraw(MIN_DEPOSIT, alice);
        vm.stopPrank();

        uint256[] memory requests = vault.getUserPendingRequests(alice);
        assertEq(requests.length, 3);
    }

    function test_getUserLockedShares() public {
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT * 2, alice);

        vm.prank(alice);
        vault.requestWithdraw(MIN_DEPOSIT, alice);

        assertEq(vault.getUserLockedShares(alice), MIN_DEPOSIT);

        // After claiming
        skip(vault.WITHDRAWAL_DELAY());
        vm.prank(alice);
        vault.claimWithdraw(0);

        assertEq(vault.getUserLockedShares(alice), 0);
    }

    function test_requestWithdraw_multipleUsers() public {
        // Alice deposits and requests
        vm.prank(alice);
        vault.deposit(MIN_DEPOSIT, alice);
        vm.prank(alice);
        vault.requestWithdraw(MIN_DEPOSIT, alice);

        // Bob deposits and requests
        vm.prank(bob);
        vault.deposit(MIN_DEPOSIT, bob);
        vm.prank(bob);
        vault.requestWithdraw(MIN_DEPOSIT, bob);

        assertEq(vault.totalLockedShares(), MIN_DEPOSIT * 2);
        assertEq(vault.getUserLockedShares(alice), MIN_DEPOSIT);
        assertEq(vault.getUserLockedShares(bob), MIN_DEPOSIT);
    }

    function testFuzz_requestWithdraw_validShares(uint256 depositAmount) public {
        // Bound to avoid exceeding MAX_WITHDRAWAL
        uint256 maxDeposit = vault.MAX_WITHDRAWAL();
        depositAmount = bound(depositAmount, MIN_DEPOSIT, maxDeposit);

        vm.prank(alice);
        uint256 shares = vault.deposit(depositAmount, alice);

        vm.prank(alice);
        uint256 requestId = vault.requestWithdraw(shares, alice);

        (uint256 reqShares,,,, ) = vault.withdrawRequests(requestId);
        assertEq(reqShares, shares);
        assertEq(vault.totalLockedShares(), shares);
    }
}
