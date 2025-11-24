// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AggregatorV3Interface
/// @notice Interface for Chainlink Price Feed Aggregators
/// @dev See https://docs.chain.link/data-feeds/price-feeds
interface AggregatorV3Interface {
    /// @notice Get the number of decimals for the price feed
    /// @return The number of decimals
    function decimals() external view returns (uint8);

    /// @notice Get the description of the price feed
    /// @return The description string
    function description() external view returns (string memory);

    /// @notice Get the version of the aggregator
    /// @return The version number
    function version() external view returns (uint256);

    /// @notice Get data from a specific round
    /// @param _roundId The round ID to get data for
    /// @return roundId The round ID
    /// @return answer The price answer
    /// @return startedAt When the round started
    /// @return updatedAt When the round was updated
    /// @return answeredInRound The round ID in which the answer was computed
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    /// @notice Get the latest round data
    /// @return roundId The round ID
    /// @return answer The price answer
    /// @return startedAt When the round started
    /// @return updatedAt When the round was updated
    /// @return answeredInRound The round ID in which the answer was computed
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
