import SectionShell from "../landing/SectionShell";
import Callout from "../landing/Callout";
import { CONTRACTS } from "../../contracts";

type Props = {
  tokenOwner: string | null;
  stakingOwner: string | null;
  nftOwner: string | null;
  daoOwner: string | null;
  loading: boolean;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// The differentiated section: not a repeated claim that the DAO owns
// everything, but a live equality check across four separate eth_calls,
// run and shown as verified-now — or honestly reported as unavailable if
// any of the four reads didn't come back.
export default function ProtocolAuthority({
  tokenOwner,
  stakingOwner,
  nftOwner,
  daoOwner,
  loading,
}: Props) {
  const owners = [
    { label: "StakeVerseToken.owner()", value: tokenOwner },
    { label: "StakeVerseStaking.owner()", value: stakingOwner },
    { label: "StakeVerseNFT.owner()", value: nftOwner },
    { label: "StakeVerseDAO.owner()", value: daoOwner },
  ];

  const allLoaded = owners.every((o) => o.value !== null);
  // Equal-to-each-other is necessary but not sufficient: it only proves the
  // four contracts share a common owner, not that the owner is actually the
  // DAO. "DAO ownership verified" requires that common owner to be exactly
  // CONTRACTS.dao — the same canonical address every other DAO read on this
  // page already resolves through.
  const allMatch =
    allLoaded &&
    owners.every((o) => o.value === owners[0].value) &&
    owners[0].value === CONTRACTS.dao;

  return (
    <SectionShell
      id="protocol-authority"
      index="05"
      kicker="Authority"
      title="Who actually controls these contracts"
      description="Not an assertion — a live cross-check. Every onlyOwner function in the protocol resolves through one of these four owner() reads."
    >
      <dl className="divide-y divide-sv-border rounded-sv-lg border border-sv-border bg-sv-black-900">
        {owners.map((owner) => (
          <div
            key={owner.label}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt className="sv-text-identifier">{owner.label}</dt>
            <dd className="sv-text-identifier text-right text-sv-text-technical">
              {loading ? "Loading…" : owner.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        {loading ? (
          <Callout tone="neutral" label="Verifying">
            Reading owner() from all four contracts against the live chain…
          </Callout>
        ) : allMatch ? (
          <Callout tone="orange" label="Live Verification">
            DAO ownership verified — Token, Staking, NFT and the DAO itself all resolve to the
            same owner,{" "}
            <span className="sv-text-identifier">{short(owners[0].value as string)}</span>, confirmed
            by four separate reads against the live chain just now.
          </Callout>
        ) : allLoaded ? (
          <Callout tone="yellow" label="Ownership mismatch">
            These four owner() reads do not currently agree — see the addresses above.
          </Callout>
        ) : (
          <Callout tone="neutral" label="Verification unavailable">
            One or more owner() reads did not return a value. This reflects a read/RPC issue, not
            a claim about the protocol's actual ownership.
          </Callout>
        )}
      </div>
    </SectionShell>
  );
}
