import { useState } from "react";
import Navbar from "../components/layout/Navbar";
import StatsGrid from "../components/dashboard/StatsGrid";
import StakingPanel from "../components/staking/StakingPanel";
import GovernancePanel from "../components/governance/GovernancePanel";

import { useWallet } from "../hooks/useWallet";
import { useDashboard } from "../hooks/useDashboard";
import { useOracle } from "../hooks/useOracle";
import { approveTokens } from "../contracts/token";
import { stakeTokens, claimRewards } from "../contracts/staking";

export default function Dashboard() {
  // 1. Fetch the user's wallet connection state
  const { address, connect } = useWallet();

  // 2. FIXED: Feed the stateful address string directly into your dashboard hook argument
  const {
    balance,
    staked,
    rewards,
    rewardRate,
    // Aliased: the local `loading` state below tracks an in-flight
    // approve/stake/claim transaction, a different thing from whether the
    // stats (including rewardRate) have finished their initial read.
    loading: statsLoading,
    reload,
  } = useDashboard(address);

  const {
    price: oraclePrice,
    loading: oracleLoading,
    error: oracleError,
  } = useOracle(address);

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    try {
      setLoading(true);
      await approveTokens(amount);
      await reload();
      alert("Tokens approved");
    } catch (error) {
      console.error(error);
      alert("Approval failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStake() {
    try {
      setLoading(true);
      await stakeTokens(amount);
      await reload();
      alert("Tokens staked");
    } catch (error) {
      console.error(error);
      alert("Stake failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    try {
      setLoading(true);
      await claimRewards();
      await reload();
      alert("Rewards claimed");
    } catch (error) {
      console.error(error);
      alert("Claim failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sv-surface text-sv-text-primary">
      <Navbar
        address={address}
        connect={connect}
      />

      <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <StatsGrid
          balance={balance}
          staked={staked}
          rewards={rewards}
          oraclePrice={oraclePrice}
          oracleLoading={oracleLoading}
          oracleError={oracleError}
        />

        <section>
          <StakingPanel
            amount={amount}
            setAmount={setAmount}
            loading={loading}
            apr={rewardRate}
            aprLoading={statsLoading}
            onApprove={handleApprove}
            onStake={handleStake}
            onClaim={handleClaim}
          />
        </section>

        <section>
          {/* CRITICAL DESIGN ALIGNMENT: 
            Pass the address property downward to the GovernancePanel component too, 
            so its internal useGovernance(address) call doesn't run early or cause errors!
          */}
          <GovernancePanel address={address} />
        </section>
      </main>
    </div>
  );
}