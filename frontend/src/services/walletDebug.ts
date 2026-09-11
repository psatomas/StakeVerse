// frontend/src/services/walletDebug.ts

export function logWalletDebug(label: string, data?: unknown) {
  const time = new Date().toISOString();
  console.log(`[WALLET DEBUG ${time}] ${label}`, data ?? "");
}