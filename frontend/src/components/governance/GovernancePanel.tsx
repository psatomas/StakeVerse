import { useState } from "react";
import ProposalCard from "./ProposalCard";
import ProposalCallPreview from "./ProposalCallPreview";
import DelegationPanel from "./DelegationPanel";
import { useGovernance } from "../../hooks/useGovernance";
import { useVotingPower } from "../../hooks/useVotingPower";
import { ZeroAddress } from "ethers";

// Define the type interface for the component props
interface GovernancePanelProps {
  address: string;
}

const TRANSITION =
  "transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)]";

export default function GovernancePanel({ address }: GovernancePanelProps) {
  // Pass the stateful wallet address straight into the custom hook
  const {
    proposals,
    loading,
    txLoading,
    error,
    voteYes,
    voteNo,
    submitProposal,
    executeProposal,
    refresh: refreshProposals,
  } = useGovernance(address);

  const votingPower = useVotingPower(address);

  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("3");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [target, setTarget] = useState("");
  const [valueEth, setValueEth] = useState("0");
  const [data, setData] = useState("0x");

  async function handleSubmit() {
    if (!description.trim()) {
      return;
    }

    const durationInSeconds = Math.round(parseFloat(durationDays) * 86400);

    await submitProposal({
      description,
      durationInSeconds,
      target,
      valueEth,
      data,
    });

    setDescription("");
    setTarget("");
    setValueEth("0");
    setData("0x");
  }

  async function handleActivate() {
    await votingPower.activateVotingPower();
    await refreshProposals();
  }

  async function handleDelegateTo(delegatee: string) {
    await votingPower.delegateVotingPowerTo(delegatee);
    await refreshProposals();
  }

  // GUEST STATE VIEW: If the wallet isn't connected, hide the panel content and prevent errors
  if (!address) {
    return (
      <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-8 text-center">
        <h2 className="sv-text-h2 mb-2">Governance</h2>
        <p className="sv-text-body">
          Please connect your MetaMask wallet to Sepolia to view and participate in protocol proposals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DelegationPanel
        balance={votingPower.balance}
        votingPower={votingPower.votingPower}
        delegate={votingPower.delegate}
        threshold={votingPower.threshold}
        activated={votingPower.activated}
        meetsProposalThreshold={votingPower.meetsProposalThreshold}
        address={address}
        txLoading={votingPower.txLoading}
        error={votingPower.error}
        onActivate={handleActivate}
        onDelegateTo={handleDelegateTo}
      />

      <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
        <h2 className="sv-text-h2 mb-4">Governance</h2>

        {!votingPower.meetsProposalThreshold && (
          <div className="mb-4 rounded-sv-md border border-sv-border-yellow/40 bg-sv-yellow-400/5 p-4 text-sm text-sv-yellow-300">
            You currently have {votingPower.votingPower.toString() === "0" ? "no" : "insufficient"}{" "}
            delegated voting power to create a proposal (threshold:{" "}
            {(votingPower.threshold / 10n ** 18n).toString()} SVT). You can
            still vote on and execute existing proposals below.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              placeholder="Create proposal..."
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className={`flex-1 rounded-sv-md border border-sv-border-strong bg-sv-black-950 px-4 py-3 text-sv-text-primary outline-none focus:border-sv-orange-500 ${TRANSITION}`}
            />

            <input
              type="number"
              min="0"
              step="0.5"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className={`w-full rounded-sv-md border border-sv-border-strong bg-sv-black-950 px-4 py-3 text-sv-text-primary outline-none focus:border-sv-orange-500 md:w-32 ${TRANSITION}`}
              title="Voting duration, in days"
            />
            <span className="self-center sv-text-metadata">days</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`sv-text-label text-sv-orange-400 hover:text-sv-orange-300 ${TRANSITION}`}
          >
            {showAdvanced ? "Hide" : "Show"} on-chain action (target / value / calldata)
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-sv-md border border-sv-border bg-sv-black-950 p-4">
              <p className="sv-text-metadata">
                Leave target blank for a signaling-only proposal (no on-chain
                action). If set, the DAO will call this target with this
                exact value/calldata if the proposal succeeds and is
                executed — nothing here is simplified or hidden from voters.
              </p>

              <input
                type="text"
                placeholder="Target address (0x...), optional"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`w-full rounded-sv-md border border-sv-border-strong bg-sv-black-900 px-4 py-3 sv-text-identifier text-sm outline-none focus:border-sv-orange-500 ${TRANSITION}`}
              />

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="ETH value (e.g. 0)"
                  value={valueEth}
                  onChange={(e) => setValueEth(e.target.value)}
                  className={`flex-1 rounded-sv-md border border-sv-border-strong bg-sv-black-900 px-4 py-3 text-sm text-sv-text-primary outline-none focus:border-sv-orange-500 ${TRANSITION}`}
                />
                <input
                  type="text"
                  placeholder="Calldata (0x...)"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className={`flex-1 rounded-sv-md border border-sv-border-strong bg-sv-black-900 px-4 py-3 sv-text-identifier text-sm outline-none focus:border-sv-orange-500 ${TRANSITION}`}
                />
              </div>

              <ProposalCallPreview
                target={target.trim() || ZeroAddress}
                value={(() => {
                  try {
                    return valueEth.trim()
                      ? BigInt(Math.round(parseFloat(valueEth) * 1e18))
                      : 0n;
                  } catch {
                    return 0n;
                  }
                })()}
                data={data.trim() || "0x"}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={txLoading || !votingPower.meetsProposalThreshold}
            className={`w-full rounded-sv-md border border-sv-orange-500 bg-sv-orange-500 px-6 py-3 font-medium text-sv-black-950 hover:bg-sv-orange-400 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto ${TRANSITION}`}
          >
            {txLoading ? "Processing..." : "Create Proposal"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="sv-text-body animate-pulse">
          Loading proposals from Sepolia...
        </div>
      )}

      {error && (
        <div className="rounded-sv-md border border-sv-error/40 bg-sv-error/10 p-4 text-sv-error">
          {error}
        </div>
      )}

      {!loading && proposals.length === 0 && (
        <div className="rounded-sv-md border border-sv-border bg-sv-black-900 p-6 sv-text-body">
          No proposals found.
        </div>
      )}

      <div className="grid gap-4">
        {proposals.map((proposal, i) => (
          <div
            key={proposal.id}
            className="sv-enter"
            style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
          >
            <ProposalCard
              proposal={proposal}
              onVoteYes={voteYes}
              onVoteNo={voteNo}
              onExecute={executeProposal}
              txLoading={txLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
