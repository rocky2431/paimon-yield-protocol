// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";

/// @title BaseTest
/// @notice Base test contract with common setup and utilities
/// @dev All test contracts should inherit from this
abstract contract BaseTest is Test {
    // =============================================================================
    // Constants
    // =============================================================================

    uint256 internal constant INITIAL_BALANCE = 1_000_000e18;
    uint256 internal constant MIN_DEPOSIT = 500e18;
    uint256 internal constant MAX_DEPOSIT = 10_000_000e18;

    // =============================================================================
    // Test Accounts
    // =============================================================================

    address internal admin;
    address internal rebalancer;
    address internal alice;
    address internal bob;
    address internal charlie;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public virtual {
        // Create test accounts with labels for better trace output
        admin = makeAddr("admin");
        rebalancer = makeAddr("rebalancer");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");

        // Fund accounts with ETH for gas
        vm.deal(admin, 100 ether);
        vm.deal(rebalancer, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
    }

    // =============================================================================
    // Helpers
    // =============================================================================

    /// @notice Bound a value between min and max (alias for bound)
    function boundValue(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        return bound(value, min, max);
    }

    /// @notice Skip time by given seconds
    function _skipTime(uint256 seconds_) internal {
        skip(seconds_);
    }

    /// @notice Skip blocks by given number
    function _skipBlocks(uint256 blocks) internal {
        vm.roll(block.number + blocks);
    }

    /// @notice Assert approximate equality with tolerance
    function _assertApproxEq(uint256 a, uint256 b, uint256 tolerance) internal pure {
        uint256 diff = a > b ? a - b : b - a;
        require(diff <= tolerance, "Values not approximately equal");
    }

    /// @notice Get percentage of a value
    function _percent(uint256 value, uint256 percentage) internal pure returns (uint256) {
        return (value * percentage) / 100;
    }
}
