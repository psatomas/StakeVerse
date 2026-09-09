// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";

contract StakeVerseDAO is Ownable, ReentrancyGuard {

    IVotes public governanceToken;

    uint256 public proposalCount;

    // Quorum is expressed explicitly as a numerator over 100 (not hardcoded
    // inline into the pass/fail calculation), so the policy is a readable,
    // owner-adjustable state variable rather than a magic constant.
    uint256 public constant QUORUM_DENOMINATOR = 100;
    uint256 public quorumNumerator = 10; // 10% of voting supply at snapshot

    // Minimum historical/delegated voting power (in governance-token voting
    // units, 18 decimals) an address must hold to create a proposal. Kept as
    // an explicit, owner-adjustable state variable rather than a magic
    // constant, matching quorumNumerator's style. Default is a modest
    // spam-resistance bar, not a meaningful concentration requirement.
    uint256 public proposalThreshold = 1_000 * 10 ** 18;

    enum ProposalState {
        Active,
        Failed,
        Succeeded,
        Executed
    }

    struct Proposal {
        uint256 id;
        string description;
        address target;
        uint256 value;
        bytes data;
        uint256 snapshotTimestamp;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;

    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed proposalId,
        string description,
        address target,
        uint256 value,
        uint256 snapshotTimestamp,
        uint256 deadline
    );

    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        address target,
        uint256 value,
        bytes data
    );

    event QuorumNumeratorUpdated(
        uint256 oldNumerator,
        uint256 newNumerator
    );

    event ProposalThresholdUpdated(
        uint256 oldThreshold,
        uint256 newThreshold
    );

    constructor(address tokenAddress, address initialOwner)
        Ownable(initialOwner)
    {
        governanceToken = IVotes(tokenAddress);
    }

    // Lets the DAO hold ETH so value-carrying proposals have something to
    // forward on execution. Not a general treasury feature — just enough for
    // the `value` field on a proposal to be meaningful.
    receive() external payable {}

    function createProposal(
        string memory description,
        uint256 durationInSeconds,
        address target,
        uint256 value,
        bytes calldata data
    ) external {
        require(durationInSeconds > 0, "Invalid duration");

        // A signaling-only proposal (no on-chain action) must not carry a
        // value/calldata payload that would silently be ignored.
        if (target == address(0)) {
            require(value == 0 && data.length == 0, "Target required for value/data");
        }

        // Snapshot is backdated by one second rather than taken at the
        // current timestamp. Votes.getPastVotes/getPastTotalSupply revert
        // if asked about a timepoint that is not strictly in the past. If
        // the snapshot were `block.timestamp` (now), a vote transaction
        // landing in the SAME block as proposal creation (same timestamp)
        // would hit that revert. Backdating by one second guarantees the
        // snapshot is already historical the instant the proposal exists,
        // without needing a separate voting-delay phase — voting can still
        // start immediately. block.timestamp is always far greater than 1
        // in practice, so this cannot underflow.
        //
        // The SAME backdated timepoint is reused below as the proposer's
        // eligibility check. This is deliberate and does double duty as the
        // anti-flash-loan guard for proposal creation: a delegate() call
        // made earlier in THIS SAME transaction/block only takes effect at
        // the current block's checkpoint, which is strictly after
        // `snapshot`. So borrowing tokens, self-delegating, and calling
        // createProposal all in one transaction cannot manufacture
        // eligibility — the proposer must have already held sufficient
        // delegated voting power as of a prior, already-finalized block.
        uint256 snapshot = block.timestamp - 1;
        uint256 deadline = block.timestamp + durationInSeconds;

        uint256 proposerVotes = governanceToken.getPastVotes(msg.sender, snapshot);
        require(proposerVotes >= proposalThreshold, "Below proposal threshold");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            id: proposalCount,
            description: description,
            target: target,
            value: value,
            data: data,
            snapshotTimestamp: snapshot,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0,
            executed: false
        });

        emit ProposalCreated(
            proposalCount,
            description,
            target,
            value,
            snapshot,
            deadline
        );
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Proposal does not exist");
        require(block.timestamp < proposal.deadline, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Historical, delegated voting power as of the proposal's snapshot —
        // never live balanceOf(). msg.sender is always the voter; there is
        // no on-behalf-of parameter, so one address can never cast a vote
        // attributed to another address.
        uint256 votingPower = governanceToken.getPastVotes(
            msg.sender,
            proposal.snapshotTimestamp
        );

        require(votingPower > 0, "No governance voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += votingPower;
        } else {
            proposal.noVotes += votingPower;
        }

        emit Voted(proposalId, msg.sender, support, votingPower);
    }

    /// @notice Whether combined participation (yes + no) has reached the
    /// quorum threshold, measured against total voting supply AT THE
    /// SNAPSHOT (not current supply).
    function quorumReached(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");

        uint256 totalVotingSupply = governanceToken.getPastTotalSupply(
            proposal.snapshotTimestamp
        );
        uint256 threshold = (totalVotingSupply * quorumNumerator) / QUORUM_DENOMINATOR;

        return (proposal.yesVotes + proposal.noVotes) >= threshold;
    }

    /// @notice Single source of truth for a proposal's lifecycle position.
    /// Computed on the fly from stored votes/timestamps/executed rather than
    /// stored as a separately-mutated field, so it can never drift out of
    /// sync with the numbers that actually determine it.
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        if (block.timestamp < proposal.deadline) {
            return ProposalState.Active;
        }

        if (!quorumReached(proposalId) || proposal.yesVotes <= proposal.noVotes) {
            return ProposalState.Failed;
        }

        return ProposalState.Succeeded;
    }

    /// @notice Executes a successful proposal's on-chain action, if any.
    /// Permissionless: anyone may trigger execution once state() is
    /// Succeeded — authorization comes entirely from that state check, not
    /// from the caller's identity.
    function executeProposal(uint256 proposalId) external nonReentrant {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "Proposal not executable"
        );

        Proposal storage proposal = proposals[proposalId];

        // Effect before interaction: if the external call below fails, the
        // require() reverts this entire transaction, which also undoes this
        // write — so a failed execution leaves `executed` false and the
        // proposal remains Succeeded (and executable again) rather than
        // being permanently burned. A successful call, by contrast, can
        // never be replayed: `executed` latches true and state() then only
        // ever returns Executed for this proposal.
        proposal.executed = true;

        if (proposal.target != address(0)) {
            (bool success, ) = proposal.target.call{value: proposal.value}(proposal.data);
            require(success, "Proposal execution failed");
        }

        emit ProposalExecuted(
            proposalId,
            proposal.target,
            proposal.value,
            proposal.data
        );
    }

    function setQuorumNumerator(uint256 newNumerator) external onlyOwner {
        require(newNumerator <= 100, "Too high");
        emit QuorumNumeratorUpdated(quorumNumerator, newNumerator);
        quorumNumerator = newNumerator;
    }

    /// @notice Administers the proposal-creation eligibility bar. This does
    /// NOT grant the owner (or anyone) a way around the threshold itself —
    /// createProposal() applies proposalThreshold identically to every
    /// caller, including the owner. This setter only changes what that
    /// shared bar is.
    function setProposalThreshold(uint256 newThreshold) external onlyOwner {
        emit ProposalThresholdUpdated(proposalThreshold, newThreshold);
        proposalThreshold = newThreshold;
    }

    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
}
