// frontend/src/contracts/nft.ts
//
// StakeVerseNFT has no signer-based wrapper anywhere in this app — nothing
// today lets a user mint or transfer it, and the only thing the Protocol
// page needs is its owner() (for the live cross-contract ownership check).
// Read-only only, matching that actual scope — not a placeholder for
// functionality that doesn't exist elsewhere in the codebase.
import { Contract } from "ethers";

import nftAbi from "./abis/StakeVerseNFT.json";

import { CONTRACTS } from "./index";
import { getReadOnlyProvider } from "../services/web3";

export function getReadOnlyNftContract() {
  return new Contract(CONTRACTS.nft, nftAbi.abi, getReadOnlyProvider());
}

export async function getNftOwner(): Promise<string | null> {
  try {
    const contract = getReadOnlyNftContract();
    return await contract.owner();
  } catch (error) {
    console.error("Error inside getNftOwner service block:", error);
    return null;
  }
}
