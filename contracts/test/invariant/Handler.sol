// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PNGYVault} from "../../src/PNGYVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDTHandler
/// @notice Mock USDT token for invariant testing
contract MockUSDTHandler is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

/// @title VaultHandler
/// @notice Handler contract for PNGYVault invariant testing
/// @dev Provides bounded actions that simulate user interactions
contract VaultHandler is Test {
    // =============================================================================
    // State
    // =============================================================================

    PNGYVault public vault;
    MockUSDTHandler public usdt;
    address public admin;

    // Track actors for invariant checks
    address[] public actors;
    mapping(address => bool) public isActor;

    // Ghost variables for tracking
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;
    uint256 public ghost_depositCount;
    uint256 public ghost_withdrawCount;

    // Constants
    uint256 public constant MIN_DEPOSIT = 500e18;
    uint256 public constant MAX_DEPOSIT = 1_000_000e18;
    uint256 public constant INITIAL_BALANCE = 10_000_000e18;

    // =============================================================================
    // Constructor
    // =============================================================================

    constructor(PNGYVault _vault, MockUSDTHandler _usdt, address _admin) {
        vault = _vault;
        usdt = _usdt;
        admin = _admin;

        // Create initial actors
        for (uint256 i = 0; i < 5; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("actor", i)))));
            actors.push(actor);
            isActor[actor] = true;

            // Fund actors
            usdt.mint(actor, INITIAL_BALANCE);
            vm.prank(actor);
            usdt.approve(address(vault), type(uint256).max);
        }
    }

    // =============================================================================
    // Handler Actions
    // =============================================================================

    /// @notice Bounded deposit action
    function deposit(uint256 actorSeed, uint256 amount) external {
        // Select actor
        address actor = actors[actorSeed % actors.length];

        // Bound amount to valid range
        uint256 balance = usdt.balanceOf(actor);
        if (balance < MIN_DEPOSIT) return;

        amount = bound(amount, MIN_DEPOSIT, balance > MAX_DEPOSIT ? MAX_DEPOSIT : balance);

        // Execute deposit
        vm.prank(actor);
        try vault.deposit(amount, actor) returns (uint256 shares) {
            ghost_totalDeposited += amount;
            ghost_depositCount++;
        } catch {
            // Deposit failed, expected in some edge cases
        }
    }

    /// @notice Bounded mint action
    function mint(uint256 actorSeed, uint256 shares) external {
        address actor = actors[actorSeed % actors.length];

        // Bound shares
        shares = bound(shares, MIN_DEPOSIT, MAX_DEPOSIT);

        // Check if actor has enough assets
        uint256 requiredAssets = vault.previewMint(shares);
        if (usdt.balanceOf(actor) < requiredAssets || requiredAssets < MIN_DEPOSIT) return;

        vm.prank(actor);
        try vault.mint(shares, actor) returns (uint256 assets) {
            ghost_totalDeposited += assets;
            ghost_depositCount++;
        } catch {
            // Mint failed
        }
    }

    /// @notice Bounded withdraw action
    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];

        // Get actor's max withdraw
        uint256 maxWithdraw = vault.maxWithdraw(actor);
        if (maxWithdraw == 0) return;

        // Bound to instant withdrawal limit
        uint256 instantLimit = vault.INSTANT_WITHDRAWAL_LIMIT();
        amount = bound(amount, 1e18, maxWithdraw > instantLimit ? instantLimit : maxWithdraw);

        vm.prank(actor);
        try vault.withdraw(amount, actor, actor) returns (uint256 shares) {
            ghost_totalWithdrawn += amount;
            ghost_withdrawCount++;
        } catch {
            // Withdraw failed
        }
    }

    /// @notice Bounded redeem action
    function redeem(uint256 actorSeed, uint256 shares) external {
        address actor = actors[actorSeed % actors.length];

        // Get actor's max redeem
        uint256 maxRedeem = vault.maxRedeem(actor);
        if (maxRedeem == 0) return;

        // Bound shares
        uint256 instantLimitShares = vault.convertToShares(vault.INSTANT_WITHDRAWAL_LIMIT());
        shares = bound(shares, 1e18, maxRedeem > instantLimitShares ? instantLimitShares : maxRedeem);

        vm.prank(actor);
        try vault.redeem(shares, actor, actor) returns (uint256 assets) {
            ghost_totalWithdrawn += assets;
            ghost_withdrawCount++;
        } catch {
            // Redeem failed
        }
    }

    /// @notice Simulate yield accrual (admin action)
    function accrueYield(uint256 amount) external {
        // Only accrue yield if there are deposits
        uint256 totalAssets = vault.totalAssets();
        if (totalAssets == 0) return;

        // Bound yield to max 10% of current assets (realistic scenario)
        uint256 maxYield = totalAssets / 10;
        if (maxYield > 100_000e18) maxYield = 100_000e18;
        if (maxYield < 1e18) maxYield = 1e18;

        amount = bound(amount, 0, maxYield);
        if (amount == 0) return;

        // Mint USDT directly to vault to simulate yield
        usdt.mint(address(vault), amount);
    }

    /// @notice Request withdraw for T+1 queue
    function requestWithdraw(uint256 actorSeed, uint256 shares) external {
        address actor = actors[actorSeed % actors.length];

        uint256 balance = vault.balanceOf(actor);
        uint256 locked = vault.getUserLockedShares(actor);
        uint256 available = balance > locked ? balance - locked : 0;

        if (available < MIN_DEPOSIT) return;

        shares = bound(shares, MIN_DEPOSIT, available > MAX_DEPOSIT ? MAX_DEPOSIT : available);

        // Check if assets exceed max withdrawal
        uint256 previewAssets = vault.previewRedeem(shares);
        if (previewAssets > vault.MAX_WITHDRAWAL()) return;

        vm.prank(actor);
        try vault.requestWithdraw(shares, actor) {
            // Success
        } catch {
            // Failed
        }
    }

    // =============================================================================
    // View Functions for Invariant Checks
    // =============================================================================

    /// @notice Get total shares across all actors
    function getTotalActorShares() external view returns (uint256 total) {
        for (uint256 i = 0; i < actors.length; i++) {
            total += vault.balanceOf(actors[i]);
        }
    }

    /// @notice Get total assets across all actors
    function getTotalActorAssets() external view returns (uint256 total) {
        for (uint256 i = 0; i < actors.length; i++) {
            uint256 shares = vault.balanceOf(actors[i]);
            if (shares > 0) {
                total += vault.convertToAssets(shares);
            }
        }
    }

    /// @notice Get actor count
    function getActorCount() external view returns (uint256) {
        return actors.length;
    }
}
