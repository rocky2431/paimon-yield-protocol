// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapHelper} from "./interfaces/ISwapHelper.sol";

/// @title IPancakeRouter
/// @notice Minimal interface for PancakeSwap Router V2
interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    function WETH() external view returns (address);
}

/// @title SwapHelper
/// @author Paimon Yield Protocol
/// @notice DEX swap helper with slippage protection for RWA asset trading
/// @dev Wraps PancakeSwap Router V2 with configurable slippage limits
contract SwapHelper is ISwapHelper, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Admin role identifier
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Maximum allowed slippage (2% = 200 basis points)
    uint256 public constant MAX_ALLOWED_SLIPPAGE = 200;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Default swap deadline offset (30 minutes)
    uint256 public constant DEFAULT_DEADLINE_OFFSET = 30 minutes;

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice PancakeSwap Router address
    address public override router;

    /// @notice Default maximum slippage in basis points
    uint256 public override defaultMaxSlippage;

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the SwapHelper
    /// @param router_ The PancakeSwap router address
    /// @param admin_ The admin address
    /// @param defaultSlippage_ Default max slippage in basis points
    constructor(
        address router_,
        address admin_,
        uint256 defaultSlippage_
    ) {
        if (router_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();
        if (defaultSlippage_ > MAX_ALLOWED_SLIPPAGE) {
            revert SlippageTooHigh(defaultSlippage_, MAX_ALLOWED_SLIPPAGE);
        }

        router = router_;
        defaultMaxSlippage = defaultSlippage_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
    }

    // =============================================================================
    // Core Functions
    // =============================================================================

    /// @inheritdoc ISwapHelper
    function buyRWAAsset(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage
    ) external override nonReentrant returns (uint256 amountOut) {
        return _swap(tokenIn, tokenOut, amountIn, maxSlippage, msg.sender);
    }

    /// @inheritdoc ISwapHelper
    function sellRWAAsset(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage
    ) external override nonReentrant returns (uint256 amountOut) {
        return _swap(tokenIn, tokenOut, amountIn, maxSlippage, msg.sender);
    }

    /// @notice Internal swap function
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @param amountIn Amount of input tokens
    /// @param maxSlippage Maximum slippage in basis points
    /// @param recipient Address to receive output tokens
    /// @return amountOut Amount of output tokens received
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Validate inputs
        if (tokenIn == address(0) || tokenOut == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroInputAmount();
        if (maxSlippage > MAX_ALLOWED_SLIPPAGE) {
            revert SlippageTooHigh(maxSlippage, MAX_ALLOWED_SLIPPAGE);
        }

        // Use default slippage if 0 provided
        if (maxSlippage == 0) {
            maxSlippage = defaultMaxSlippage;
        }

        // Get expected output amount
        uint256 expectedOut = getAmountOut(tokenIn, tokenOut, amountIn);
        if (expectedOut == 0) revert ZeroOutputAmount();

        // Calculate minimum output with slippage
        uint256 minAmountOut = (expectedOut * (BASIS_POINTS - maxSlippage)) / BASIS_POINTS;

        // Transfer tokens from sender
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve router
        IERC20(tokenIn).safeIncreaseAllowance(router, amountIn);

        // Build swap path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Execute swap
        uint256 deadline = block.timestamp + DEFAULT_DEADLINE_OFFSET;
        uint256[] memory amounts = IPancakeRouter(router).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        );

        amountOut = amounts[amounts.length - 1];

        // Verify slippage
        if (amountOut < minAmountOut) {
            revert SlippageExceeded(expectedOut, amountOut, maxSlippage);
        }

        emit TokensSwapped(tokenIn, tokenOut, amountIn, amountOut, recipient);
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @inheritdoc ISwapHelper
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view override returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        try IPancakeRouter(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Update the router address
    /// @param newRouter The new router address
    function setRouter(address newRouter) external onlyRole(ADMIN_ROLE) {
        if (newRouter == address(0)) revert ZeroAddress();

        address oldRouter = router;
        router = newRouter;

        emit RouterUpdated(oldRouter, newRouter);
    }

    /// @notice Update the default max slippage
    /// @param newSlippage New default slippage in basis points
    function setDefaultMaxSlippage(uint256 newSlippage) external onlyRole(ADMIN_ROLE) {
        if (newSlippage > MAX_ALLOWED_SLIPPAGE) {
            revert SlippageTooHigh(newSlippage, MAX_ALLOWED_SLIPPAGE);
        }

        uint256 oldSlippage = defaultMaxSlippage;
        defaultMaxSlippage = newSlippage;

        emit MaxSlippageUpdated(oldSlippage, newSlippage);
    }
}
