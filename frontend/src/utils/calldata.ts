// frontend/src/utils/calldata.ts
//
// Best-effort decoding of a proposal's (target, value, data) into a
// human-readable function call, for the known StakeVerse contracts this
// frontend already has ABIs for. The DAO can execute a call against ANY
// target with ANY calldata — this module never hides that; it only adds a
// friendlier label on top of the raw values when the target/selector happen
// to match something we recognize. Unknown targets or calldata that doesn't
// match any known ABI fall back to the raw hex, exactly as approved
// on-chain.

import { Interface, ZeroAddress } from "ethers";

import daoAbi from "../contracts/abis/StakeVerseDAO.json";
import tokenAbi from "../contracts/abis/StakeVerseToken.json";
import nftAbi from "../contracts/abis/StakeVerseNFT.json";
import { CONTRACTS } from "../contracts";

// Lazily built: (address lowercased) -> { label, interface }
let registry: Map<string, { label: string; iface: Interface }> | null = null;

function getRegistry() {
  if (registry) return registry;

  registry = new Map();

  const entries: Array<[string | undefined, string, unknown]> = [
    [CONTRACTS.dao, "StakeVerseDAO", daoAbi.abi],
    [CONTRACTS.token, "StakeVerseToken", tokenAbi.abi],
    [CONTRACTS.nft, "StakeVerseNFT", nftAbi.abi],
  ];

  for (const [address, label, abi] of entries) {
    if (!address) continue;
    try {
      registry.set(address.toLowerCase(), {
        label,
        iface: new Interface(abi as never),
      });
    } catch {
      // Malformed/missing ABI for this entry — just skip it, it stays
      // undecodable (falls back to raw display) rather than breaking the
      // whole registry.
    }
  }

  return registry;
}

export interface DecodedCall {
  contractLabel: string;
  functionSignature: string;
  args: string[];
}

/// Attempts to decode `data` as a call into `target`. Returns null (never
/// throws) when the target isn't a known StakeVerse contract, or the
/// calldata doesn't match any function on it — the caller is expected to
/// fall back to showing the raw target/data in that case.
export function decodeProposalCall(
  target: string,
  data: string
): DecodedCall | null {
  if (!target || target === ZeroAddress || !data || data === "0x") {
    return null;
  }

  const entry = getRegistry().get(target.toLowerCase());
  if (!entry) return null;

  try {
    const parsed = entry.iface.parseTransaction({ data });
    if (!parsed) return null;

    return {
      contractLabel: entry.label,
      functionSignature: parsed.signature,
      args: parsed.args.map((a) => String(a)),
    };
  } catch {
    return null;
  }
}

export const PROPOSAL_STATE_LABELS = [
  "Active",
  "Failed",
  "Succeeded",
  "Executed",
] as const;

export function proposalStateLabel(state: number): string {
  return PROPOSAL_STATE_LABELS[state] ?? `Unknown (${state})`;
}
