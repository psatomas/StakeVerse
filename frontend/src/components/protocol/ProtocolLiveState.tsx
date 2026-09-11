import SectionShell from "../landing/SectionShell";

type Props = {
  totalSupply: string | null;
  totalStaked: string | null;
  rewardReserve: string | null;
  rewardRate: string | null;
  paused: boolean | null;
  proposalThreshold: string | null;
  quorumNumerator: string | null;
  oraclePrice: string | null;
  loading: boolean;
};

function Row({
  label,
  loading,
  value,
}: {
  label: string;
  loading: boolean;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="sv-text-label">{label}</dt>
      <dd className="sv-text-technical text-right text-sm sm:text-base">
        {loading ? "Loading…" : value ?? "—"}
      </dd>
    </div>
  );
}

// One consolidated ledger, not separate "staking stats" / "governance
// stats" sections repeating the same totalStaked/rewardReserve numbers
// twice under different headings — every value here is a single live
// read, shown once.
export default function ProtocolLiveState({
  totalSupply,
  totalStaked,
  rewardReserve,
  rewardRate,
  paused,
  proposalThreshold,
  quorumNumerator,
  oraclePrice,
  loading,
}: Props) {
  const oracleDisplay =
    oraclePrice !== null
      ? `$${Number(oraclePrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null;

  const pausedDisplay = paused === null ? null : paused ? "Paused" : "Active";

  return (
    <SectionShell
      id="protocol-state"
      index="03"
      kicker="Live Protocol State"
      title="What the contracts report right now"
      description="Every value below is a fresh read-only call against the deployed contracts, not a cached or estimated figure. A dash means the read hasn't resolved — never a fabricated zero."
    >
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        <Row label="Total Supply" loading={loading} value={totalSupply !== null ? `${totalSupply} SVT` : null} />
        <Row label="Total Staked" loading={loading} value={totalStaked !== null ? `${totalStaked} SVT` : null} />
        <Row label="Reward Reserve" loading={loading} value={rewardReserve !== null ? `${rewardReserve} SVT` : null} />
        <Row label="Reward Rate" loading={loading} value={rewardRate !== null ? `${rewardRate}% APR` : null} />
        <Row label="Staking Paused" loading={loading} value={pausedDisplay} />
        <Row
          label="Proposal Threshold"
          loading={loading}
          value={proposalThreshold !== null ? `${proposalThreshold} SVT` : null}
        />
        <Row label="Quorum" loading={loading} value={quorumNumerator !== null ? `${quorumNumerator}%` : null} />
        <Row label="ETH / USD Oracle" loading={loading} value={oracleDisplay} />
      </dl>
    </SectionShell>
  );
}
