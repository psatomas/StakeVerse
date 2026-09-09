// frontend/src/utils/txError.ts
//
// Turns a raw ethers/wallet error into a short, user-facing message instead
// of a generic "transaction failed". Handles the states callers actually
// need to distinguish: rejected in the wallet vs. reverted on-chain (with
// the contract's own require() reason surfaced where the provider gives us
// one) vs. anything else.

export function formatTxError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Transaction failed.";
  }

  const e = err as Record<string, unknown>;

  // User closed/rejected the wallet prompt (ethers v6 code, and the raw
  // EIP-1193 4001 code some wallets surface directly).
  if (e.code === "ACTION_REJECTED" || e.code === 4001) {
    return "Transaction rejected in wallet.";
  }

  // A revert reason, when the RPC provider/wallet exposes one. ethers v6
  // surfaces this in a few different shapes depending on where the error
  // originated (signer estimateGas vs. provider call vs. wallet relay).
  const reason =
    (e.reason as string | undefined) ||
    (e.shortMessage as string | undefined) ||
    ((e.info as Record<string, unknown> | undefined)?.error as
      | Record<string, unknown>
      | undefined
    )?.message as string | undefined ||
    (e.data as Record<string, unknown> | undefined)?.message as
      | string
      | undefined;

  if (reason) {
    return String(reason).replace(/^execution reverted:\s*/i, "");
  }

  if (e.code === "CALL_EXCEPTION") {
    return "This transaction would revert on-chain.";
  }

  if (e.code === "INSUFFICIENT_FUNDS") {
    return "Insufficient ETH balance for this transaction.";
  }

  if (typeof e.message === "string" && e.message) {
    return e.message;
  }

  return "Transaction failed.";
}
