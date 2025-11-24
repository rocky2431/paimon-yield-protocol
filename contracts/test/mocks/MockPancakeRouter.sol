// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockPancakeRouter
/// @notice Mock PancakeSwap Router V2 for testing
/// @dev Simulates swap behavior with configurable exchange rates
contract MockPancakeRouter {
    using SafeERC20 for IERC20;

    // =============================================================================
    // State
    // =============================================================================

    /// @notice Exchange rate: output = input * rate / 1e18
    mapping(address => mapping(address => uint256)) public exchangeRates;

    /// @notice Whether to fail the next swap
    bool public failNextSwap;

    /// @notice Simulated slippage to apply (in basis points)
    uint256 public simulatedSlippage;

    /// @notice WETH address (for interface compatibility)
    address public WETH;

    // =============================================================================
    // Constructor
    // =============================================================================

    constructor() {
        WETH = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c); // BSC WBNB
    }

    // =============================================================================
    // Mock Configuration
    // =============================================================================

    /// @notice Set exchange rate between two tokens
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param rate Rate multiplied by 1e18 (1e18 = 1:1)
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
    }

    /// @notice Set whether next swap should fail
    function setFailNextSwap(bool shouldFail) external {
        failNextSwap = shouldFail;
    }

    /// @notice Set simulated slippage for testing
    /// @param slippage Slippage in basis points (100 = 1%)
    function setSimulatedSlippage(uint256 slippage) external {
        simulatedSlippage = slippage;
    }

    // =============================================================================
    // Router Functions
    // =============================================================================

    /// @notice Get amounts out for a swap path
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            uint256 rate = exchangeRates[path[i]][path[i + 1]];
            if (rate == 0) rate = 1e18; // Default 1:1 rate

            amounts[i + 1] = (amounts[i] * rate) / 1e18;
        }
    }

    /// @notice Execute a swap
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        require(!failNextSwap, "Swap failed");

        // Reset fail flag
        if (failNextSwap) {
            failNextSwap = false;
        }

        // Calculate amounts
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            uint256 rate = exchangeRates[path[i]][path[i + 1]];
            if (rate == 0) rate = 1e18; // Default 1:1 rate

            amounts[i + 1] = (amounts[i] * rate) / 1e18;
        }

        // Apply simulated slippage
        if (simulatedSlippage > 0) {
            uint256 lastIndex = amounts.length - 1;
            amounts[lastIndex] = (amounts[lastIndex] * (10000 - simulatedSlippage)) / 10000;
        }

        // Check slippage
        require(amounts[amounts.length - 1] >= amountOutMin, "Slippage exceeded");

        // Transfer tokens
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);

        // Mint output tokens to recipient (for testing, we just transfer from router's balance)
        // In tests, the router should be pre-funded with tokens
        IERC20(path[path.length - 1]).safeTransfer(to, amounts[amounts.length - 1]);

        return amounts;
    }
}
