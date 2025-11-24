// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISwapHelper
/// @author Paimon Yield Protocol
/// @notice Interface for DEX swap helper contract
/// @dev Wraps PancakeSwap Router V2 with slippage protection
interface ISwapHelper {
    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when tokens are swapped
    event TokensSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );

    /// @notice Emitted when router is updated
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    /// @notice Emitted when max slippage is updated
    event MaxSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when slippage exceeds maximum allowed
    error SlippageExceeded(uint256 expected, uint256 actual, uint256 maxSlippage);

    /// @notice Thrown when output amount is zero
    error ZeroOutputAmount();

    /// @notice Thrown when input amount is zero
    error ZeroInputAmount();

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when slippage is too high
    error SlippageTooHigh(uint256 slippage, uint256 maxAllowed);

    /// @notice Thrown when deadline has passed
    error DeadlinePassed(uint256 deadline, uint256 currentTime);

    // =============================================================================
    // Core Functions
    // =============================================================================

    /// @notice Buy RWA asset by swapping input token
    /// @param tokenIn The input token to swap from
    /// @param tokenOut The output token (RWA asset) to receive
    /// @param amountIn The amount of input token to swap
    /// @param maxSlippage Maximum allowed slippage in basis points (100 = 1%)
    /// @return amountOut The amount of output tokens received
    function buyRWAAsset(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage
    ) external returns (uint256 amountOut);

    /// @notice Sell RWA asset by swapping for output token
    /// @param tokenIn The RWA token to sell
    /// @param tokenOut The output token to receive
    /// @param amountIn The amount of RWA token to sell
    /// @param maxSlippage Maximum allowed slippage in basis points (100 = 1%)
    /// @return amountOut The amount of output tokens received
    function sellRWAAsset(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage
    ) external returns (uint256 amountOut);

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get expected output amount for a swap
    /// @param tokenIn The input token
    /// @param tokenOut The output token
    /// @param amountIn The input amount
    /// @return amountOut Expected output amount
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /// @notice Get the router address
    /// @return The PancakeSwap router address
    function router() external view returns (address);

    /// @notice Get the default max slippage
    /// @return The maximum slippage in basis points
    function defaultMaxSlippage() external view returns (uint256);
}
