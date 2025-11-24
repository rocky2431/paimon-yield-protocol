// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAssetRegistry
/// @author Paimon Yield Protocol
/// @notice Interface for the RWA asset registry
interface IAssetRegistry {
    /// @notice Types of RWA assets supported
    enum AssetType {
        TOKENIZED_BOND,
        TOKENIZED_STOCK,
        TOKENIZED_COMMODITY,
        REAL_ESTATE,
        YIELD_BEARING,
        OTHER
    }

    /// @notice RWA Asset metadata structure
    struct RWAAsset {
        address tokenAddress;
        string name;
        string symbol;
        AssetType assetType;
        address oracleSource;
        bool isActive;
        uint256 registeredAt;
    }

    /// @notice Get asset data by token address
    function getAsset(address tokenAddress) external view returns (RWAAsset memory);

    /// @notice Get all registered assets
    function getAllAssets() external view returns (RWAAsset[] memory);

    /// @notice Get all active assets
    function getActiveAssets() external view returns (RWAAsset[] memory);

    /// @notice Get all registered asset addresses
    function getAssetAddresses() external view returns (address[] memory);

    /// @notice Check if an asset is registered
    function isRegistered(address tokenAddress) external view returns (bool);

    /// @notice Check if an asset is active
    function isActive(address tokenAddress) external view returns (bool);

    /// @notice Get the total number of registered assets
    function assetCount() external view returns (uint256);
}
