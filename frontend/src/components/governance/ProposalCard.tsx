import { useEffect, useState } from "react";

import type { ProposalWithVoterInfo } from "../../hooks/useGovernance";
import { getProposalCreator, getQuorumNumerator } from "../../contracts/dao";
import { getPastTotalVotingSupply } from "../../contracts/token";
import ProposalCallPreview from "./ProposalCallPreview";

interface ProposalCardProps {
  proposal: ProposalWithVoterInfo;
  onVoteYes: (id: number) => void;
  onVoteNo: (id: number) => void;
  onExecute: (id: number) => void;
  txLoading: boolean;
}

const TRANSITION =
  "transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)]";

// Active = a signal: it needs the viewer's attention, and is the one place
// yellow earns its scarcity. Succeeded/Executed are semantic + protocol
// states; Failed is the error semantic.
const STATE_STYLES: Record<number, string> = {
  0: "border border-sv-border-yellow/50 bg-sv-yellow-400/10 text-sv-yellow-300", // Active
  1: "border border-sv-error/40 bg-sv-error/10 text-sv-error", // Failed
  2: "border border-sv-success/40 bg-sv-success/10 text-sv-success", // Succeeded
  3: "border border-sv-border-orange/40 bg-sv-orange-500/10 text-sv-orange-400", // Executed
};

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatSVT(value: bigint) {
  return (value / 10n ** 18n).toLocaleString();
}

export default function ProposalCard({
  proposal,
  onVoteYes,
  onVoteNo,
  onExecute,
  txLoading,
}: ProposalCardProps) {
  const [proposer, setProposer] = useState<string | null>(null);
  const [proposerLoading, setProposerLoading] = useState(true);

  const [quorumThreshold, setQuorumThreshold] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Best-effort: the DAO does not store a proposer on-chain, so this is
    // derived from the ProposalCreated event log and may be slow or
    // unavailable depending on the RPC provider — it never blocks the rest
    // of the card.
    getProposalCreator(proposal.id).then((result) => {
      if (!cancelled) {
        setProposer(result);
        setProposerLoading(false);
      }
    });

    // Numeric quorum requirement for display. This mirrors the DAO's own
    // formula (totalVotingSupply-at-snapshot * quorumNumerator / 100)
    // purely for the label shown below — the actual pass/fail decision
    // always comes from proposal.quorumReached (dao.quorumReached()), never
    // from this number.
    Promise.all([
      getPastTotalVotingSupply(proposal.snapshotTimestamp),
      getQuorumNumerator(),
    ])
      .then(([totalSupply, numerator]) => {
        if (!cancelled) {
          setQuorumThreshold((totalSupply * numerator) / 100n);
        }
      })
      .catch(() => {
        if (!cancelled) setQuorumThreshold(null);
      });

    return () => {
      cancelled = true;
    };
  }, [proposal.id, proposal.snapshotTimestamp]);

  const isVotingOpen = proposal.state === 0; // Active
  const isSucceeded = proposal.state === 2; // Succeeded
  const participation = proposal.yesVotes + proposal.noVotes;

  const canVote =
    isVotingOpen && !proposal.hasVotedByUser && proposal.voterPower > 0n;

  let voteDisabledReason: string | null = null;
  if (!isVotingOpen) {
    voteDisabledReason = `Voting is not open (state: ${proposal.stateLabel}).`;
  } else if (proposal.hasVotedByUser) {
    voteDisabledReason = "You already voted on this proposal.";
  } else if (proposal.voterPower === 0n) {
    voteDisabledReason =
      "You have zero historical voting power for this proposal (delegate before a proposal is created to gain power for it).";
  }

  return (
    <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="sv-text-h3">Proposal #{proposal.id}</h3>

        <span
          className={`rounded-sv-sm px-3 py-1 text-xs font-medium ${
            STATE_STYLES[proposal.state] ??
            "border border-sv-border-strong text-sv-text-secondary"
          }`}
        >
          {proposal.stateLabel}
        </span>
      </div>

      <p className="sv-text-body mb-4">{proposal.description}</p>

      <div className="sv-text-metadata mb-4">
        Proposer:{" "}
        {proposerLoading ? (
          "Loading..."
        ) : proposer ? (
          <span className="sv-text-identifier">{short(proposer)}</span>
        ) : (
          "Not available on-chain"
        )}
      </div>

      <div className="mb-6">
        <ProposalCallPreview
          target={proposal.target}
          value={proposal.value}
          data={proposal.data}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">Yes Votes</p>
          <p className="mt-1 sv-text-technical text-lg text-sv-success">
            {formatSVT(proposal.yesVotes)}
          </p>
        </div>

        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">No Votes</p>
          <p className="mt-1 sv-text-technical text-lg text-sv-error">
            {formatSVT(proposal.noVotes)}
          </p>
        </div>

        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">Quorum</p>
          <p
            className={`mt-1 sv-text-technical text-base ${
              proposal.quorumReached ? "text-sv-success" : "text-sv-text-secondary"
            }`}
          >
            {formatSVT(participation)}
            {quorumThreshold !== null ? ` / ${formatSVT(quorumThreshold)}` : ""}
          </p>
          <p className="sv-text-metadata mt-1">
            {proposal.quorumReached ? "Reached" : "Not reached"}
          </p>
        </div>

        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">Your Voting Power</p>
          <p className="mt-1 sv-text-technical text-base text-sv-orange-400">
            {formatSVT(proposal.voterPower)}
          </p>
          <p className="sv-text-metadata mt-1">at this proposal's snapshot</p>
        </div>
      </div>

      <div className="sv-text-metadata mb-4">
        Deadline:{" "}
        {new Date(proposal.deadline * 1000).toLocaleString()}
      </div>

      {voteDisabledReason && !proposal.executed && (
        <p className="sv-text-metadata mb-3">{voteDisabledReason}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onVoteYes(proposal.id)}
          disabled={txLoading || !canVote}
          className={`flex-1 rounded-sv-md border border-sv-success/40 bg-sv-success/10 px-4 py-3 font-medium text-sv-success hover:bg-sv-success/20 disabled:cursor-not-allowed disabled:opacity-50 ${TRANSITION}`}
        >
          Vote Yes
        </button>

        <button
          onClick={() => onVoteNo(proposal.id)}
          disabled={txLoading || !canVote}
          className={`flex-1 rounded-sv-md border border-sv-error/40 bg-sv-error/10 px-4 py-3 font-medium text-sv-error hover:bg-sv-error/20 disabled:cursor-not-allowed disabled:opacity-50 ${TRANSITION}`}
        >
          Vote No
        </button>

        {/* Execution is permissionless: any connected wallet may trigger
            it, never just the proposer/owner. It is only ever ENABLED once
            state() says Succeeded — that check is read straight from
            proposal.state, not re-derived here. */}
        {isSucceeded && (
          <button
            onClick={() => onExecute(proposal.id)}
            disabled={txLoading}
            className={`flex-1 rounded-sv-md border border-sv-orange-500 bg-sv-orange-500 px-4 py-3 font-medium text-sv-black-950 hover:bg-sv-orange-400 disabled:cursor-not-allowed disabled:opacity-50 ${TRANSITION}`}
          >
            Execute
          </button>
        )}
      </div>
    </div>
  );
}
