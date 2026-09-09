// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Test-only target used to prove StakeVerseDAO.executeProposal()
/// actually performs the approved on-chain action with the exact
/// target/value/calldata that governance approved. Not part of the deployed
/// protocol.
contract MockGovernanceTarget {
    uint256 public value;
    uint256 public callCount;
    uint256 public totalValueReceived;
    address public lastCaller;

    event ValueSet(uint256 newValue, uint256 msgValue, address caller);

    function setValue(uint256 newValue) external payable {
        value = newValue;
        callCount++;
        totalValueReceived += msg.value;
        lastCaller = msg.sender;
        emit ValueSet(newValue, msg.value, msg.sender);
    }

    function alwaysReverts() external pure {
        revert("MockGovernanceTarget: always reverts");
    }
}
