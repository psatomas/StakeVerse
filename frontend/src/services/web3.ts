// frontend/src/services/web3.ts
import { BrowserProvider } from "ethers";
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