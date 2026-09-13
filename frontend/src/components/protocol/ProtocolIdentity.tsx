import SectionShell from "../landing/SectionShell";
import { CONTRACTS } from "../../contracts";

const REPO_URL = "https://github.com/psatomas/stakeverse";

// Contract name labels aren't available from CONTRACTS itself (just
// addresses), but the addresses themselves come straight from it — the
// same runtime source every contract wrapper in this app already reads
// from — rather than a second hardcoded copy that could drift.
const CONTRACT_ROWS: Array<{ label: string; address: string }> = [
  { label: "StakeVerseToken", address: CONTRACTS.token },
  { label: "StakeVerseDAO", address: CONTRACTS.dao },
  { label: "StakeVerseStaking", address: CONTRACTS.staking },
  { label: "StakeVerseNFT", address: CONTRACTS.nft },
  { label: "PriceOracleConsumer", address: CONTRACTS.oracle },
];

export default function ProtocolIdentity() {
  return (
    <SectionShell
      id="protocol-identity"
      index="01"
      kicker="Protocol Identity"
      title="What's actually deployed, and where"
      description="Everything on this page is read live from these five addresses on Ethereum Sepolia — no separate synthetic environment, no mock data."
    >
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <dt className="sv-text-label">Network</dt>
          <dd className="sv-text-technical text-right text-sm sm:text-base">Ethereum Sepolia</dd>
        </div>
        <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <dt className="sv-text-label">Chain ID</dt>
          <dd className="sv-text-technical text-right text-sm sm:text-base">11155111</dd>
        </div>
        {CONTRACT_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt className="sv-text-label">{row.label}</dt>
            <dd className="sv-text-identifier break-all text-right">{row.address}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <dt className="sv-text-label">Repository</dt>
          <dd className="text-right text-sm sm:text-base">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sv-text-identifier text-sv-orange-400 hover:text-sv-orange-300"
            >
              {REPO_URL.replace("https://", "")}
            </a>
          </dd>
        </div>
      </dl>
    </SectionShell>
  );
}
