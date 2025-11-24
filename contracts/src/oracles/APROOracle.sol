// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IOracleAdapter} from "../interfaces/IOracleAdapter.sol";
import {IApi3ServerV1} from "../interfaces/IApi3ServerV1.sol";

/// @title APROOracle
/// @author Paimon Yield Protocol
/// @notice Oracle adapter for APRO (API3 dAPI) price feeds
/// @dev Implements IOracleAdapter interface, wraps API3 dAPI proxy calls
contract APROOracle is IOracleAdapter, AccessControl {
    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Role identifier for admin operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Default staleness threshold (2 hours)
    uint256 public constant DEFAULT_STALENESS_THRESHOLD = 2 hours;

    /// @notice Price precision (18 decimals)
    uint256 public constant PRICE_PRECISION = 1e18;

    // =============================================================================
    // Structs
    // =============================================================================

    /// @notice Asset configuration for API3 dAPI
    struct AssetConfig {
        bytes32 dataFeedId;         // API3 data feed ID
        uint256 stalenessThreshold; // Custom staleness threshold (0 = use default)
        bool isConfigured;          // Whether the asset is configured
    }

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice API3 dAPI Server proxy address
    IApi3ServerV1 public immutable api3Server;

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
        bytes32 dataFeedId,
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

    /// @notice Thrown when data feed ID is zero
    error ZeroDataFeedId();

    /// @notice Thrown when price is zero or negative
    error InvalidPrice(address asset, int224 price);

    /// @notice Thrown when staleness threshold is invalid
    error InvalidStalenessThreshold(uint256 threshold);

    /// @notice Thrown when API3 call fails
    error Api3CallFailed(address asset, string reason);

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the APROOracle
    /// @param api3Server_ The API3 dAPI Server proxy address
    /// @param admin_ The initial admin address
    constructor(address api3Server_, address admin_) {
        if (api3Server_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        api3Server = IApi3ServerV1(api3Server_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        globalStalenessThreshold = DEFAULT_STALENESS_THRESHOLD;
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Configure an asset with its API3 data feed
    /// @param asset The token address
    /// @param dataFeedId The API3 data feed ID
    /// @param stalenessThreshold Custom staleness threshold (0 = use global)
    function configureAsset(
        address asset,
        bytes32 dataFeedId,
        uint256 stalenessThreshold
    ) external onlyRole(ADMIN_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        if (dataFeedId == bytes32(0)) revert ZeroDataFeedId();

        if (!_assetConfigs[asset].isConfigured) {
            _configuredAssets.push(asset);
        }

        _assetConfigs[asset] = AssetConfig({
            dataFeedId: dataFeedId,
            stalenessThreshold: stalenessThreshold,
            isConfigured: true
        });

        emit AssetConfigured(asset, dataFeedId, stalenessThreshold);
    }

    /// @notice Configure an asset using dAPI name
    /// @param asset The token address
    /// @param dapiName The dAPI name (e.g., "ETH/USD" as bytes32)
    /// @param stalenessThreshold Custom staleness threshold (0 = use global)
    function configureAssetWithDapiName(
        address asset,
        bytes32 dapiName,
        uint256 stalenessThreshold
    ) external onlyRole(ADMIN_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        if (dapiName == bytes32(0)) revert ZeroDataFeedId();

        // Get data feed ID from dAPI name
        bytes32 dataFeedId = api3Server.dapiNameToDataFeedId(dapiName);

        if (!_assetConfigs[asset].isConfigured) {
            _configuredAssets.push(asset);
        }

        _assetConfigs[asset] = AssetConfig({
            dataFeedId: dataFeedId,
            stalenessThreshold: stalenessThreshold,
            isConfigured: true
        });

        emit AssetConfigured(asset, dataFeedId, stalenessThreshold);
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
        return (price, updatedAt, OracleSource.PRIMARY);
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

    /// @notice Get the API3 server address
    /// @return The API3 server proxy address
    function getApi3Server() external view returns (address) {
        return address(api3Server);
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    /// @dev Get price from API3 dAPI
    function _getPriceInternal(address asset) internal view returns (uint256 price, uint256 timestamp) {
        if (!_assetConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        AssetConfig memory config = _assetConfigs[asset];

        // Call API3 dAPI Server
        (int224 value, uint32 updatedAt) = api3Server.readDataFeedWithId(config.dataFeedId);

        // Validate price
        if (value <= 0) revert InvalidPrice(asset, value);

        // Convert int224 to uint256 (API3 uses 18 decimals)
        price = uint256(uint224(value));
        timestamp = uint256(updatedAt);
    }

    /// @dev Get staleness threshold for an asset
    function _getStalenessThreshold(address asset) internal view returns (uint256) {
        uint256 customThreshold = _assetConfigs[asset].stalenessThreshold;
        return customThreshold > 0 ? customThreshold : globalStalenessThreshold;
    }
}
