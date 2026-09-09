import { useState } from "react";

type Props = {
  balance: string;
  votingPower: bigint;
  delegate: string;
  threshold: bigint;
  activated: boolean;
  meetsProposalThreshold: boolean;
  address: string;
  txLoading: boolean;
  error: string;
  onActivate: () => void;
  onDelegateTo: (delegatee: string) => void;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatSVT(value: bigint) {
  // Display-only formatting (18 decimals), matching the rest of the app's
  // "N SVT" presentation for the other token amounts on this page.
  const whole = value / 10n ** 18n;
  return whole.toLocaleString();
}

export default function DelegationPanel({
  balance,
  votingPower,
  delegate,
  threshold,
  activated,
  meetsProposalThreshold,
  address,
  txLoading,
  error,
  onActivate,
  onDelegateTo,
}: Props) {
  const [delegateInput, setDelegateInput] = useState("");

  const holdsTokens = parseFloat(balance || "0") > 0;
  const delegatedToSelf =
    activated && delegate.toLowerCase() === address.toLowerCase();
  const delegatedElsewhere =
    activated && delegate.toLowerCase() !== address.toLowerCase();

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Voting Power
          </h2>
          <p className="mt-1 text-zinc-400">
            ERC20Votes voting power — never your raw token balance.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-zinc-800/60 p-4">
          <p className="text-sm text-zinc-400">Token Balance</p>
          <p className="mt-1 text-xl font-bold text-white">{balance} SVT</p>
        </div>

        <div className="rounded-2xl bg-zinc-800/60 p-4">
          <p className="text-sm text-zinc-400">Delegated Voting Power</p>
          <p className="mt-1 text-xl font-bold text-indigo-400">
            {formatSVT(votingPower)} SVT
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-800/60 p-4">
          <p className="text-sm text-zinc-400">Proposal Threshold</p>
          <p className="mt-1 text-xl font-bold text-white">
            {formatSVT(threshold)} SVT
          </p>
          <p
            className={`mt-1 text-xs ${
              meetsProposalThreshold ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            {meetsProposalThreshold
              ? "You currently meet the threshold"
              : "You do not currently meet the threshold"}
          </p>
        </div>
      </div>

      {!activated && (
        <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          {holdsTokens
            ? "You hold SVT, but voting power is inactive: ERC20Votes never counts a balance as voting power until you delegate it, even to yourself. Activate it to vote or create proposals."
            : "You have not delegated, so your voting power is 0. Delegating an empty balance still leaves your voting power at 0 until you hold tokens too."}
        </div>
      )}

      {delegatedElsewhere && (
        <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-300">
          Your voting power is currently delegated to{" "}
          <span className="font-mono">{short(delegate)}</span>, so your own
          voting power is 0. Activating below re-delegates to yourself.
        </div>
      )}

      {delegatedToSelf && votingPower === 0n && (
        <div className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-400">
          Voting power is active, but currently 0 — you hold no SVT right
          now. It will reflect any tokens you hold from this point forward.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <button
          onClick={onActivate}
          disabled={txLoading || delegatedToSelf}
          className="rounded-2xl bg-indigo-600 px-6 py-4 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {txLoading
            ? "Processing..."
            : delegatedToSelf
              ? "Voting Power Active"
              : "Activate Voting Power"}
        </button>

        <div className="flex flex-1 gap-3">
          <input
            type="text"
            placeholder="Delegate to another address (optional)"
            value={delegateInput}
            onChange={(e) => setDelegateInput(e.target.value)}
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500"
          />
          <button
            onClick={() => onDelegateTo(delegateInput.trim())}
            disabled={txLoading || !delegateInput.trim()}
            className="rounded-2xl bg-zinc-800 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delegate
          </button>
        </div>
      </div>
    </div>
  );
}
