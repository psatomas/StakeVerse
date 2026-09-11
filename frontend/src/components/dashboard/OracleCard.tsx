type Props = {
  price: string | null;
  loading: boolean;
  error?: string | null;
};

// Styled to sit alongside StatCard as the 4th tile in StatsGrid, carrying
// the same label/value/subtitle shape — but this one is backed by the real
// PriceOracleConsumer.getLatestETHPrice() read (see contracts/oracle.ts and
// hooks/useOracle.ts), never a hardcoded number.
export function OracleCard({ price, loading, error }: Props) {
  const value = loading
    ? "Loading…"
    : error
      ? "—"
      : price !== null
        ? `$${Number(price).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : "—";

  return (
    <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
      <p className="sv-text-label">ETH / USD Oracle</p>

      <h3 className="mt-3 mb-2 text-2xl sv-text-technical">{value}</h3>

      <p className="sv-text-metadata">
        {error ?? "Chainlink Sepolia feed"}
      </p>
    </div>
  );
}
