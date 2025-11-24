// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IApi3ServerV1} from "../../src/interfaces/IApi3ServerV1.sol";

/// @title MockApi3Server
/// @notice Mock API3 dAPI Server for testing
contract MockApi3Server is IApi3ServerV1 {
    // =============================================================================
    // State
    // =============================================================================

    /// @notice Data feed values by ID
    mapping(bytes32 => int224) private _values;

    /// @notice Data feed timestamps by ID
    mapping(bytes32 => uint32) private _timestamps;

    /// @notice dAPI name to data feed ID mapping
    mapping(bytes32 => bytes32) private _dapiNameToId;

    /// @notice Flag to simulate failures
    bool private _shouldFail;

    // =============================================================================
    // Mock Functions
    // =============================================================================

    /// @notice Set the value and timestamp for a data feed
    /// @param dataFeedId The data feed ID
    /// @param value The price value (18 decimals)
    function setDataFeed(bytes32 dataFeedId, int224 value) external {
        _values[dataFeedId] = value;
        _timestamps[dataFeedId] = uint32(block.timestamp);
    }

    /// @notice Set the value and timestamp for a data feed with custom timestamp
    /// @param dataFeedId The data feed ID
    /// @param value The price value (18 decimals)
    /// @param timestamp The timestamp
    function setDataFeedWithTimestamp(bytes32 dataFeedId, int224 value, uint32 timestamp) external {
        _values[dataFeedId] = value;
        _timestamps[dataFeedId] = timestamp;
    }

    /// @notice Set the dAPI name to data feed ID mapping
    /// @param dapiName The dAPI name
    /// @param dataFeedId The data feed ID
    function setDapiNameMapping(bytes32 dapiName, bytes32 dataFeedId) external {
        _dapiNameToId[dapiName] = dataFeedId;
    }

    /// @notice Set whether calls should fail
    /// @param shouldFail True to make calls fail
    function setShouldFail(bool shouldFail) external {
        _shouldFail = shouldFail;
    }

    // =============================================================================
    // IApi3ServerV1 Implementation
    // =============================================================================

    /// @inheritdoc IApi3ServerV1
    function readDataFeedWithId(bytes32 dataFeedId) external view override returns (int224 value, uint32 timestamp) {
        if (_shouldFail) {
            revert("API3: Call failed");
        }
        return (_values[dataFeedId], _timestamps[dataFeedId]);
    }

    /// @inheritdoc IApi3ServerV1
    function readDataFeedWithDapiName(bytes32 dapiName) external view override returns (int224 value, uint32 timestamp) {
        if (_shouldFail) {
            revert("API3: Call failed");
        }
        bytes32 dataFeedId = _dapiNameToId[dapiName];
        return (_values[dataFeedId], _timestamps[dataFeedId]);
    }

    /// @inheritdoc IApi3ServerV1
    function dapiNameToDataFeedId(bytes32 dapiName) external view override returns (bytes32 dataFeedId) {
        return _dapiNameToId[dapiName];
    }

    /// @inheritdoc IApi3ServerV1
    function readDataFeedWithDapiNameHash(bytes32 dapiNameHash) external view override returns (int224 value, uint32 timestamp) {
        if (_shouldFail) {
            revert("API3: Call failed");
        }
        return (_values[dapiNameHash], _timestamps[dapiNameHash]);
    }
}
