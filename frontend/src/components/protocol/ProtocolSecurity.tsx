import SectionShell from "../landing/SectionShell";

// Reused verbatim from Overview's SecurityInvariants (INV-01 / INV-04) —
// not rewritten. DAO-controlled administration is deliberately NOT
// repeated here as a third static entry: it's the one property this page
// actually verifies live, in Authority above, so restating it here as a
// static claim would undersell what that section does.
const STATIC_INVARIANTS: Array<{ id: string; title: string; code: string; explanation: string }> = [
  {
    id: "INV-01",
    title: "Reward reserve bound",
    code: "require(reward <= rewardReserve)",
    explanation:
      "Reward claims can never exceed the liquidity explicitly funded via fundRewards(). Principal (stakedBalance / totalStaked) is a separate balance and is never touched by claimRewards().",
  },
  {
    id: "INV-04",
    title: "Permissionless execution",
    code: "state(id) == Succeeded",
    explanation:
      "executeProposal() checks a proposal's computed state, not the caller's identity. Any address can execute a Succeeded proposal — there is no centralized executor role.",
  },
];

export default function ProtocolSecurity() {
  return (
    <SectionShell
      id="protocol-security"
      index="06"
      kicker="Security & Invariants"
      title="What's live-checked, and what's structural"
      description="DAO-controlled administration is verified live in Authority above — not restated here. These two remain code-derived explanations, because no single on-chain read can verify a function's behavior under all possible inputs."
    >
      <div className="mb-4">
        <p className="sv-text-label text-sv-orange-400">Live-verified</p>
        <p className="sv-text-body mt-1 text-sm">
          DAO-controlled administration — see{" "}
          <a href="#protocol-authority" className="text-sv-orange-400 hover:text-sv-orange-300">
            Authority
          </a>{" "}
          above.
        </p>
      </div>

      <p className="sv-text-label mb-2 mt-6 text-sv-text-muted">Structural, code-derived</p>
      <div className="divide-y divide-sv-border rounded-sv-lg border border-sv-border">
        {STATIC_INVARIANTS.map((item) => (
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

      <p className="sv-text-metadata mt-4 max-w-2xl">
        This page verifies specific, checkable facts — it is not an independent security audit.
        See Overview's Trust &amp; Limitations for the full set of assumptions and caveats.
      </p>
    </SectionShell>
  );
}
