// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title AssetRegistry
/// @author Paimon Yield Protocol
/// @notice Registry for managing RWA (Real World Asset) tokens
/// @dev Manages asset metadata, oracle sources, and activation status
contract AssetRegistry is AccessControl {
    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Role identifier for admin operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Maximum number of assets that can be registered
    uint256 public constant MAX_ASSETS = 50;

    // =============================================================================
    // Enums
    // =============================================================================

    /// @notice Types of RWA assets supported
    enum AssetType {
        TOKENIZED_BOND,      // Tokenized government/corporate bonds
        TOKENIZED_STOCK,     // Tokenized equities
        TOKENIZED_COMMODITY, // Tokenized commodities (gold, silver)
        REAL_ESTATE,         // Tokenized real estate
        YIELD_BEARING,       // Yield-bearing stablecoins (e.g., USDY)
        OTHER                // Other RWA types
    }

    // =============================================================================
    // Structs
    // =============================================================================

    /// @notice RWA Asset metadata structure
    struct RWAAsset {
        address tokenAddress;    // ERC20 token address
        string name;             // Asset name
        string symbol;           // Asset symbol
        AssetType assetType;     // Type of RWA
        address oracleSource;    // Oracle address for price feeds
        bool isActive;           // Whether asset is active for trading
        uint256 registeredAt;    // Timestamp when registered
    }

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice Mapping from token address to asset data
    mapping(address => RWAAsset) private _assets;

    /// @notice Array of all registered asset addresses
    address[] private _assetList;

    /// @notice Mapping to track if an address is registered
    mapping(address => bool) private _isRegistered;

    /// @notice Mapping to track assets marked for removal
    mapping(address => bool) private _markedForRemoval;

    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when a new asset is registered
    event AssetRegistered(
        address indexed tokenAddress,
        string name,
        string symbol,
        AssetType assetType,
        address oracleSource
    );

    /// @notice Emitted when an asset is removed
    event AssetRemoved(address indexed tokenAddress);

    /// @notice Emitted when an asset's status is updated
    event AssetStatusUpdated(address indexed tokenAddress, bool isActive);

    /// @notice Emitted when an asset's oracle source is updated
    event OracleSourceUpdated(address indexed tokenAddress, address newOracleSource);

    /// @notice Emitted when an asset is marked for removal
    event AssetMarkedForRemoval(address indexed tokenAddress);

    /// @notice Emitted when an asset is unmarked for removal
    event AssetUnmarkedForRemoval(address indexed tokenAddress);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when asset is already registered
    error AssetAlreadyRegistered(address tokenAddress);

    /// @notice Thrown when asset is not found
    error AssetNotFound(address tokenAddress);

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when maximum assets limit is reached
    error MaxAssetsReached(uint256 current, uint256 max);

    /// @notice Thrown when string is empty
    error EmptyString();

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the AssetRegistry
    /// @param admin_ The initial admin address
    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Register a new RWA asset
    /// @param tokenAddress The ERC20 token address
    /// @param assetType The type of RWA asset
    /// @param oracleSource The oracle address for price feeds
    function registerAsset(
        address tokenAddress,
        AssetType assetType,
        address oracleSource
    ) external onlyRole(ADMIN_ROLE) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (_isRegistered[tokenAddress]) revert AssetAlreadyRegistered(tokenAddress);
        if (_assetList.length >= MAX_ASSETS) {
            revert MaxAssetsReached(_assetList.length, MAX_ASSETS);
        }

        // Get name and symbol from token
        string memory name = IERC20Metadata(tokenAddress).name();
        string memory symbol = IERC20Metadata(tokenAddress).symbol();

        _assets[tokenAddress] = RWAAsset({
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            assetType: assetType,
            oracleSource: oracleSource,
            isActive: true,
            registeredAt: block.timestamp
        });

        _assetList.push(tokenAddress);
        _isRegistered[tokenAddress] = true;

        emit AssetRegistered(tokenAddress, name, symbol, assetType, oracleSource);
    }

    /// @notice Register a new RWA asset with custom name/symbol
    /// @param tokenAddress The ERC20 token address
    /// @param name Custom name for the asset
    /// @param symbol Custom symbol for the asset
    /// @param assetType The type of RWA asset
    /// @param oracleSource The oracle address for price feeds
    function registerAssetWithMetadata(
        address tokenAddress,
        string calldata name,
        string calldata symbol,
        AssetType assetType,
        address oracleSource
    ) external onlyRole(ADMIN_ROLE) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (_isRegistered[tokenAddress]) revert AssetAlreadyRegistered(tokenAddress);
        if (_assetList.length >= MAX_ASSETS) {
            revert MaxAssetsReached(_assetList.length, MAX_ASSETS);
        }
        if (bytes(name).length == 0) revert EmptyString();
        if (bytes(symbol).length == 0) revert EmptyString();

        _assets[tokenAddress] = RWAAsset({
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            assetType: assetType,
            oracleSource: oracleSource,
            isActive: true,
            registeredAt: block.timestamp
        });

        _assetList.push(tokenAddress);
        _isRegistered[tokenAddress] = true;

        emit AssetRegistered(tokenAddress, name, symbol, assetType, oracleSource);
    }

    /// @notice Remove an asset from the registry
    /// @param tokenAddress The token address to remove
    function removeAsset(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);

        // Find and remove from array
        uint256 length = _assetList.length;
        for (uint256 i = 0; i < length; i++) {
            if (_assetList[i] == tokenAddress) {
                // Move last element to this position and pop
                _assetList[i] = _assetList[length - 1];
                _assetList.pop();
                break;
            }
        }

        delete _assets[tokenAddress];
        _isRegistered[tokenAddress] = false;

        emit AssetRemoved(tokenAddress);
    }

    /// @notice Update an asset's active status
    /// @param tokenAddress The token address
    /// @param isActive The new active status
    function setAssetStatus(
        address tokenAddress,
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);

        _assets[tokenAddress].isActive = isActive;

        emit AssetStatusUpdated(tokenAddress, isActive);
    }

    /// @notice Update an asset's oracle source
    /// @param tokenAddress The token address
    /// @param newOracleSource The new oracle address
    function setOracleSource(
        address tokenAddress,
        address newOracleSource
    ) external onlyRole(ADMIN_ROLE) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);

        _assets[tokenAddress].oracleSource = newOracleSource;

        emit OracleSourceUpdated(tokenAddress, newOracleSource);
    }

    /// @notice Mark an asset for removal (pending state before actual removal)
    /// @dev Used to signal that asset should be liquidated and removed from vaults
    /// @param tokenAddress The token address to mark
    function markAssetForRemoval(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);

        _markedForRemoval[tokenAddress] = true;
        // Also deactivate the asset to prevent new purchases
        _assets[tokenAddress].isActive = false;

        emit AssetMarkedForRemoval(tokenAddress);
        emit AssetStatusUpdated(tokenAddress, false);
    }

    /// @notice Unmark an asset for removal
    /// @param tokenAddress The token address to unmark
    function unmarkAssetForRemoval(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);

        _markedForRemoval[tokenAddress] = false;

        emit AssetUnmarkedForRemoval(tokenAddress);
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get asset data by token address
    /// @param tokenAddress The token address
    /// @return Asset data
    function getAsset(address tokenAddress) external view returns (RWAAsset memory) {
        if (!_isRegistered[tokenAddress]) revert AssetNotFound(tokenAddress);
        return _assets[tokenAddress];
    }

    /// @notice Get all registered assets
    /// @return Array of all asset data
    function getAllAssets() external view returns (RWAAsset[] memory) {
        uint256 length = _assetList.length;
        RWAAsset[] memory assets = new RWAAsset[](length);

        for (uint256 i = 0; i < length; i++) {
            assets[i] = _assets[_assetList[i]];
        }

        return assets;
    }

    /// @notice Get all active assets
    /// @return Array of active asset data
    function getActiveAssets() external view returns (RWAAsset[] memory) {
        uint256 length = _assetList.length;
        uint256 activeCount = 0;

        // Count active assets
        for (uint256 i = 0; i < length; i++) {
            if (_assets[_assetList[i]].isActive) {
                activeCount++;
            }
        }

        // Build active assets array
        RWAAsset[] memory activeAssets = new RWAAsset[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < length; i++) {
            if (_assets[_assetList[i]].isActive) {
                activeAssets[index] = _assets[_assetList[i]];
                index++;
            }
        }

        return activeAssets;
    }

    /// @notice Get all registered asset addresses
    /// @return Array of token addresses
    function getAssetAddresses() external view returns (address[] memory) {
        return _assetList;
    }

    /// @notice Check if an asset is registered
    /// @param tokenAddress The token address to check
    /// @return True if registered
    function isRegistered(address tokenAddress) external view returns (bool) {
        return _isRegistered[tokenAddress];
    }

    /// @notice Check if an asset is active
    /// @param tokenAddress The token address to check
    /// @return True if active
    function isActive(address tokenAddress) external view returns (bool) {
        if (!_isRegistered[tokenAddress]) return false;
        return _assets[tokenAddress].isActive;
    }

    /// @notice Get the total number of registered assets
    /// @return Number of assets
    function assetCount() external view returns (uint256) {
        return _assetList.length;
    }

    /// @notice Get asset by index
    /// @param index The index in the asset list
    /// @return Asset data
    function getAssetByIndex(uint256 index) external view returns (RWAAsset memory) {
        require(index < _assetList.length, "Index out of bounds");
        return _assets[_assetList[index]];
    }

    /// @notice Check if an asset is marked for removal
    /// @param tokenAddress The token address to check
    /// @return True if marked for removal
    function isMarkedForRemoval(address tokenAddress) external view returns (bool) {
        return _markedForRemoval[tokenAddress];
    }
}
