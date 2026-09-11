import { useCallback, useEffect, useState } from "react";

import { getLatestEthPrice } from "../contracts/oracle";

// Mirrors the load-on-mount / reload-on-address-change shape shared by
// useDashboard.ts, useGovernance.ts and useVotingPower.ts — gated on the
// connected address for the same reason: every contract read in this app
// goes through getSigner(), which requires a connected wallet.
export function useOracle(address: string) {
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      setError(null);

      const latest = await getLatestEthPrice();
      setPrice(latest);
    } catch (err) {
      console.error("Failed to load oracle price:", err);
      setError("Unavailable");
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Same pre-existing load-on-mount pattern as useDashboard.ts/useGovernance.ts
  // — see the note there on the codebase-wide react-hooks/set-state-in-effect
  // gap this mirrors.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return {
    price,
    loading,
    error,
    reload: load,
  };
}
