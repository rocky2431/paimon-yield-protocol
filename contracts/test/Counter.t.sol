// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Counter} from "../src/Counter.sol";

/// @title CounterTest
/// @notice Unit tests for Counter contract (example/template)
contract CounterTest is BaseTest {
    Counter public counter;

    function setUp() public override {
        super.setUp();
        counter = new Counter();
    }

    // =============================================================================
    // Unit Tests - Functional
    // =============================================================================

    function test_InitialNumber() public view {
        assertEq(counter.number(), 0);
    }

    function test_SetNumber() public {
        counter.setNumber(42);
        assertEq(counter.number(), 42);
    }

    function test_Increment() public {
        counter.setNumber(10);
        counter.increment();
        assertEq(counter.number(), 11);
    }

    // =============================================================================
    // Fuzz Tests
    // =============================================================================

    function testFuzz_SetNumber(uint256 x) public {
        counter.setNumber(x);
        assertEq(counter.number(), x);
    }

    function testFuzz_Increment(uint256 start) public {
        // Bound to avoid overflow
        start = bound(start, 0, type(uint256).max - 1);

        counter.setNumber(start);
        counter.increment();
        assertEq(counter.number(), start + 1);
    }

    // =============================================================================
    // Boundary Tests
    // =============================================================================

    function test_SetNumber_Zero() public {
        counter.setNumber(0);
        assertEq(counter.number(), 0);
    }

    function test_SetNumber_MaxUint() public {
        counter.setNumber(type(uint256).max);
        assertEq(counter.number(), type(uint256).max);
    }

    function test_Increment_FromZero() public {
        assertEq(counter.number(), 0);
        counter.increment();
        assertEq(counter.number(), 1);
    }
}
