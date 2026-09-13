import SectionShell from "../landing/SectionShell";
import { CONTRACTS } from "../../contracts";
import type { DeployedCodeState } from "../../hooks/useProtocolState";

const ETHERSCAN_BASE = "https://sepolia.etherscan.io/address/";
const WORKFLOW_RUN_URL = "https://github.com/psatomas/stakeverse/actions/runs/34425490553";

// Static facts sourced from deployment/sepolia.json's "current" entry and
// audit/hardhat_coverage.txt — the same figures Overview's Engineering
// Evidence already states, not restated with different wording.
const STATIC_FACTS: Array<{ label: string; value: string }> = [
  { label: "Network", value: "Ethereum Sepolia" },
  { label: "Chain ID", value: "11155111" },
  { label: "Deployer", value: "0x4Bc5db5a2e45F1a4AD111237baeede1b46746D9e" },
  { label: "Deployed", value: "2026-09-10T01:29:39Z" },
  { label: "Test suite", value: "146 / 146 passing" },
  { label: "Contract coverage", value: "100% line & statement — production contracts" },
];

const CONTRACTS_LIST: Array<{ label: string; key: keyof DeployedCodeState; address: string }> = [
  { label: "StakeVerseToken", key: "token", address: CONTRACTS.token },
  { label: "StakeVerseDAO", key: "dao", address: CONTRACTS.dao },
  { label: "StakeVerseStaking", key: "staking", address: CONTRACTS.staking },
  { label: "StakeVerseNFT", key: "nft", address: CONTRACTS.nft },
  { label: "PriceOracleConsumer", key: "oracle", address: CONTRACTS.oracle },
];

type Props = {
  deployedCode: DeployedCodeState;
  loading: boolean;
};

function CodeStatus({ loading, status }: { loading: boolean; status: boolean | null }) {
  if (loading) return <span className="sv-text-technical text-sm">Checking…</span>;
  if (status === true) return <span className="sv-text-technical text-sm text-sv-success">✓ Deployed</span>;
  if (status === false) return <span className="sv-text-technical text-sm text-sv-error">✗ No bytecode found</span>;
  return <span className="sv-text-technical text-sm">—</span>;
}

export default function ProtocolEvidence({ deployedCode, loading }: Props) {
  return (
    <SectionShell
      id="protocol-evidence"
      index="07"
      kicker="Deployment / Evidence"
      title="Reproducible, not asserted"
      description="Same posture as Overview's Engineering Evidence, plus one live check specific to this page: that bytecode genuinely exists at each address right now — not just that the address string is well-formed."
    >
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        {STATIC_FACTS.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt className="sv-text-label">{fact.label}</dt>
            <dd className="sv-text-technical text-right text-sm sm:text-base">{fact.value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <dt className="sv-text-label">Deployment workflow</dt>
          <dd className="text-right text-sm sm:text-base">
            <a
              href={WORKFLOW_RUN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sv-text-identifier text-sv-orange-400 hover:text-sv-orange-300"
            >
              GitHub Actions run
            </a>
          </dd>
        </div>
      </dl>

      <p className="sv-text-label mb-2 mt-8 text-sv-text-muted">Live bytecode check — getCode()</p>
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        {CONTRACTS_LIST.map((c) => (
          <div
            key={c.label}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <dt className="sv-text-label">{c.label}</dt>
              <a
                href={`${ETHERSCAN_BASE}${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sv-text-identifier mt-1 block break-all text-sv-text-technical hover:text-sv-orange-400"
              >
                {c.address}
              </a>
            </div>
            <dd className="shrink-0 text-right">
              <CodeStatus loading={loading} status={deployedCode[c.key]} />
            </dd>
          </div>
        ))}
      </dl>

      <p className="sv-text-metadata mt-4 max-w-2xl">
        This confirms deployed bytecode exists at each address — it does not verify that the
        source code matches what's in this repository (no source verification has been submitted
        to Etherscan for this deployment).
      </p>
    </SectionShell>
  );
}
