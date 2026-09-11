import SectionShell from "../landing/SectionShell";
import type { Proposal } from "../../contracts/dao";

type Props = {
  proposals: Proposal[];
  proposalCount: number | null;
  loading: boolean;
};

// Same state→color mapping as the App's ProposalCard, so a proposal reads
// identically whether you're inspecting it here or interacting with it
// there — Active is the one genuine "signal" state (yellow), matching the
// same semantics used throughout the rest of the product.
const STATE_STYLES: Record<number, string> = {
  0: "border border-sv-border-yellow/50 bg-sv-yellow-400/10 text-sv-yellow-300",
  1: "border border-sv-error/40 bg-sv-error/10 text-sv-error",
  2: "border border-sv-success/40 bg-sv-success/10 text-sv-success",
  3: "border border-sv-border-orange/40 bg-sv-orange-500/10 text-sv-orange-400",
};

function formatSVT(value: bigint) {
  return (value / 10n ** 18n).toLocaleString();
}

// Inspection only — no vote/execute actions here. Protocol explains what
// exists; the App is where a connected wallet actually acts on it.
export default function ProtocolProposals({ proposals, proposalCount, loading }: Props) {
  return (
    <SectionShell
      id="protocol-proposals"
      index="04"
      kicker="Proposals"
      title="Every proposal the DAO has ever seen"
      description="Read directly from proposalCount() and getProposal() on the live DAO — the same read path the App itself uses, without requiring a wallet."
    >
      {loading && <p className="sv-text-body animate-pulse">Loading proposals from Sepolia…</p>}

      {!loading && proposalCount === 0 && (
        <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
          <p className="sv-text-body">No proposals found.</p>
        </div>
      )}

      {!loading && proposalCount !== null && proposalCount > 0 && (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="sv-text-h3">Proposal #{proposal.id}</h3>
                <span
                  className={`rounded-sv-sm px-3 py-1 text-xs font-medium ${
                    STATE_STYLES[proposal.state] ?? "border border-sv-border-strong text-sv-text-secondary"
                  }`}
                >
                  {proposal.stateLabel}
                </span>
              </div>

              <p className="sv-text-body mb-4">{proposal.description}</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-sv-md border border-sv-border p-3">
                  <p className="sv-text-label">Yes</p>
                  <p className="sv-text-technical mt-1 text-sv-success">{formatSVT(proposal.yesVotes)}</p>
                </div>
                <div className="rounded-sv-md border border-sv-border p-3">
                  <p className="sv-text-label">No</p>
                  <p className="sv-text-technical mt-1 text-sv-error">{formatSVT(proposal.noVotes)}</p>
                </div>
                <div className="rounded-sv-md border border-sv-border p-3">
                  <p className="sv-text-label">Quorum</p>
                  <p className="sv-text-technical mt-1">{proposal.quorumReached ? "Reached" : "Not reached"}</p>
                </div>
                <div className="rounded-sv-md border border-sv-border p-3">
                  <p className="sv-text-label">Deadline</p>
                  <p className="sv-text-technical mt-1 text-xs">
                    {new Date(proposal.deadline * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && proposalCount === null && (
        <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
          <p className="sv-text-body">Proposal count unavailable — the read didn't resolve.</p>
        </div>
      )}
    </SectionShell>
  );
}
