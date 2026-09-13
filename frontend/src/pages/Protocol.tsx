import ProtocolNav from "../components/protocol/ProtocolNav";
import ProtocolIdentity from "../components/protocol/ProtocolIdentity";
import ProtocolArchitecture from "../components/protocol/ProtocolArchitecture";
import ProtocolLiveState from "../components/protocol/ProtocolLiveState";
import ProtocolProposals from "../components/protocol/ProtocolProposals";
import ProtocolAuthority from "../components/protocol/ProtocolAuthority";
import ProtocolSecurity from "../components/protocol/ProtocolSecurity";
import ProtocolEvidence from "../components/protocol/ProtocolEvidence";

import { useProtocolState } from "../hooks/useProtocolState";

// The third screen: system-centric, not wallet-centric. Unlike Dashboard,
// nothing here requires a connected wallet — useProtocolState reads
// through the app's read-only provider. Unlike Landing, nothing here is
// static copy — every figure is a live read, honestly null until it
// resolves.
export default function Protocol() {
  const { token, staking, dao, nftOwner, oraclePrice, proposals, deployedCode, loading } =
    useProtocolState();

  return (
    <div className="sv-surface text-sv-text-primary">
      <ProtocolNav />

      <main className="relative z-10 mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
        <ProtocolIdentity />
        <ProtocolArchitecture />

        <ProtocolLiveState
          totalSupply={token.totalSupply}
          totalStaked={staking.totalStaked}
          rewardReserve={staking.rewardReserve}
          rewardRate={staking.rewardRate}
          paused={staking.paused}
          proposalThreshold={dao.proposalThreshold}
          quorumNumerator={dao.quorumNumerator}
          oraclePrice={oraclePrice}
          loading={loading}
        />

        <ProtocolProposals proposals={proposals} proposalCount={dao.proposalCount} loading={loading} />

        <ProtocolAuthority
          tokenOwner={token.owner}
          stakingOwner={staking.owner}
          nftOwner={nftOwner}
          daoOwner={dao.owner}
          loading={loading}
        />

        <ProtocolSecurity />

        <ProtocolEvidence deployedCode={deployedCode} loading={loading} />
      </main>

      <footer className="relative z-10 border-t border-sv-border">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="sv-text-metadata">
            StakeVerse — live chain state, read without a wallet. See the{" "}
            <a href="#app" className="text-sv-orange-400 hover:text-sv-orange-300">
              application
            </a>{" "}
            to interact with it, or{" "}
            <a href="#" className="text-sv-orange-400 hover:text-sv-orange-300">
              Overview
            </a>{" "}
            for how it all fits together.
          </p>
        </div>
      </footer>
    </div>
  );
}
