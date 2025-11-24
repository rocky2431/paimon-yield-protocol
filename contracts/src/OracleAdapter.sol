// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IOracleAdapter} from "./interfaces/IOracleAdapter.sol";

/// @title OracleAdapter
/// @author Paimon Yield Protocol
/// @notice Dual Oracle adapter with automatic failover support
/// @dev Supports primary (APRO/API3) and backup (Chainlink) Oracle sources
contract OracleAdapter is IOracleAdapter, AccessControl {
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

    /// @notice Oracle configuration for an asset
    struct OracleConfig {
        address primaryOracle;      // Primary oracle address (APRO/API3)
        address backupOracle;       // Backup oracle address (Chainlink)
        uint256 stalenessThreshold; // Custom staleness threshold (0 = use default)
        bool isConfigured;          // Whether the asset is configured
    }

    /// @notice Price data structure
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        OracleSource source;
    }

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice Oracle configurations per asset
    mapping(address => OracleConfig) private _oracleConfigs;

    /// @notice Array of configured assets
    address[] private _configuredAssets;

    /// @notice Global staleness threshold
    uint256 public globalStalenessThreshold;

    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when an asset's oracle is configured
    event OracleConfigured(
        address indexed asset,
        address primaryOracle,
        address backupOracle,
        uint256 stalenessThreshold
    );

    /// @notice Emitted when an asset's oracle configuration is removed
    event OracleRemoved(address indexed asset);

    /// @notice Emitted when a failover occurs
    event OracleFailover(
        address indexed asset,
        OracleSource fromSource,
        OracleSource toSource,
        string reason
    );

    /// @notice Emitted when global staleness threshold is updated
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when asset is not configured
    error AssetNotConfigured(address asset);

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when price is zero or invalid
    error InvalidPrice(address asset, uint256 price);

    /// @notice Thrown when both oracles fail
    error AllOraclesFailed(address asset);

    /// @notice Thrown when staleness threshold is invalid
    error InvalidStalenessThreshold(uint256 threshold);

    /// @notice Thrown when asset is already configured
    error AssetAlreadyConfigured(address asset);

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the OracleAdapter
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

    /// @notice Configure oracle sources for an asset
    /// @param asset The token address
    /// @param primaryOracle The primary oracle address (APRO/API3)
    /// @param backupOracle The backup oracle address (Chainlink)
    /// @param stalenessThreshold Custom staleness threshold (0 = use global)
    function configureOracle(
        address asset,
        address primaryOracle,
        address backupOracle,
        uint256 stalenessThreshold
    ) external onlyRole(ADMIN_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        // At least one oracle must be configured
        if (primaryOracle == address(0) && backupOracle == address(0)) {
            revert ZeroAddress();
        }

        if (!_oracleConfigs[asset].isConfigured) {
            _configuredAssets.push(asset);
        }

        _oracleConfigs[asset] = OracleConfig({
            primaryOracle: primaryOracle,
            backupOracle: backupOracle,
            stalenessThreshold: stalenessThreshold,
            isConfigured: true
        });

        emit OracleConfigured(asset, primaryOracle, backupOracle, stalenessThreshold);
    }

    /// @notice Remove oracle configuration for an asset
    /// @param asset The token address
    function removeOracle(address asset) external onlyRole(ADMIN_ROLE) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        // Remove from array
        uint256 length = _configuredAssets.length;
        for (uint256 i = 0; i < length; i++) {
            if (_configuredAssets[i] == asset) {
                _configuredAssets[i] = _configuredAssets[length - 1];
                _configuredAssets.pop();
                break;
            }
        }

        delete _oracleConfigs[asset];

        emit OracleRemoved(asset);
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

    /// @notice Update primary oracle for an asset
    /// @param asset The token address
    /// @param newPrimaryOracle The new primary oracle address
    function setPrimaryOracle(address asset, address newPrimaryOracle) external onlyRole(ADMIN_ROLE) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        if (newPrimaryOracle == address(0) && _oracleConfigs[asset].backupOracle == address(0)) {
            revert ZeroAddress();
        }

        _oracleConfigs[asset].primaryOracle = newPrimaryOracle;

        emit OracleConfigured(
            asset,
            newPrimaryOracle,
            _oracleConfigs[asset].backupOracle,
            _oracleConfigs[asset].stalenessThreshold
        );
    }

    /// @notice Update backup oracle for an asset
    /// @param asset The token address
    /// @param newBackupOracle The new backup oracle address
    function setBackupOracle(address asset, address newBackupOracle) external onlyRole(ADMIN_ROLE) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        if (newBackupOracle == address(0) && _oracleConfigs[asset].primaryOracle == address(0)) {
            revert ZeroAddress();
        }

        _oracleConfigs[asset].backupOracle = newBackupOracle;

        emit OracleConfigured(
            asset,
            _oracleConfigs[asset].primaryOracle,
            newBackupOracle,
            _oracleConfigs[asset].stalenessThreshold
        );
    }

    // =============================================================================
    // IOracleAdapter Implementation
    // =============================================================================

    /// @inheritdoc IOracleAdapter
    function getPrice(address asset) external view override returns (uint256 price) {
        (price, , ) = _getPriceInternal(asset);
    }

    /// @inheritdoc IOracleAdapter
    function getPriceWithTimestamp(address asset) external view override returns (uint256 price, uint256 updatedAt) {
        (price, updatedAt, ) = _getPriceInternal(asset);
    }

    /// @inheritdoc IOracleAdapter
    function getPriceWithSource(address asset) external view override returns (uint256 price, uint256 updatedAt, OracleSource source) {
        return _getPriceInternal(asset);
    }

    /// @inheritdoc IOracleAdapter
    function isPriceStale(address asset) external view override returns (bool isStale) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        (, uint256 timestamp, ) = _getPriceInternal(asset);
        uint256 threshold = _getStalenessThreshold(asset);

        return timestamp + threshold < block.timestamp;
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get oracle configuration for an asset
    /// @param asset The token address
    /// @return config The oracle configuration
    function getOracleConfig(address asset) external view returns (OracleConfig memory config) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);
        return _oracleConfigs[asset];
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
        return _oracleConfigs[asset].isConfigured;
    }

    /// @notice Get the staleness threshold for an asset
    /// @param asset The token address
    /// @return threshold The staleness threshold in seconds
    function getStalenessThreshold(address asset) external view returns (uint256 threshold) {
        return _getStalenessThreshold(asset);
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    /// @dev Get price with automatic failover
    function _getPriceInternal(address asset) internal view returns (uint256 price, uint256 timestamp, OracleSource source) {
        if (!_oracleConfigs[asset].isConfigured) revert AssetNotConfigured(asset);

        OracleConfig memory config = _oracleConfigs[asset];
        uint256 threshold = _getStalenessThreshold(asset);

        // Try primary oracle first
        if (config.primaryOracle != address(0)) {
            (bool success, uint256 primaryPrice, uint256 primaryTimestamp) = _tryGetPrice(config.primaryOracle, asset);

            if (success && primaryPrice > 0 && primaryTimestamp + threshold >= block.timestamp) {
                return (primaryPrice, primaryTimestamp, OracleSource.PRIMARY);
            }
        }

        // Failover to backup oracle
        if (config.backupOracle != address(0)) {
            (bool success, uint256 backupPrice, uint256 backupTimestamp) = _tryGetPrice(config.backupOracle, asset);

            if (success && backupPrice > 0) {
                return (backupPrice, backupTimestamp, OracleSource.BACKUP);
            }
        }

        // If we have a primary price but it's stale, return it anyway as last resort
        if (config.primaryOracle != address(0)) {
            (bool success, uint256 primaryPrice, uint256 primaryTimestamp) = _tryGetPrice(config.primaryOracle, asset);
            if (success && primaryPrice > 0) {
                return (primaryPrice, primaryTimestamp, OracleSource.PRIMARY);
            }
        }

        revert AllOraclesFailed(asset);
    }

    /// @dev Try to get price from an oracle, returns success flag
    function _tryGetPrice(address oracle, address asset) internal view returns (bool success, uint256 price, uint256 timestamp) {
        try IOracleAdapter(oracle).getPriceWithTimestamp(asset) returns (uint256 p, uint256 t) {
            return (true, p, t);
        } catch {
            return (false, 0, 0);
        }
    }

    /// @dev Get staleness threshold for an asset
    function _getStalenessThreshold(address asset) internal view returns (uint256) {
        uint256 customThreshold = _oracleConfigs[asset].stalenessThreshold;
        return customThreshold > 0 ? customThreshold : globalStalenessThreshold;
    }
}
