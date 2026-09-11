// frontend/src/services/web3.ts
import { BrowserProvider, JsonRpcProvider } from "ethers";
import { logWalletDebug } from "./walletDebug"; // Import your standalone debugger

let provider: BrowserProvider | null = null;
// Active tracking flag to isolate simultaneous execution threads
let isHandshakeActive = false;

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }

  // CIRCUIT BREAKER: Block and ignore secondary race conditions
  if (isHandshakeActive) {
    logWalletDebug("CONNECT_ABORT", "A wallet handshake process is already running.");
    return provider;
  }

  try {
    isHandshakeActive = true;
    provider = new BrowserProvider(window.ethereum);

    const accounts = await provider.send("eth_requestAccounts", []);
    logWalletDebug("ACCOUNTS", accounts);

    const network = await provider.getNetwork();
    logWalletDebug("NETWORK", {
      chainId: network.chainId,
      name: network.name,
    });

    return provider;
  } finally {
    // Safely unlock the gate once MetaMask handles or rejects the prompt
    isHandshakeActive = false;
  }
}

export function getProvider() {
  if (!provider) {
    throw new Error("Wallet not connected");
  }
  return provider;
}

export async function validateNetwork() {
  const currentProvider = getProvider();
  const network = await currentProvider.getNetwork();

  logWalletDebug("VALIDATE_NETWORK", {
    chainId: network.chainId,
    expected: 11155111n,
  });

  if (network.chainId !== 11155111n) {
    if (!window.ethereum) {
      throw new Error("Please connect to Sepolia");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], 
      });
    } catch (switchError) {
      const switchErrorCode =
        switchError && typeof switchError === "object" && "code" in switchError
          ? (switchError as Record<string, unknown>).code
          : undefined;

      if (switchErrorCode === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Test Network",
                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addError) {
          throw new Error(
            "Failed to add Sepolia network to MetaMask configuration.",
            { cause: addError }
          );
        }
      } else {
        throw new Error(
          "Please switch your network to Sepolia in MetaMask.",
          { cause: switchError }
        );
      }
    }
  }
}

export async function getSigner() {
  const currentProvider = getProvider();
  return await currentProvider.getSigner();
}

export async function getCurrentAddress() {
  const signer = await getSigner();
  return await signer.getAddress();
}

// --- Read-only provider (no wallet required) -------------------------------
//
// Everything above this line exists to talk to an injected wallet
// (window.ethereum) and requires a user to connect one — that's the App's
// interaction surface. The Protocol page's premise is different: a visitor
// should be able to inspect live chain state without connecting anything.
// This is the app's first read-only path; it does not touch, wrap, or
// replace `provider`/`getSigner()` above, which remain exactly as they were
// for every existing signer-gated call site.
//
// A public RPC endpoint (same one validated during the dashboard audit),
// hardcoded rather than made configurable — this repo has no existing
// pattern for a frontend-side RPC-URL env var, and one endpoint is all the
// Protocol page needs.
const READ_ONLY_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

let readOnlyProvider: JsonRpcProvider | null = null;

export function getReadOnlyProvider(): JsonRpcProvider {
  if (!readOnlyProvider) {
    readOnlyProvider = new JsonRpcProvider(READ_ONLY_RPC_URL);
  }
  return readOnlyProvider;
}

/// Confirms whether bytecode actually exists at `address` on the live
/// chain — i.e. that a contract is genuinely deployed there, not merely
/// that the address string is well-formed. Returns null (never a
/// fabricated true/false) if the read itself fails, so a network hiccup
/// can never be displayed as "not deployed".
export async function hasDeployedCode(address: string): Promise<boolean | null> {
  try {
    const code = await getReadOnlyProvider().getCode(address);
    return code !== "0x";
  } catch (error) {
    console.error("Error inside hasDeployedCode service block:", error);
    return null;
  }
}