import { useCallback, useEffect, useState } from "react";

import {
  getCurrentVotingPower,
  getDelegate,
  getTokenBalance,
  delegateToSelf,
  delegateTo,
  hasActivatedVotingPower,
} from "../contracts/token";

import { getProposalThreshold } from "../contracts/dao";

import { formatTxError } from "../utils/txError";

export function useVotingPower(address: string) {
  const [balance, setBalance] = useState("0");
  const [votingPower, setVotingPower] = useState(0n);
  const [delegate, setDelegate] = useState("");
  const [threshold, setThreshold] = useState(0n);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      setError("");

      const [tokenBalance, currentVotes, currentDelegate, proposalThreshold] =
        await Promise.all([
          getTokenBalance(address),
          getCurrentVotingPower(address),
          getDelegate(address),
          getProposalThreshold(),
        ]);

      setBalance(tokenBalance);
      setVotingPower(currentVotes);
      setDelegate(currentDelegate);
      setThreshold(proposalThreshold);
    } catch (err) {
      console.error(err);
      setError("Failed to load voting power.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Same pre-existing load-on-mount pattern as useDashboard.ts/useGovernance.ts
  // — see the note there on the codebase-wide react-hooks/set-state-in-effect
  // gap this mirrors.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const activated = hasActivatedVotingPower(delegate);
  const hasZeroVotingPower = activated && votingPower === 0n;
  const meetsProposalThreshold = votingPower >= threshold && threshold >= 0n;

  async function activateVotingPower() {
    if (!address) return;
    try {
      setTxLoading(true);
      setError("");
      await delegateToSelf(address);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(formatTxError(err));
    } finally {
      setTxLoading(false);
    }
  }

  async function delegateVotingPowerTo(delegatee: string) {
    try {
      setTxLoading(true);
      setError("");
      await delegateTo(delegatee);
      await refresh();
    } catch (err) {
      console.error(err);
      setError(formatTxError(err));
    } finally {
      setTxLoading(false);
    }
  }

  return {
    balance,
    votingPower,
    delegate,
    threshold,
    activated,
    hasZeroVotingPower,
    meetsProposalThreshold,
    loading,
    txLoading,
    error,
    refresh,
    activateVotingPower,
    delegateVotingPowerTo,
  };
}
