import { useEffect, useState, useCallback } from "react";
import { getTokenBalance } from "../contracts/token";
import { getPendingRewards, getStakedBalance, getRewardRate } from "../contracts/staking";

// Accept the active wallet address as a parameter
export function useDashboard(address: string) {
  const [balance, setBalance] = useState("0");
  const [staked, setStaked] = useState("0");
  const [rewards, setRewards] = useState("0");
  // null (not "0") until a real read succeeds, so the UI can tell "not
  // loaded yet" apart from a genuine on-chain 0% reward rate.
  const [rewardRate, setRewardRate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    // GATEKEEPER: Prevent any execution if the wallet infrastructure isn't ready
    if (!address) return;

    try {
      setLoading(true);

      const tokenBalance = await getTokenBalance(address);
      const stakedBalance = await getStakedBalance(address);
      const pendingRewards = await getPendingRewards(address);
      const currentRewardRate = await getRewardRate();

      setBalance(tokenBalance);
      setStaked(stakedBalance);
      setRewards(pendingRewards);
      setRewardRate(currentRewardRate);
    } catch (error) {
      console.error("Failed to load dashboard balances:", error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Automatically fires layout loading when address changes from "" to valid.
  // Same pre-existing load-on-mount pattern as useGovernance.ts/useVotingPower.ts/
  // useOracle.ts — see the note there on the codebase-wide
  // react-hooks/set-state-in-effect gap this mirrors.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return {
    balance,
    staked,
    rewards,
    rewardRate,
    loading,
    reload: load,
  };
}