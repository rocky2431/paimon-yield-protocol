// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../../src/interfaces/IChainlinkAggregator.sol";

/// @title MockChainlinkAggregator
/// @notice Mock Chainlink aggregator for testing
contract MockChainlinkAggregator is AggregatorV3Interface {
    // =============================================================================
    // State
    // =============================================================================

    uint8 private _decimals;
    string private _description;
    uint256 private _version;

    int256 private _answer;
    uint256 private _updatedAt;
    uint80 private _roundId;
    uint80 private _answeredInRound;

    bool private _shouldFail;

    // =============================================================================
    // Constructor
    // =============================================================================

    constructor(uint8 decimals_, string memory description_) {
        _decimals = decimals_;
        _description = description_;
        _version = 1;
        _roundId = 1;
        _answeredInRound = 1;
    }

    // =============================================================================
    // Mock Functions
    // =============================================================================

    /// @notice Set the price answer
    /// @param answer The price value
    function setAnswer(int256 answer) external {
        _answer = answer;
        _updatedAt = block.timestamp;
        _roundId++;
        _answeredInRound = _roundId;
    }

    /// @notice Set the price with custom timestamp
    /// @param answer The price value
    /// @param updatedAt The timestamp
    function setAnswerWithTimestamp(int256 answer, uint256 updatedAt) external {
        _answer = answer;
        _updatedAt = updatedAt;
        _roundId++;
        _answeredInRound = _roundId;
    }

    /// @notice Set incomplete round (for testing validation)
    /// @param answer The price value
    /// @param roundId_ The round ID
    /// @param answeredInRound_ The answered in round
    function setIncompleteRound(int256 answer, uint80 roundId_, uint80 answeredInRound_) external {
        _answer = answer;
        _updatedAt = block.timestamp;
        _roundId = roundId_;
        _answeredInRound = answeredInRound_;
    }

    /// @notice Set whether calls should fail
    /// @param shouldFail True to make calls fail
    function setShouldFail(bool shouldFail) external {
        _shouldFail = shouldFail;
    }

    /// @notice Update decimals
    /// @param decimals_ New decimals value
    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }

    // =============================================================================
    // AggregatorV3Interface Implementation
    // =============================================================================

    /// @inheritdoc AggregatorV3Interface
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    /// @inheritdoc AggregatorV3Interface
    function description() external view override returns (string memory) {
        return _description;
    }

    /// @inheritdoc AggregatorV3Interface
    function version() external view override returns (uint256) {
        return _version;
    }

    /// @inheritdoc AggregatorV3Interface
    function getRoundData(uint80)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (_shouldFail) {
            revert("Chainlink: Call failed");
        }
        return (_roundId, _answer, _updatedAt, _updatedAt, _answeredInRound);
    }

    /// @inheritdoc AggregatorV3Interface
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (_shouldFail) {
            revert("Chainlink: Call failed");
        }
        return (_roundId, _answer, _updatedAt, _updatedAt, _answeredInRound);
    }
}
