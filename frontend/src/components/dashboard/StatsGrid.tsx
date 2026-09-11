import StatCard from "./StatCard";
import { OracleCard } from "./OracleCard";

type Props = {
  balance: string;
  staked: string;
  rewards: string;
  oraclePrice: string | null;
  oracleLoading: boolean;
  oracleError: string | null;
};

const STAGGER_MS = 60;

export default function StatsGrid({
  balance,
  staked,
  rewards,
  oraclePrice,
  oracleLoading,
  oracleError,
}: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="sv-enter" style={{ animationDelay: `${0 * STAGGER_MS}ms` }}>
        <StatCard
          title="Wallet Balance"
          value={`${balance} SVT`}
          subtitle="StakeVerse Token"
        />
      </div>

      <div className="sv-enter" style={{ animationDelay: `${1 * STAGGER_MS}ms` }}>
        <StatCard
          title="Staked Amount"
          value={`${staked} SVT`}
          subtitle="Currently locked"
        />
      </div>

      <div className="sv-enter" style={{ animationDelay: `${2 * STAGGER_MS}ms` }}>
        <StatCard
          title="Pending Rewards"
          value={`${rewards} SVT`}
          subtitle="Available to claim"
        />
      </div>

      <div className="sv-enter" style={{ animationDelay: `${3 * STAGGER_MS}ms` }}>
        <OracleCard
          price={oraclePrice}
          loading={oracleLoading}
          error={oracleError}
        />
      </div>
    </section>
  );
}
