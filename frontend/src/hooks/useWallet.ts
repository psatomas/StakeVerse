import { useState, useEffect } from "react";
import {
  connectWallet,
  getCurrentAddress,
  validateNetwork,
} from "../services/web3";

export function useWallet() {
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    try {
      setError(null);
      await connectWallet();
      await validateNetwork();

      const currentAddress = await getCurrentAddress();
      setAddress(currentAddress);
      console.log("Wallet connected successfully:", currentAddress);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during connection.");
    }
  }

  // Refresh data cleanly if the user switches accounts or networks manually
  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = () => window.location.reload();
    const handleAccountsChanged = () => window.location.reload();

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return {
    address,
    connect,
    error,
  };
}