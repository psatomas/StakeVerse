import { useEffect, useState, useCallback } from "react";

import type { Proposal, CreateProposalInput } from "../contracts/dao";

import {
  getAllProposals,
  voteProposal,
  createProposal,
  executeProposalTx,
  validateCreateProposalInput,
  hasVoted as hasVotedOnChain,
} from "../contracts/dao";

import { getPastVotingPower } from "../contracts/token";

import { formatTxError } from "../utils/txError";

export interface ProposalWithVoterInfo extends Proposal {
  /** msg.sender's historical voting power AT THIS PROPOSAL'S SNAPSHOT —
   * never balanceOf(), never live getVotes(). This is exactly what the DAO
   * itself checks in vote(). */
  voterPower: bigint;
  hasVotedByUser: boolean;
}

// Pass the stateful wallet address down to control execution flow
export function useGovernance(address: string) {
  const [proposals, setProposals] = useState<ProposalWithVoterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState("");

  // Memoize loadProposals so it can safely be monitored as a dependency
  const loadProposals = useCallback(async () => {
    // CIRCUIT BREAKER: Block execution instantly if the wallet isn't authenticated yet
    if (!address) return;

    try {
      setLoading(true);
      setError("");

      const data = await getAllProposals();

      // Historical voting power is per-(voter, proposal snapshot) — fetch
      // it and the has-voted flag for the connected wallet against every
      // proposal, so the UI can explain eligibility up front instead of
      // after a failed transaction.
      const withVoterInfo = await Promise.all(
        data.map(async (proposal) => {
          const [voterPower, hasVotedByUser] = await Promise.all([
            getPastVotingPower(address, proposal.snapshotTimestamp),
            hasVotedOnChain(proposal.id, address),
          ]);

          return { ...proposal, voterPower, hasVotedByUser };
        })
      );

      setProposals(withVoterInfo);
    } catch (err) {
      console.error(err);
      setError("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [address]);

  async function castVote(id: number, support: boolean) {
    if (!address) return;

    const proposal = proposals.find((p) => p.id === id);

    // Explain zero historical voting power up front rather than letting the
    // wallet round-trip into a generic revert. Never derived from
    // balanceOf() — voterPower was fetched via getPastVotes() above.
    if (proposal && proposal.voterPower === 0n) {
      setError(
        "You have zero historical voting power for this proposal. This " +
          "happens if you had not delegated (or held no tokens) before " +
          "this proposal was created — delegating or acquiring tokens " +
          "now will not retroactively grant power for it."
      );
      return;
    }

    try {
      setTxLoading(true);
      setError("");

      await voteProposal(id, support);
      await loadProposals();
    } catch (err) {
      console.error(err);
      setError(formatTxError(err));
    } finally {
      setTxLoading(false);
    }
  }

  async function voteYes(id: number) {
    await castVote(id, true);
  }

  async function voteNo(id: number) {
    await castVote(id, false);
  }

  async function submitProposal(input: CreateProposalInput) {
    if (!address) return;

    const validationError = validateCreateProposalInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setTxLoading(true);
      setError("");

      await createProposal(input);
      await loadProposals();
    } catch (err) {
      console.error(err);
      setError(formatTxError(err));
    } finally {
      setTxLoading(false);
    }
  }

  async function executeProposal(id: number) {
    const proposal = proposals.find((p) => p.id === id);

    // Execution is only meaningful once state() says Succeeded — mirrors
    // the contract's own gate so the button explains itself instead of
    // silently reverting if clicked in a stale render.
    if (proposal && proposal.state !== 2) {
      setError(
        `This proposal is not executable right now (state: ${proposal.stateLabel}).`
      );
      return;
    }

    try {
      setTxLoading(true);
      setError("");

      await executeProposalTx(id);
      await loadProposals();
    } catch (err) {
      console.error(err);
      setError(formatTxError(err));
    } finally {
      setTxLoading(false);
    }
  }

  // This effect will run automatically when the application mounts AND
  // whenever the wallet successfully finishes connecting/switching networks!
  // (Pre-existing pattern shared with useDashboard.ts — the underlying
  // react-hooks/set-state-in-effect lint gap is codebase-wide, not
  // introduced here; suppressed locally rather than restructured, since
  // restructuring the shared load-on-mount pattern is outside this step's
  // scope.)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProposals();
  }, [loadProposals]);

  return {
    proposals,
    loading,
    txLoading,
    error,
    refresh: loadProposals,
    voteYes,
    voteNo,
    submitProposal,
    executeProposal,
  };
}
