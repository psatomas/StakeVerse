import { Contract, formatEther, parseEther, ZeroAddress } from "ethers";

import DAO_ARTIFACT from "./abis/StakeVerseDAO.json";

import { CONTRACTS } from "./index";
import { getSigner } from "../services/web3";

const DAO_ADDRESS = CONTRACTS.dao;

export const ZERO_ADDRESS = ZeroAddress;

// Matches the DAO's ProposalState enum (Active, Failed, Succeeded, Executed)
// exactly — this is a label lookup, not a re-derivation of the state
// machine. The state NUMBER always comes from dao.state(id) on-chain.
export const PROPOSAL_STATE_LABELS = [
  "Active",
  "Failed",
  "Succeeded",
  "Executed",
] as const;

export function proposalStateLabel(state: number): string {
  return PROPOSAL_STATE_LABELS[state] ?? `Unknown (${state})`;
}

export interface Proposal {
  id: number;
  description: string;
  target: string;
  value: bigint;
  data: string;
  snapshotTimestamp: number;
  deadline: number;
  yesVotes: bigint;
  noVotes: bigint;
  executed: boolean;
  /** From dao.state(id) — never re-derived client-side. */
  state: number;
  stateLabel: string;
  /** From dao.quorumReached(id) — never re-derived client-side. */
  quorumReached: boolean;
}

export async function getDAOContract() {
  const signer = await getSigner();

  return new Contract(DAO_ADDRESS, DAO_ARTIFACT.abi, signer);
}

async function toProposal(
  contract: Contract,
  raw: {
    id: bigint;
    description: string;
    target: string;
    value: bigint;
    data: string;
    snapshotTimestamp: bigint;
    deadline: bigint;
    yesVotes: bigint;
    noVotes: bigint;
    executed: boolean;
  }
): Promise<Proposal> {
  const [state, quorumReached] = await Promise.all([
    contract.state(raw.id) as Promise<bigint>,
    contract.quorumReached(raw.id) as Promise<boolean>,
  ]);

  const stateNumber = Number(state);

  return {
    id: Number(raw.id),
    description: raw.description,
    target: raw.target,
    value: raw.value,
    data: raw.data,
    snapshotTimestamp: Number(raw.snapshotTimestamp),
    deadline: Number(raw.deadline),
    yesVotes: raw.yesVotes,
    noVotes: raw.noVotes,
    executed: raw.executed,
    state: stateNumber,
    stateLabel: proposalStateLabel(stateNumber),
    quorumReached,
  };
}

export async function getProposal(proposalId: number): Promise<Proposal> {
  const contract = await getDAOContract();

  const raw = await contract.getProposal(proposalId);

  return toProposal(contract, raw);
}

export async function getAllProposals(): Promise<Proposal[]> {
  const contract = await getDAOContract();

  const proposalCount = Number(await contract.proposalCount());

  const ids = Array.from({ length: proposalCount }, (_, i) => i + 1);

  const proposals = await Promise.all(
    ids.map(async (id) => {
      const raw = await contract.getProposal(id);
      return toProposal(contract, raw);
    })
  );

  return proposals.reverse();
}

export async function getProposalThreshold(): Promise<bigint> {
  const contract = await getDAOContract();
  return contract.proposalThreshold();
}

export async function getQuorumNumerator(): Promise<bigint> {
  const contract = await getDAOContract();
  return contract.quorumNumerator();
}

export async function hasVoted(
  proposalId: number,
  voter: string
): Promise<boolean> {
  const contract = await getDAOContract();
  return contract.hasVoted(proposalId, voter);
}

export interface CreateProposalInput {
  description: string;
  durationInSeconds: number;
  /** Empty string means "no on-chain action" (signaling-only proposal). */
  target: string;
  /** ETH amount as a decimal string, e.g. "0" or "0.5". */
  valueEth: string;
  /** Hex calldata, e.g. "0x" for none. */
  data: string;
}

/// Client-side validation mirroring the DAO's own createProposal() checks,
/// run BEFORE submitting a transaction so a malformed input surfaces a clear
/// message instead of a wallet-level revert. The contract remains the
/// actual source of truth; this only saves a doomed round trip.
export function validateCreateProposalInput(
  input: CreateProposalInput
): string | null {
  if (!input.description.trim()) {
    return "Description is required.";
  }

  if (!Number.isFinite(input.durationInSeconds) || input.durationInSeconds <= 0) {
    return "Voting duration must be a positive number of seconds.";
  }

  const hasTarget = input.target.trim().length > 0;

  if (hasTarget && !/^0x[0-9a-fA-F]{40}$/.test(input.target.trim())) {
    return "Target must be a valid contract address, or left blank for a signaling-only proposal.";
  }

  if (input.data && input.data !== "0x" && !/^0x([0-9a-fA-F]{2})*$/.test(input.data)) {
    return "Calldata must be empty (0x) or valid hex.";
  }

  let valueWei: bigint;
  try {
    valueWei = input.valueEth.trim() === "" ? 0n : parseEther(input.valueEth);
  } catch {
    return "ETH value must be a valid decimal amount.";
  }

  if (!hasTarget && (valueWei !== 0n || (input.data && input.data !== "0x"))) {
    return "A signaling-only proposal (no target) cannot carry an ETH value or calldata.";
  }

  return null;
}

export async function createProposal(input: CreateProposalInput) {
  const error = validateCreateProposalInput(input);
  if (error) {
    throw new Error(error);
  }

  const contract = await getDAOContract();

  const target = input.target.trim() || ZeroAddress;
  const value = input.valueEth.trim() === "" ? 0n : parseEther(input.valueEth);
  const data = input.data.trim() || "0x";

  const tx = await contract.createProposal(
    input.description,
    input.durationInSeconds,
    target,
    value,
    data
  );

  return tx.wait();
}

export async function voteProposal(proposalId: number, support: boolean) {
  const contract = await getDAOContract();

  const tx = await contract.vote(proposalId, support);

  return tx.wait();
}

export async function executeProposalTx(proposalId: number) {
  const contract = await getDAOContract();

  const tx = await contract.executeProposal(proposalId);

  return tx.wait();
}

/// Best-effort lookup of who created a proposal. The DAO does not store a
/// `proposer` field on-chain (only description/target/value/data/timing are
/// recorded), so this is derived by finding the ProposalCreated event for
/// this ID and reading the transaction sender — not a guaranteed-available
/// piece of data, hence "if available": it can fail or be slow depending on
/// the RPC provider's log support, and is never required for the rest of
/// the governance UI to function.
export async function getProposalCreator(
  proposalId: number
): Promise<string | null> {
  try {
    const contract = await getDAOContract();

    const filter = contract.filters.ProposalCreated(proposalId);
    const events = await contract.queryFilter(filter);

    const event = events[0];
    if (!event) return null;

    const tx = await event.getTransaction();
    return tx.from;
  } catch {
    return null;
  }
}

export function formatEth(value: bigint): string {
  return formatEther(value);
}
