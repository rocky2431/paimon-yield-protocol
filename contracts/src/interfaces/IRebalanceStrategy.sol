// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRebalanceStrategy
/// @author Paimon Yield Protocol
/// @notice Interface for rebalancing strategy contracts
interface IRebalanceStrategy {
    // =============================================================================
    // Structs
    // =============================================================================

    /// @notice Asset data for rebalancing calculations
    struct AssetData {
        address token;              // Token address
        uint256 currentAllocation;  // Current allocation in basis points (0-10000)
        uint256 currentValue;       // Current value in USD (18 decimals)
        uint256 apy;                // Current APY in basis points (e.g., 500 = 5%)
    }

    /// @notice Rebalance transaction instruction
    struct RebalanceTx {
        address token;      // Token to buy/sell
        bool isBuy;         // True = buy, False = sell
        uint256 amount;     // Amount in token's native decimals
        uint256 usdValue;   // Approximate USD value
    }

    /// @notice Optimal allocation result
    struct AllocationResult {
        address token;
        uint256 targetAllocation;   // Target allocation in basis points
        int256 allocationDelta;     // Change needed (positive = increase, negative = decrease)
    }

    // =============================================================================
    // Core Functions
    // =============================================================================

    /// @notice Calculate optimal allocations based on asset APYs
    /// @param assets Array of asset data including APYs
    /// @return allocations Array of optimal allocation results
    function calculateOptimalAllocation(
        AssetData[] calldata assets
    ) external view returns (AllocationResult[] memory allocations);

    /// @notice Generate rebalance transactions to move from current to target allocations
    /// @param assets Array of asset data with current allocations
    /// @param targetAllocations Target allocations in basis points
    /// @param totalValue Total portfolio value in USD
    /// @return txs Array of rebalance transactions
    function generateRebalanceTx(
        AssetData[] calldata assets,
        uint256[] calldata targetAllocations,
        uint256 totalValue
    ) external view returns (RebalanceTx[] memory txs);

    /// @notice Check if rebalancing is needed based on deviation threshold
    /// @param assets Array of asset data with current allocations
    /// @param targetAllocations Target allocations in basis points
    /// @return needed True if rebalancing is needed
    /// @return maxDeviation Maximum deviation from target
    function isRebalanceNeeded(
        AssetData[] calldata assets,
        uint256[] calldata targetAllocations
    ) external view returns (bool needed, uint256 maxDeviation);
}
