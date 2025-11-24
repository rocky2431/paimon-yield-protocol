// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IOracleAdapter} from "../interfaces/IOracleAdapter.sol";
import {AggregatorV3Interface} from "../interfaces/IChainlinkAggregator.sol";

/// @title ChainlinkOracle
/// @author Paimon Yield Protocol
/// @notice Oracle adapter for Chainlink Price Feeds (backup Oracle)
/// @dev Implements IOracleAdapter interface, wraps Chainlink aggregator calls
contract ChainlinkOracle is IOracleAdapter, AccessControl {
    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Role identifier for admin operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Default staleness threshold (2 hours)
    uint256 public constant DEFAULT_STALENESS_THRESHOLD = 2 hours;

    /// @notice Target price precision (18 decimals)
    uint256 public constant PRICE_PRECISION = 1e18;

    // =============================================================================
    // Structs
    // =============================================================================

    /// @notice Asset configuration for Chainlink aggregator
    struct AssetConfig {
        address aggregator;         // Chainlink aggregator address
        uint8 decimals;             // Aggregator decimals
        uint256 stalenessThreshold; // Custom staleness threshold (0 = use default)
        bool isConfigured;          // Whether the asset is configured
    }

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice Asset configurations
    mapping(address => AssetConfig) private _assetConfigs;

    /// @notice Array of configured assets
    address[] private _configuredAssets;

    /// @notice Global staleness threshold
    uint256 public globalStalenessThreshold;

    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when an asset is configured
    event AssetConfigured(
        address indexed asset,
        address aggregator,
        uint8 decimals,
        uint256 stalenessThreshold
    );

    /// @notice Emitted when an asset is removed
    event AssetRemoved(address indexed asset);

    /// @notice Emitted when global staleness threshold is updated
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when asset is not configured
    error AssetNotConfigured(address asset);

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when price is zero or negative
    error InvalidPrice(address asset, int256 price);

    /// @notice Thrown when staleness threshold is invalid
    error InvalidStalenessThreshold(uint256 threshold);

    /// @notice Thrown when Chainlink round is incomplete
    error IncompleteRound(address asset, uint80 roundId, uint80 answeredInRound);

    /// @notice Thrown when Chainlink data is stale
    error StaleData(address asset, uint256 updatedAt, uint256 threshold);

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the ChainlinkOracle
    /// @param admin_ The initial admin address
    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        globalStalenessThreshold = DEFAULT_STALENESS_THRESHOLD;
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Configure an asset with its Chainlink aggregator
    /// @param asset The token address
    /// @param aggregator The Chainlink aggregator address
    /// @param stalenessThreshold Custom staleness threshold (0 = use global)
    function configureAsset(
        address asset,
        address aggregator,
        uint256 stalenessThreshold
    ) external onlyRole(ADMIN_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        if (aggregator == address(0)) revert ZeroAddress();

        // Get decimals from aggregator
        uint8 decimals = AggregatorV3Interface(aggregator).decimals();

        if (!_assetConfigs[asset].isConfigured) {
            _configuredAssets.push(asset);
        }

        _assetConfigs[asset] = AssetConfig({
            aggregator: aggregator,
            decimals: decimals,
            stalenessThreshold: stalenessThreshold,
            isConfigured: true
        });

        emit AssetConfigured(asset, aggregator, decimals, stalenessThreshold);
    }

    /// @notice Remove an asset configuration
    /// @param asset The token address
    function removeAsset(address asset) external onlyRole(ADMIN_ROLE) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        // Remove from array
        uint256 length = _configuredAssets.length;
        for (uint256 i = 0; i < length; i++) {
            if (_configuredAssets[i] == asset) {
                _configuredAssets[i] = _configuredAssets[length - 1];
                _configuredAssets.pop();
                break;
            }
        }

        delete _assetConfigs[asset];

        emit AssetRemoved(asset);
    }

    /// @notice Update the global staleness threshold
    /// @param newThreshold The new threshold in seconds
    function setGlobalStalenessThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        if (newThreshold == 0) revert InvalidStalenessThreshold(newThreshold);
        if (newThreshold > 24 hours) revert InvalidStalenessThreshold(newThreshold);

        uint256 oldThreshold = globalStalenessThreshold;
        globalStalenessThreshold = newThreshold;

        emit StalenessThresholdUpdated(oldThreshold, newThreshold);
    }

    /// @notice Update aggregator for an asset
    /// @param asset The token address
    /// @param newAggregator The new aggregator address
    function setAggregator(address asset, address newAggregator) external onlyRole(ADMIN_ROLE) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        if (newAggregator == address(0)) revert ZeroAddress();

        uint8 decimals = AggregatorV3Interface(newAggregator).decimals();
        _assetConfigs[asset].aggregator = newAggregator;
        _assetConfigs[asset].decimals = decimals;

        emit AssetConfigured(
            asset,
            newAggregator,
            decimals,
            _assetConfigs[asset].stalenessThreshold
        );
    }

    // =============================================================================
    // IOracleAdapter Implementation
    // =============================================================================

    /// @inheritdoc IOracleAdapter
    function getPrice(address asset) external view override returns (uint256 price) {
        (price, ) = _getPriceInternal(asset);
    }

    /// @inheritdoc IOracleAdapter
    function getPriceWithTimestamp(address asset) external view override returns (uint256 price, uint256 updatedAt) {
        return _getPriceInternal(asset);
    }

    /// @inheritdoc IOracleAdapter
    function getPriceWithSource(address asset) external view override returns (uint256 price, uint256 updatedAt, OracleSource source) {
        (price, updatedAt) = _getPriceInternal(asset);
        return (price, updatedAt, OracleSource.BACKUP);
    }

    /// @inheritdoc IOracleAdapter
    function isPriceStale(address asset) external view override returns (bool isStale) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        (, uint256 timestamp) = _getPriceInternal(asset);
        uint256 threshold = _getStalenessThreshold(asset);

        return timestamp + threshold < block.timestamp;
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get asset configuration
    /// @param asset The token address
    /// @return config The asset configuration
    function getAssetConfig(address asset) external view returns (AssetConfig memory config) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        return _assetConfigs[asset];
    }

    /// @notice Get all configured assets
    /// @return assets Array of configured asset addresses
    function getConfiguredAssets() external view returns (address[] memory assets) {
        return _configuredAssets;
    }

    /// @notice Get the number of configured assets
    /// @return count Number of configured assets
    function configuredAssetCount() external view returns (uint256 count) {
        return _configuredAssets.length;
    }

    /// @notice Check if an asset is configured
    /// @param asset The token address
    /// @return True if configured
    function isConfigured(address asset) external view returns (bool) {
        return _assetConfigs[asset].isConfigured;
    }

    /// @notice Get the staleness threshold for an asset
    /// @param asset The token address
    /// @return threshold The staleness threshold in seconds
    function getStalenessThreshold(address asset) external view returns (uint256 threshold) {
        return _getStalenessThreshold(asset);
    }

    /// @notice Get the aggregator address for an asset
    /// @param asset The token address
    /// @return The aggregator address
    function getAggregator(address asset) external view returns (address) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        return _assetConfigs[asset].aggregator;
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    /// @dev Get price from Chainlink aggregator
    function _getPriceInternal(address asset) internal view returns (uint256 price, uint256 timestamp) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        AssetConfig memory config = _assetConfigs[asset];

        // Get latest round data from Chainlink
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(config.aggregator).latestRoundData();

        // Validate round completion
        if (answeredInRound < roundId) {
            revert IncompleteRound(asset, roundId, answeredInRound);
        }

        // Validate price
        if (answer <= 0) revert InvalidPrice(asset, answer);

        // Convert to 18 decimals
        if (config.decimals < 18) {
            price = uint256(answer) * (10 ** (18 - config.decimals));
        } else if (config.decimals > 18) {
            price = uint256(answer) / (10 ** (config.decimals - 18));
        } else {
            price = uint256(answer);
        }

        timestamp = updatedAt;
    }

    /// @dev Get staleness threshold for an asset
    function _getStalenessThreshold(address asset) internal view returns (uint256) {
        uint256 customThreshold = _assetConfigs[asset].stalenessThreshold;
        return customThreshold > 0 ? customThreshold : globalStalenessThreshold;
    }
}
