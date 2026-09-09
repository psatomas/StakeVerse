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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
        <h2 className="mb-2 text-2xl font-bold text-white">Governance</h2>
        <p className="text-zinc-500">
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Governance
        </h2>

        {!votingPower.meetsProposalThreshold && (
          <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            You currently have {votingPower.votingPower.toString() === "0" ? "no" : "insufficient"}{" "}
            delegated voting power to create a proposal (threshold:{" "}
            {(votingPower.threshold / 10n ** 18n).toString()} SVT). You can
            still vote on and execute existing proposals below.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <input
              type="text"
              placeholder="Create proposal..."
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:border-indigo-500 transition"
            />

            <input
              type="number"
              min="0"
              step="0.5"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:border-indigo-500 transition md:w-32"
              title="Voting duration, in days"
            />
            <span className="self-center text-sm text-zinc-500">days</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            {showAdvanced ? "Hide" : "Show"} on-chain action (target / value / calldata)
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs text-zinc-500">
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
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-mono text-sm text-white outline-none focus:border-indigo-500 transition"
              />

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="ETH value (e.g. 0)"
                  value={valueEth}
                  onChange={(e) => setValueEth(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition"
                />
                <input
                  type="text"
                  placeholder="Calldata (0x...)"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-mono text-sm text-white outline-none focus:border-indigo-500 transition"
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
            className="w-full rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
          >
            {txLoading ? "Processing..." : "Create Proposal"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-zinc-400 animate-pulse">
          Loading proposals from Sepolia...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {!loading && proposals.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
          No proposals found.
        </div>
      )}

      <div className="grid gap-6">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onVoteYes={voteYes}
            onVoteNo={voteNo}
            onExecute={executeProposal}
            txLoading={txLoading}
          />
        ))}
      </div>
    </div>
  );
}
