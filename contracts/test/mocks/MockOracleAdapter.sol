// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOracleAdapter} from "../../src/interfaces/IOracleAdapter.sol";

/// @title MockOracleAdapter
/// @notice Mock oracle adapter for testing
contract MockOracleAdapter is IOracleAdapter {
    mapping(address => uint256) private _prices;
    mapping(address => uint256) private _timestamps;

    /// @notice Set the price for an asset
    function setPrice(address asset, uint256 price) external {
        _prices[asset] = price;
        _timestamps[asset] = block.timestamp;
    }

    /// @notice Set price with custom timestamp
    function setPriceWithTimestamp(address asset, uint256 price, uint256 timestamp) external {
        _prices[asset] = price;
        _timestamps[asset] = timestamp;
    }

    /// @inheritdoc IOracleAdapter
    function getPrice(address asset) external view override returns (uint256 price) {
        return _prices[asset];
    }

    /// @inheritdoc IOracleAdapter
    function getPriceWithTimestamp(address asset) external view override returns (uint256 price, uint256 updatedAt) {
        return (_prices[asset], _timestamps[asset]);
    }

    /// @inheritdoc IOracleAdapter
    function isPriceStale(address asset) external view override returns (bool isStale) {
        // Consider stale if older than 2 hours
        return _timestamps[asset] + 2 hours < block.timestamp;
    }
}
