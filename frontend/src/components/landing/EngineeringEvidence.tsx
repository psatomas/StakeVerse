import SectionShell from "./SectionShell";

const FACTS: Array<{ label: string; value: string }> = [
  { label: "Test suite", value: "146 / 146 passing" },
  { label: "Contract coverage", value: "100% line & statement — production contracts" },
  { label: "Language", value: "Solidity 0.8.28" },
  { label: "Network", value: "Ethereum Sepolia · chainId 11155111" },
  { label: "Ownership", value: "Token / Staking / NFT / DAO — owner() == DAO (on-chain verified)" },
];

export default function EngineeringEvidence() {
  return (
    <SectionShell
      id="evidence"
      index="06"
      kicker="Engineering Evidence"
      title="Reproducible, not asserted"
      description="Every figure below is produced by the repository's own tooling (npx hardhat test --coverage, the deploy workflow's on-chain checks) — not a third-party audit badge."
    >
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        {FACTS.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt className="sv-text-label">{fact.label}</dt>
            <dd className="sv-text-technical text-right text-sm sm:text-base">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}
