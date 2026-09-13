import SectionShell from "./SectionShell";

const REPO_URL = "https://github.com/psatomas/stakeverse";

const DEPLOYMENT = [
  { label: "StakeVerseToken", address: "0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd" },
  { label: "StakeVerseDAO", address: "0x8B555044B4c0A0a91cb0028043004d94291FD01F" },
  { label: "StakeVerseStaking", address: "0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64" },
  { label: "StakeVerseNFT", address: "0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C" },
  { label: "PriceOracleConsumer", address: "0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F" },
];

const TRANSITION =
  "transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)]";

export default function ExploreCTA() {
  return (
    <SectionShell
      id="explore"
      index="08"
      kicker="Explore / Interact"
      title="See the mechanisms above in the running application"
      description="The application is the same staking, delegation, proposal and voting UI described in the sections above — connected to the live Sepolia deployment."
    >
      <div className="flex flex-wrap items-center gap-4">
        <a
          href="#app"
          className={`rounded-sv-md border border-sv-orange-500 bg-sv-orange-500 px-6 py-3 font-medium text-sv-black-950 hover:bg-sv-orange-400 ${TRANSITION}`}
        >
          Launch App →
        </a>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-sv-md border border-sv-border-strong px-6 py-3 font-medium text-sv-text-primary hover:border-sv-orange-500 hover:text-sv-orange-400 ${TRANSITION}`}
        >
          View Source
        </a>
      </div>

      <details className="mt-8 rounded-sv-md border border-sv-border bg-sv-black-900 p-5">
        <summary className="sv-text-label cursor-pointer text-sv-text-primary">
          Deployment record — Ethereum Sepolia
        </summary>
        <dl className="mt-4 space-y-2">
          {DEPLOYMENT.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="sv-text-metadata w-40 shrink-0">{entry.label}</dt>
              <dd className="sv-text-identifier break-all">{entry.address}</dd>
            </div>
          ))}
        </dl>
      </details>
    </SectionShell>
  );
}
