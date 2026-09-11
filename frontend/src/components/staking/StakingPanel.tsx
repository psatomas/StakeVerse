type Props = {
  amount: string;

  setAmount: (
    value: string
  ) => void;

  loading: boolean;

  onApprove: () => void;

  onStake: () => void;

  onClaim: () => void;
};

const TRANSITION =
  "transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)]";

export default function StakingPanel({
  amount,
  setAmount,
  loading,
  onApprove,
  onStake,
  onClaim,
}: Props) {
  return (
    <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="sv-text-h2">Staking Dashboard</h2>
          <p className="sv-text-body mt-1">
            Stake SVT and earn protocol rewards.
          </p>
        </div>

        <div className="rounded-sv-sm border border-sv-border-strong px-3 py-1.5 sv-text-technical text-sm">
          APY 12.4%
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="sv-text-label mb-2 block">Stake Amount</label>

          <input
            type="text"
            placeholder="0.0"
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
            className={`w-full rounded-sv-md border border-sv-border-strong bg-sv-black-950 px-5 py-4 text-lg sv-text-technical outline-none focus:border-sv-orange-500 ${TRANSITION}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            onClick={onApprove}
            disabled={loading}
            className={`rounded-sv-md border border-sv-border-strong bg-sv-black-850 py-3.5 font-medium text-sv-text-primary hover:border-sv-border-strong hover:bg-sv-black-800 disabled:opacity-50 ${TRANSITION}`}
          >
            {loading
              ? "Loading..."
              : "Approve"}
          </button>

          <button
            onClick={onStake}
            disabled={loading}
            className={`rounded-sv-md border border-sv-orange-500 bg-sv-orange-500 py-3.5 font-medium text-sv-black-950 hover:bg-sv-orange-400 disabled:opacity-50 ${TRANSITION}`}
          >
            {loading
              ? "Loading..."
              : "Stake Tokens"}
          </button>

          <button
            onClick={onClaim}
            disabled={loading}
            className={`rounded-sv-md border border-sv-yellow-400/40 bg-transparent py-3.5 font-medium text-sv-yellow-400 hover:bg-sv-yellow-400/10 disabled:opacity-50 ${TRANSITION}`}
          >
            {loading
              ? "Loading..."
              : "Claim Rewards"}
          </button>
        </div>
      </div>
    </div>
  );
}
