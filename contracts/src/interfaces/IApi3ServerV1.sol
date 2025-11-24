// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IApi3ServerV1
/// @notice Interface for API3 dAPI Server V1
/// @dev See https://docs.api3.org/reference/dapis/understand/
interface IApi3ServerV1 {
    /// @notice Reads the data feed with ID
    /// @param dataFeedId The data feed ID (keccak256 hash of dAPI name)
    /// @return value The data feed value (typically price with 18 decimals)
    /// @return timestamp The timestamp of the last update
    function readDataFeedWithId(bytes32 dataFeedId) external view returns (int224 value, uint32 timestamp);

    /// @notice Reads the data feed with dAPI name
    /// @param dapiName The dAPI name (e.g., "ETH/USD")
    /// @return value The data feed value
    /// @return timestamp The timestamp of the last update
    function readDataFeedWithDapiName(bytes32 dapiName) external view returns (int224 value, uint32 timestamp);

    /// @notice Gets the data feed ID from dAPI name
    /// @param dapiName The dAPI name
    /// @return dataFeedId The data feed ID
    function dapiNameToDataFeedId(bytes32 dapiName) external view returns (bytes32 dataFeedId);

    /// @notice Reads the data feed with dAPI name hash
    /// @param dapiNameHash The keccak256 hash of the dAPI name
    /// @return value The data feed value
    /// @return timestamp The timestamp of the last update
    function readDataFeedWithDapiNameHash(bytes32 dapiNameHash) external view returns (int224 value, uint32 timestamp);
}
