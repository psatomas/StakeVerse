// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceOracleConsumer {

    AggregatorV3Interface internal priceFeed;

    /// @notice Maximum age, in seconds, a round's `updatedAt` may have
    /// before getLatestETHPrice() rejects it as stale.
    ///
    /// Chosen at 3 hours (10,800s): comfortably above the ~1 hour heartbeat
    /// typical of Chainlink ETH/USD feeds (mainnet and most testnets,
    /// including Sepolia), leaving margin for ordinary publish-timing
    /// variance without masking a genuinely stalled feed. StakeVerse's MVP
    /// has no time-critical liquidation/settlement logic riding on this
    /// value, so this is a fixed constant rather than a governance- or
    /// owner-adjustable parameter: nothing in the current architecture
    /// requires it to ever change, and making it configurable would be
    /// exactly the kind of unnecessary abstraction this hardening pass is
    /// meant to avoid. Prioritizes predictable safety over maximum
    /// availability, per the MVP's stated intent.
    uint256 public constant MAX_ORACLE_AGE = 3 hours;

    constructor(address priceFeedAddress) {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    /// @notice Returns the latest validated ETH/USD price.
    ///
    /// Price units are UNCHANGED from the original implementation: this
    /// still returns the feed's raw `answer` with no decimal scaling —
    /// callers must still apply the feed's own `decimals()` themselves, as
    /// before. Nothing in this repository currently consumes this value
    /// economically, so no normalization behavior is being introduced or
    /// changed here (see Step 5 report, Part 8).
    ///
    /// Validation order:
    ///   1. roundId must be a real round (nonzero).
    ///   2. answer must be strictly positive.
    ///   3. updatedAt must be set (nonzero) and not in the future.
    ///   4. the round must not be older than MAX_ORACLE_AGE.
    ///   5. answeredInRound >= roundId — kept as a cheap defense-in-depth
    ///      check, NOT the primary staleness signal. Modern Chainlink OCR
    ///      aggregators (what any real feed behind this interface will be)
    ///      always report answeredInRound == roundId; the classic
    ///      "answeredInRound < roundId means stale" pattern is a vestige of
    ///      the deprecated Flux Aggregator design and carries no real
    ///      information against current feeds. It costs nothing to keep —
    ///      it never fires against a standard modern feed — and still
    ///      catches a genuinely non-standard/malformed one. The updatedAt
    ///      freshness check above is what actually guards staleness here.
    function getLatestETHPrice() public view returns (int256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(roundId > 0, "Invalid round");
        require(answer > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(updatedAt <= block.timestamp, "Future update");
        require(block.timestamp - updatedAt <= MAX_ORACLE_AGE, "Stale price");
        require(answeredInRound >= roundId, "Stale round");

        return answer;
    }
}
