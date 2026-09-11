import SectionShell from "./SectionShell";

const INVARIANTS: Array<{ id: string; title: string; code: string; explanation: string }> = [
  {
    id: "INV-01",
    title: "Reward reserve bound",
    code: "require(reward <= rewardReserve)",
    explanation:
      "Reward claims can never exceed the liquidity explicitly funded via fundRewards(). Principal (stakedBalance / totalStaked) is a separate balance and is never touched by claimRewards().",
  },
  {
    id: "INV-02",
    title: "Historical voting power",
    code: "getPastVotes(voter, snapshot)",
    explanation:
      "Every governance decision — proposal creation, voting, quorum — reads ERC20Votes checkpoints at a fixed past timepoint. Live balance and live getVotes() are never used for eligibility.",
  },
  {
    id: "INV-03",
    title: "DAO-controlled administration",
    code: "owner() == DAO",
    explanation:
      "Every onlyOwner check across the protocol resolves to the same address. Independently re-verified directly on-chain against the live deployment — not merely asserted by the deploy script.",
  },
  {
    id: "INV-04",
    title: "Permissionless execution",
    code: "state(id) == Succeeded",
    explanation:
      "executeProposal() checks a proposal's computed state, not the caller's identity. Any address can execute a Succeeded proposal — there is no centralized executor role.",
  },
];

// A ledger, not a card grid: this section answers "what can be
// guaranteed," so it's styled closer to a spec sheet's numbered clauses
// than to Architecture's node boxes or Authority's boundary panel.
export default function SecurityInvariants() {
  return (
    <SectionShell
      id="invariants"
      index="05"
      kicker="Security & Invariants"
      title="Properties the code enforces, not properties it claims"
      description="No “secure, reliable, decentralized.” Four concrete properties, each traceable to a specific line of contract logic."
    >
      <div className="divide-y divide-sv-border rounded-sv-lg border border-sv-border">
        {INVARIANTS.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 p-6 sm:flex-row sm:gap-6">
            <div className="shrink-0 sm:w-24">
              <span className="sv-text-identifier text-sv-orange-400">{item.id}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="sv-text-h3">{item.title}</h3>
              <p className="sv-text-identifier mt-2 break-words">{item.code}</p>
              <p className="sv-text-body mt-2 text-sm">{item.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
