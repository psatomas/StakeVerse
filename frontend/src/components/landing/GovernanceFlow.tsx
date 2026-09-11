import SectionShell from "./SectionShell";
import FlowSequence, { type FlowStepData } from "./FlowSequence";
import Callout from "./Callout";

const STEPS: FlowStepData[] = [
  {
    id: "delegate",
    title: "Delegate",
    description:
      "delegate() is explicit and never automatic — holding SVT grants zero voting power until the holder delegates, even to themselves.",
    technical: "delegates(holder)",
  },
  {
    id: "history",
    title: "Historical Voting Power",
    description:
      "ERC20Votes checkpoints voting power at every mint, transfer and delegation. The DAO always reads a past snapshot — never a live balance.",
    technical: "getPastVotes(voter, snapshot)",
    checkpoint: true,
  },
  {
    id: "proposal",
    title: "Proposal",
    description:
      "Anyone meeting proposalThreshold — a DAO-adjustable minimum, 1,000 SVT of historical voting power by default — may create a proposal. Its snapshot is backdated one second, closing a same-block delegate-then-propose loophole.",
    technical: "proposalThreshold = 1,000 SVT (default, DAO-adjustable)",
  },
  {
    id: "vote",
    title: "Vote",
    description:
      "Each address votes once per proposal, weighted by its voting power at that proposal's own snapshot — not current power.",
    technical: "hasVoted[id][voter]",
  },
  {
    id: "quorum",
    title: "Quorum / Threshold",
    description:
      "A proposal succeeds only once participation (yes + no) reaches quorumNumerator — a DAO-adjustable share, 10% by default — of total voting supply at the snapshot, and yes votes exceed no votes.",
    technical: "quorumNumerator = 10% (default, DAO-adjustable)",
    checkpoint: true,
  },
  {
    id: "execute",
    title: "Execute",
    description:
      "Once Succeeded, executeProposal() is permissionless — any address may trigger it. A failed external call reverts the whole transaction, leaving the proposal Succeeded and retryable rather than burned.",
    technical: "target.call{value}(data)",
    signal: true,
  },
];

export default function GovernanceFlow() {
  return (
    <SectionShell
      id="governance"
      index="03"
      kicker="Governance Flow"
      title="From delegation to execution"
      description="Governance runs entirely on ERC20Votes history — deliberately independent of the staking system next to it."
    >
      <FlowSequence steps={STEPS} variant="governance" />

      <div className="mt-8">
        <Callout tone="yellow" label="Read this before assuming otherwise">
          Staking balance and governance voting power are entirely separate.
          Voting power comes only from delegated ERC20Votes history — staking
          SVT does not, by itself, grant or increase voting power.
        </Callout>
      </div>
    </SectionShell>
  );
}
