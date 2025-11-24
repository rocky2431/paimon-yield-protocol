// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOracleAdapter
/// @author Paimon Yield Protocol
/// @notice Interface for oracle price feeds
/// @dev Implemented by OracleAdapter (Task #31)
interface IOracleAdapter {
    /// @notice Get the price of an asset in USD (18 decimals)
    /// @param asset The token address to get price for
    /// @return price The price in USD with 18 decimals
    function getPrice(address asset) external view returns (uint256 price);

    /// @notice Get the price and timestamp of last update
    /// @param asset The token address to get price for
    /// @return price The price in USD with 18 decimals
    /// @return updatedAt Timestamp of last price update
    function getPriceWithTimestamp(address asset) external view returns (uint256 price, uint256 updatedAt);

    /// @notice Check if price data is stale
    /// @param asset The token address to check
    /// @return isStale True if price data is older than staleness threshold
    function isPriceStale(address asset) external view returns (bool isStale);
}
