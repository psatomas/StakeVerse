// Minimal ambient typing for the injected EIP-1193 wallet provider
// (window.ethereum). Pre-existing gap in the frontend — untyped `any` was
// already the de facto shape used throughout services/web3.ts and
// hooks/useWallet.ts; this just declares it so `tsc -b` can run at all.
// Not part of governance functionality; added only because it otherwise
// blocks typechecking the entire frontend, including the new files below.
export {};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      [key: string]: unknown;
    };
  }
}
