import SectionShell from "./SectionShell";

const PERMISSIONLESS: Array<{ fn: string; note: string }> = [
  { fn: "stake()", note: "Blocked only while the DAO has paused new deposits." },
  { fn: "unstake()", note: "Always available — principal can never be trapped by a pause." },
  { fn: "claimRewards()", note: "Always available, bounded by the reward reserve." },
  { fn: "vote()", note: "Any address with historical voting power for that proposal." },
  { fn: "createProposal()", note: "Any address meeting proposalThreshold — not identity-gated." },
  { fn: "executeProposal()", note: "Any address, once a proposal's state is Succeeded." },
];

const DAO_CONTROLLED: Array<{ fn: string; note: string }> = [
  { fn: "StakeVerseToken.mint()", note: "New SVT supply — DAO-only." },
  { fn: "StakeVerseStaking.fundRewards()", note: "The only way rewardReserve increases." },
  { fn: "StakeVerseStaking.setRewardRate()", note: "Capped at 100% — DAO-only." },
  { fn: "StakeVerseStaking.pause() / unpause()", note: "Gates new stake() deposits only." },
  { fn: "StakeVerseNFT.mint()", note: "Membership badge issuance — DAO-only." },
  { fn: "setQuorumNumerator() / setProposalThreshold()", note: "The DAO's own eligibility bars — DAO-only." },
];

// Deliberately not the same two-cards-side-by-side shape as before: this
// section answers "who is allowed to act," so the boundary itself — one
// continuous panel split by a single crossing line — is the subject, not
// a second copy of the architecture graph's ownership facts.
export default function AuthorityModel() {
  return (
    <SectionShell
      id="authority"
      index="04"
      kicker="Authority & Control"
      title="Who is allowed to act, and where that line sits"
      description="Every onlyOwner function in the protocol resolves to the same owner: the DAO. Deployer holds zero administrative authority on any of the four governed contracts (independently re-verified on-chain — see Engineering Evidence)."
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-sv-lg border border-sv-border">
        <div className="bg-sv-black-900 px-6 py-4">
          <p className="sv-text-label text-sv-text-secondary">
            User / Public — permissionless
          </p>
        </div>

        <ul className="divide-y divide-sv-border bg-sv-black-900">
          {PERMISSIONLESS.map((item) => (
            <li
              key={item.fn}
              className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="sv-text-identifier w-56 shrink-0 break-all text-sv-text-primary">
                {item.fn}
              </span>
              <span className="sv-text-metadata">{item.note}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-y border-sv-border-orange/50 bg-sv-orange-500/10 px-6 py-2.5">
          <span className="h-px flex-1 bg-sv-border-orange/30" aria-hidden="true" />
          <span className="sv-text-label whitespace-nowrap text-sv-orange-400">
            ▣ Authority boundary — onlyOwner
          </span>
          <span className="h-px flex-1 bg-sv-border-orange/30" aria-hidden="true" />
        </div>

        <div className="bg-sv-orange-500/5 px-6 py-4">
          <p className="sv-text-label text-sv-orange-400">
            DAO Authority — administrative
          </p>
        </div>

        <ul className="divide-y divide-sv-border-orange/20 bg-sv-orange-500/5">
          {DAO_CONTROLLED.map((item) => (
            <li
              key={item.fn}
              className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="sv-text-identifier w-56 shrink-0 break-all text-sv-text-primary">
                {item.fn}
              </span>
              <span className="sv-text-metadata">{item.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
