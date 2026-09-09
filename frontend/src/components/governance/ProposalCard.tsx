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

const STATE_STYLES: Record<number, string> = {
  0: "bg-yellow-500/20 text-yellow-400", // Active
  1: "bg-red-500/20 text-red-400", // Failed
  2: "bg-emerald-500/20 text-emerald-400", // Succeeded
  3: "bg-indigo-500/20 text-indigo-400", // Executed
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          Proposal #{proposal.id}
        </h3>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATE_STYLES[proposal.state] ?? "bg-zinc-700 text-zinc-300"
          }`}
        >
          {proposal.stateLabel}
        </span>
      </div>

      <p className="mb-4 text-zinc-300">{proposal.description}</p>

      <div className="mb-4 text-xs text-zinc-500">
        Proposer:{" "}
        {proposerLoading
          ? "Loading..."
          : proposer
            ? short(proposer)
            : "Not available on-chain"}
      </div>

      <div className="mb-6">
        <ProposalCallPreview
          target={proposal.target}
          value={proposal.value}
          data={proposal.data}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-zinc-800 p-4">
          <p className="text-sm text-zinc-400">Yes Votes</p>
          <p className="text-2xl font-bold text-green-400">
            {formatSVT(proposal.yesVotes)}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-800 p-4">
          <p className="text-sm text-zinc-400">No Votes</p>
          <p className="text-2xl font-bold text-red-400">
            {formatSVT(proposal.noVotes)}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-800 p-4">
          <p className="text-sm text-zinc-400">Quorum</p>
          <p
            className={`text-lg font-bold ${
              proposal.quorumReached ? "text-emerald-400" : "text-zinc-300"
            }`}
          >
            {formatSVT(participation)}
            {quorumThreshold !== null ? ` / ${formatSVT(quorumThreshold)}` : ""}
          </p>
          <p className="text-xs text-zinc-500">
            {proposal.quorumReached ? "Reached" : "Not reached"}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-800 p-4">
          <p className="text-sm text-zinc-400">Your Voting Power</p>
          <p className="text-lg font-bold text-indigo-400">
            {formatSVT(proposal.voterPower)}
          </p>
          <p className="text-xs text-zinc-500">at this proposal's snapshot</p>
        </div>
      </div>

      <div className="mb-4 text-sm text-zinc-500">
        Deadline:{" "}
        {new Date(proposal.deadline * 1000).toLocaleString()}
      </div>

      {voteDisabledReason && !proposal.executed && (
        <p className="mb-3 text-sm text-zinc-500">{voteDisabledReason}</p>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => onVoteYes(proposal.id)}
          disabled={txLoading || !canVote}
          className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Vote Yes
        </button>

        <button
          onClick={() => onVoteNo(proposal.id)}
          disabled={txLoading || !canVote}
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Execute
          </button>
        )}
      </div>
    </div>
  );
}
