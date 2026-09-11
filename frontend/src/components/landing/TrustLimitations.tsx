import SectionShell from "./SectionShell";

const GUARANTEES = [
  "Reward claims cannot exceed the funded reward reserve.",
  "Governance eligibility is always historical (ERC20Votes checkpoints), never a live balance.",
  "Every administrative function resolves to the DAO — the deployer holds no standing authority.",
  "A Succeeded proposal can be executed by anyone — no centralized executor.",
];

const LIMITATIONS = [
  "No third-party audit. This is the product of a structured, multi-phase remediation and verification process against this repository's own tests and on-chain checks — not an independent security firm's review.",
  "The oracle is standalone. PriceOracleConsumer validates and returns an ETH/USD price, but no execution path in Staking or the DAO currently consumes it.",
  "Voting power depends entirely on delegation. Holding SVT grants zero voting power until delegate() is called — an unfamiliar holder can mistake a zero balance-derived assumption for a bug.",
  "DAO self-governance has no external override. If quorumNumerator or proposalThreshold is ever set beyond what current delegation can satisfy, the only way back is another proposal that must clear the same bar.",
  "SVT and the membership NFT are uncapped by design. Both are minted exclusively by the DAO with no supply ceiling — a deliberate governance-controlled tradeoff, not an access-control gap.",
];

export default function TrustLimitations() {
  return (
    <SectionShell
      id="trust"
      index="07"
      kicker="Trust Model & Limitations"
      title="What's enforced, and what you're trusting"
      description="Caveats are not softened for presentation — they're the same ones recorded in the project's own security audit."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="sv-text-label text-sv-orange-400">Protocol-enforced guarantees</p>
          <ul className="mt-4 space-y-3">
            {GUARANTEES.map((item) => (
              <li key={item} className="sv-text-body flex gap-3 text-sm">
                <span aria-hidden="true" className="text-sv-orange-400">▣</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="sv-text-label text-sv-yellow-300">External assumptions &amp; limitations</p>
          <ul className="mt-4 space-y-3">
            {LIMITATIONS.map((item) => (
              <li key={item} className="sv-text-body flex gap-3 text-sm">
                <span aria-hidden="true" className="text-sv-yellow-300">▲</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
