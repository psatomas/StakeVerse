// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal, test-only AggregatorV3Interface-compatible mock. Lets
/// tests independently control every field PriceOracleConsumer's hardened
/// validation inspects (roundId, answer, updatedAt, answeredInRound), plus
/// decimals(). Not deployed as part of the protocol — used only by
/// test/oracle.test.ts.
contract MockV3Aggregator {
    uint8 private _decimals;
    int256 private _answer;
    uint80 private _roundId;
    uint256 private _startedAt;
    uint256 private _updatedAt;
    uint80 private _answeredInRound;

    /// @dev Preserves the original single-argument constructor signature
    /// (MockV3Aggregator(int256 _answer)) so existing call sites keep
    /// working unchanged. Defaults to a realistic, currently-fresh, valid
    /// round: roundId = answeredInRound = 1, startedAt = updatedAt =
    /// block.timestamp at deployment, decimals = 8 (matching real
    /// Chainlink ETH/USD feeds). Any field can be overridden afterward via
    /// the setters below.
    constructor(int256 initialAnswer) {
        _answer = initialAnswer;
        _decimals = 8;
        _roundId = 1;
        _answeredInRound = 1;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    // --- test-only setters, one per field consumers may need to control ---

    function setAnswer(int256 newAnswer) external {
        _answer = newAnswer;
    }

    function setRoundId(uint80 newRoundId) external {
        _roundId = newRoundId;
    }

    function setStartedAt(uint256 newStartedAt) external {
        _startedAt = newStartedAt;
    }

    function setUpdatedAt(uint256 newUpdatedAt) external {
        _updatedAt = newUpdatedAt;
    }

    function setAnsweredInRound(uint80 newAnsweredInRound) external {
        _answeredInRound = newAnsweredInRound;
    }

    function setDecimals(uint8 newDecimals) external {
        _decimals = newDecimals;
    }
}
