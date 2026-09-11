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

const TRANSITION =
  "transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)]";

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
    <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-8">
      <div className="mb-6">
        <h2 className="sv-text-h2">Voting Power</h2>
        <p className="sv-text-body mt-1">
          ERC20Votes voting power — never your raw token balance.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">Token Balance</p>
          <p className="mt-2 sv-text-technical text-lg">{balance} SVT</p>
        </div>

        <div className="rounded-sv-md border border-sv-border-orange/40 bg-sv-orange-500/5 p-4">
          <p className="sv-text-label">Delegated Voting Power</p>
          <p className="mt-2 sv-text-technical text-lg text-sv-orange-400">
            {formatSVT(votingPower)} SVT
          </p>
        </div>

        <div className="rounded-sv-md border border-sv-border p-4">
          <p className="sv-text-label">Proposal Threshold</p>
          <p className="mt-2 sv-text-technical text-lg">
            {formatSVT(threshold)} SVT
          </p>
          <p
            className={`mt-1 text-xs ${
              meetsProposalThreshold ? "text-sv-success" : "text-sv-text-muted"
            }`}
          >
            {meetsProposalThreshold
              ? "You currently meet the threshold"
              : "You do not currently meet the threshold"}
          </p>
        </div>
      </div>

      {!activated && (
        <div className="mb-6 rounded-sv-md border border-sv-border-yellow/40 bg-sv-yellow-400/5 p-4 text-sm text-sv-yellow-300">
          {holdsTokens
            ? "You hold SVT, but voting power is inactive: ERC20Votes never counts a balance as voting power until you delegate it, even to yourself. Activate it to vote or create proposals."
            : "You have not delegated, so your voting power is 0. Delegating an empty balance still leaves your voting power at 0 until you hold tokens too."}
        </div>
      )}

      {delegatedElsewhere && (
        <div className="mb-6 rounded-sv-md border border-sv-border-orange/30 bg-sv-orange-500/5 p-4 text-sm text-sv-orange-300">
          Your voting power is currently delegated to{" "}
          <span className="sv-text-identifier">{short(delegate)}</span>, so your own
          voting power is 0. Activating below re-delegates to yourself.
        </div>
      )}

      {delegatedToSelf && votingPower === 0n && (
        <div className="mb-6 rounded-sv-md border border-sv-border p-4 text-sm text-sv-text-secondary">
          Voting power is active, but currently 0 — you hold no SVT right
          now. It will reflect any tokens you hold from this point forward.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-sv-md border border-sv-error/40 bg-sv-error/10 p-4 text-sv-error">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <button
          onClick={onActivate}
          disabled={txLoading || delegatedToSelf}
          className={`rounded-sv-md border border-sv-orange-500 bg-sv-orange-500 px-6 py-3.5 font-medium text-sv-black-950 hover:bg-sv-orange-400 disabled:cursor-not-allowed disabled:opacity-50 ${TRANSITION}`}
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
            className={`flex-1 rounded-sv-md border border-sv-border-strong bg-sv-black-950 px-4 py-3 sv-text-identifier text-sm outline-none focus:border-sv-orange-500 ${TRANSITION}`}
          />
          <button
            onClick={() => onDelegateTo(delegateInput.trim())}
            disabled={txLoading || !delegateInput.trim()}
            className={`rounded-sv-md border border-sv-border-strong bg-sv-black-850 px-6 py-3 font-medium text-sv-text-primary hover:bg-sv-black-800 disabled:cursor-not-allowed disabled:opacity-50 ${TRANSITION}`}
          >
            Delegate
          </button>
        </div>
      </div>
    </div>
  );
}
