// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IRebalanceStrategy} from "./interfaces/IRebalanceStrategy.sol";

/// @title RebalanceStrategy
/// @author Paimon Yield Protocol
/// @notice Dynamic rebalancing strategy for RWA asset allocation
/// @dev Calculates optimal allocations based on APY and generates rebalance transactions
contract RebalanceStrategy is IRebalanceStrategy, AccessControl {
    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Role identifier for admin operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Basis points denominator (100%)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Minimum allocation per asset (1%)
    uint256 public constant MIN_ALLOCATION = 100;

    /// @notice Maximum allocation per asset (50%)
    uint256 public constant MAX_ALLOCATION = 5000;

    /// @notice Default rebalance threshold (5% deviation)
    uint256 public constant DEFAULT_REBALANCE_THRESHOLD = 500;

    /// @notice Minimum trade value in USD (18 decimals) - $100
    uint256 public constant MIN_TRADE_VALUE = 100e18;

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice APY sensitivity factor (how much APY affects allocation)
    /// @dev Higher value = more aggressive allocation to high APY assets
    uint256 public apySensitivity;

    /// @notice Rebalance threshold (deviation that triggers rebalancing)
    uint256 public rebalanceThreshold;

    /// @notice Minimum allocation override per asset
    mapping(address => uint256) public minAllocations;

    /// @notice Maximum allocation override per asset
    mapping(address => uint256) public maxAllocations;

    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when APY sensitivity is updated
    event ApySensitivityUpdated(uint256 oldValue, uint256 newValue);

    /// @notice Emitted when rebalance threshold is updated
    event RebalanceThresholdUpdated(uint256 oldValue, uint256 newValue);

    /// @notice Emitted when asset allocation limits are updated
    event AssetLimitsUpdated(address indexed token, uint256 minAllocation, uint256 maxAllocation);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when array lengths don't match
    error ArrayLengthMismatch();

    /// @notice Thrown when assets array is empty
    error EmptyAssets();

    /// @notice Thrown when allocations don't sum to 100%
    error InvalidTotalAllocation(uint256 total);

    /// @notice Thrown when APY sensitivity is invalid
    error InvalidApySensitivity(uint256 value);

    /// @notice Thrown when threshold is invalid
    error InvalidThreshold(uint256 value);

    /// @notice Thrown when allocation limits are invalid
    error InvalidAllocationLimits(uint256 min, uint256 max);

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the RebalanceStrategy
    /// @param admin_ The initial admin address
    /// @param apySensitivity_ Initial APY sensitivity (0-100)
    constructor(address admin_, uint256 apySensitivity_) {
        if (admin_ == address(0)) revert ZeroAddress();
        if (apySensitivity_ > 100) revert InvalidApySensitivity(apySensitivity_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        apySensitivity = apySensitivity_;
        rebalanceThreshold = DEFAULT_REBALANCE_THRESHOLD;
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Set APY sensitivity factor
    /// @param newSensitivity New sensitivity value (0-100)
    function setApySensitivity(uint256 newSensitivity) external onlyRole(ADMIN_ROLE) {
        if (newSensitivity > 100) revert InvalidApySensitivity(newSensitivity);

        uint256 oldValue = apySensitivity;
        apySensitivity = newSensitivity;

        emit ApySensitivityUpdated(oldValue, newSensitivity);
    }

    /// @notice Set rebalance threshold
    /// @param newThreshold New threshold in basis points
    function setRebalanceThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        if (newThreshold == 0 || newThreshold > 5000) revert InvalidThreshold(newThreshold);

        uint256 oldValue = rebalanceThreshold;
        rebalanceThreshold = newThreshold;

        emit RebalanceThresholdUpdated(oldValue, newThreshold);
    }

    /// @notice Set allocation limits for a specific asset
    /// @param token Asset token address
    /// @param minAllocation Minimum allocation in basis points
    /// @param maxAllocation Maximum allocation in basis points
    function setAssetLimits(
        address token,
        uint256 minAllocation,
        uint256 maxAllocation
    ) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (minAllocation > maxAllocation) revert InvalidAllocationLimits(minAllocation, maxAllocation);
        if (maxAllocation > BASIS_POINTS) revert InvalidAllocationLimits(minAllocation, maxAllocation);

        minAllocations[token] = minAllocation;
        maxAllocations[token] = maxAllocation;

        emit AssetLimitsUpdated(token, minAllocation, maxAllocation);
    }

    // =============================================================================
    // IRebalanceStrategy Implementation
    // =============================================================================

    /// @inheritdoc IRebalanceStrategy
    function calculateOptimalAllocation(
        AssetData[] calldata assets
    ) external view override returns (AllocationResult[] memory allocations) {
        if (assets.length == 0) revert EmptyAssets();

        allocations = new AllocationResult[](assets.length);

        // Calculate average APY
        uint256 totalApy = 0;
        for (uint256 i = 0; i < assets.length; i++) {
            totalApy += assets[i].apy;
        }
        uint256 avgApy = totalApy / assets.length;

        // Calculate base allocation (equal distribution)
        uint256 baseAllocation = BASIS_POINTS / assets.length;

        // Calculate raw allocations based on APY
        uint256[] memory rawAllocations = new uint256[](assets.length);
        uint256 totalRaw = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            // Calculate APY-adjusted allocation
            int256 apyDelta = int256(assets[i].apy) - int256(avgApy);
            int256 adjustment = (apyDelta * int256(apySensitivity)) / 100;

            // Apply adjustment to base allocation
            int256 rawAlloc = int256(baseAllocation) + adjustment;

            // Get limits for this asset
            uint256 minAlloc = _getMinAllocation(assets[i].token);
            uint256 maxAlloc = _getMaxAllocation(assets[i].token);

            // Clamp to limits
            if (rawAlloc < int256(minAlloc)) {
                rawAllocations[i] = minAlloc;
            } else if (rawAlloc > int256(maxAlloc)) {
                rawAllocations[i] = maxAlloc;
            } else {
                rawAllocations[i] = uint256(rawAlloc);
            }

            totalRaw += rawAllocations[i];
        }

        // Normalize to 100%
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 targetAlloc = (rawAllocations[i] * BASIS_POINTS) / totalRaw;

            allocations[i] = AllocationResult({
                token: assets[i].token,
                targetAllocation: targetAlloc,
                allocationDelta: int256(targetAlloc) - int256(assets[i].currentAllocation)
            });
        }

        return allocations;
    }

    /// @inheritdoc IRebalanceStrategy
    function generateRebalanceTx(
        AssetData[] calldata assets,
        uint256[] calldata targetAllocations,
        uint256 totalValue
    ) external view override returns (RebalanceTx[] memory txs) {
        if (assets.length == 0) revert EmptyAssets();
        if (assets.length != targetAllocations.length) revert ArrayLengthMismatch();

        // Validate total allocation
        uint256 totalAlloc = 0;
        for (uint256 i = 0; i < targetAllocations.length; i++) {
            totalAlloc += targetAllocations[i];
        }
        if (totalAlloc != BASIS_POINTS) revert InvalidTotalAllocation(totalAlloc);

        // Calculate deltas and count transactions needed
        int256[] memory deltas = new int256[](assets.length);
        uint256 txCount = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            int256 targetValue = int256((totalValue * targetAllocations[i]) / BASIS_POINTS);
            int256 currentValue = int256(assets[i].currentValue);
            deltas[i] = targetValue - currentValue;

            // Only count if delta exceeds minimum trade value
            if (_abs(deltas[i]) >= int256(MIN_TRADE_VALUE)) {
                txCount++;
            }
        }

        // Build transaction array
        txs = new RebalanceTx[](txCount);
        uint256 txIndex = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            if (_abs(deltas[i]) >= int256(MIN_TRADE_VALUE)) {
                bool isBuy = deltas[i] > 0;
                uint256 usdValue = uint256(_abs(deltas[i]));

                txs[txIndex] = RebalanceTx({
                    token: assets[i].token,
                    isBuy: isBuy,
                    amount: usdValue, // Note: Caller should convert to token amount using price
                    usdValue: usdValue
                });

                txIndex++;
            }
        }

        return txs;
    }

    /// @inheritdoc IRebalanceStrategy
    function isRebalanceNeeded(
        AssetData[] calldata assets,
        uint256[] calldata targetAllocations
    ) external view override returns (bool needed, uint256 maxDeviation) {
        if (assets.length == 0) revert EmptyAssets();
        if (assets.length != targetAllocations.length) revert ArrayLengthMismatch();

        maxDeviation = 0;

        for (uint256 i = 0; i < assets.length; i++) {
            uint256 deviation;
            if (assets[i].currentAllocation > targetAllocations[i]) {
                deviation = assets[i].currentAllocation - targetAllocations[i];
            } else {
                deviation = targetAllocations[i] - assets[i].currentAllocation;
            }

            if (deviation > maxDeviation) {
                maxDeviation = deviation;
            }
        }

        needed = maxDeviation >= rebalanceThreshold;
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get minimum allocation for an asset
    /// @param token Asset token address
    /// @return Minimum allocation in basis points
    function getMinAllocation(address token) external view returns (uint256) {
        return _getMinAllocation(token);
    }

    /// @notice Get maximum allocation for an asset
    /// @param token Asset token address
    /// @return Maximum allocation in basis points
    function getMaxAllocation(address token) external view returns (uint256) {
        return _getMaxAllocation(token);
    }

    /// @notice Get current strategy parameters
    /// @return sensitivity APY sensitivity factor
    /// @return threshold Rebalance threshold
    function getStrategyParams() external view returns (uint256 sensitivity, uint256 threshold) {
        return (apySensitivity, rebalanceThreshold);
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    /// @dev Get minimum allocation for an asset (with default fallback)
    function _getMinAllocation(address token) internal view returns (uint256) {
        uint256 custom = minAllocations[token];
        return custom > 0 ? custom : MIN_ALLOCATION;
    }

    /// @dev Get maximum allocation for an asset (with default fallback)
    function _getMaxAllocation(address token) internal view returns (uint256) {
        uint256 custom = maxAllocations[token];
        return custom > 0 ? custom : MAX_ALLOCATION;
    }

    /// @dev Get absolute value of int256
    function _abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }
}
