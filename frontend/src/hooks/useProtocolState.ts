import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "ethers";

import { getTotalSupply, getTokenOwner } from "../contracts/token";
import {
  getTotalStaked,
  getRewardReserve,
  getRewardRateReadOnly,
  getStakingPaused,
  getStakingOwner,
} from "../contracts/staking";
import {
  getProposalThresholdReadOnly,
  getQuorumNumeratorReadOnly,
  getProposalCountReadOnly,
  getDaoOwner,
  getAllProposalsReadOnly,
  type Proposal,
} from "../contracts/dao";
import { getNftOwner } from "../contracts/nft";
import { getLatestEthPriceReadOnly } from "../contracts/oracle";
import { hasDeployedCode } from "../services/web3";
import { CONTRACTS } from "../contracts/index";

export interface ProtocolTokenState {
  totalSupply: string | null;
  owner: string | null;
}

export interface ProtocolStakingState {
  totalStaked: string | null;
  rewardReserve: string | null;
  rewardRate: string | null;
  paused: boolean | null;
  owner: string | null;
}

export interface ProtocolDaoState {
  proposalThreshold: string | null;
  quorumNumerator: string | null;
  proposalCount: number | null;
  owner: string | null;
}

export interface DeployedCodeState {
  token: boolean | null;
  staking: boolean | null;
  dao: boolean | null;
  nft: boolean | null;
  oracle: boolean | null;
}

const EMPTY_TOKEN: ProtocolTokenState = { totalSupply: null, owner: null };
const EMPTY_STAKING: ProtocolStakingState = {
  totalStaked: null,
  rewardReserve: null,
  rewardRate: null,
  paused: null,
  owner: null,
};
const EMPTY_DAO: ProtocolDaoState = {
  proposalThreshold: null,
  quorumNumerator: null,
  proposalCount: null,
  owner: null,
};
const EMPTY_DEPLOYED_CODE: DeployedCodeState = {
  token: null,
  staking: null,
  dao: null,
  nft: null,
  oracle: null,
};

/**
 * Loads everything the Protocol page needs, in one pass, via the read-only
 * provider — deliberately not gated on a connected wallet, unlike
 * useDashboard. Same shape/conventions as the rest of this app's data
 * hooks: load once on mount, expose a manual `reload`, one shared
 * `loading` flag, and every individual field stays honestly `null` until
 * its own read actually succeeds — nothing here is ever a fabricated
 * fallback. Grouped by contract (token/staking/dao/...) rather than one
 * flat list of a dozen fields, so each read stays traceable to where it
 * came from.
 */
export function useProtocolState() {
  const [token, setToken] = useState<ProtocolTokenState>(EMPTY_TOKEN);
  const [staking, setStaking] = useState<ProtocolStakingState>(EMPTY_STAKING);
  const [dao, setDao] = useState<ProtocolDaoState>(EMPTY_DAO);
  const [nftOwner, setNftOwner] = useState<string | null>(null);
  const [oraclePrice, setOraclePrice] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [deployedCode, setDeployedCode] = useState<DeployedCodeState>(EMPTY_DEPLOYED_CODE);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [
        totalSupply,
        tokenOwner,
        totalStaked,
        rewardReserve,
        rewardRate,
        paused,
        stakingOwner,
        proposalThresholdRaw,
        quorumNumeratorRaw,
        proposalCount,
        daoOwner,
        nftOwnerValue,
        price,
        proposalsResult,
        tokenCode,
        stakingCode,
        daoCode,
        nftCode,
        oracleCode,
      ] = await Promise.all([
        getTotalSupply(),
        getTokenOwner(),
        getTotalStaked(),
        getRewardReserve(),
        getRewardRateReadOnly(),
        getStakingPaused(),
        getStakingOwner(),
        getProposalThresholdReadOnly(),
        getQuorumNumeratorReadOnly(),
        getProposalCountReadOnly(),
        getDaoOwner(),
        getNftOwner(),
        getLatestEthPriceReadOnly(),
        getAllProposalsReadOnly(),
        hasDeployedCode(CONTRACTS.token),
        hasDeployedCode(CONTRACTS.staking),
        hasDeployedCode(CONTRACTS.dao),
        hasDeployedCode(CONTRACTS.nft),
        hasDeployedCode(CONTRACTS.oracle),
      ]);

      setToken({ totalSupply, owner: tokenOwner });
      setStaking({ totalStaked, rewardReserve, rewardRate, paused, owner: stakingOwner });
      setDao({
        proposalThreshold:
          proposalThresholdRaw !== null ? formatUnits(proposalThresholdRaw, 18) : null,
        quorumNumerator: quorumNumeratorRaw !== null ? quorumNumeratorRaw.toString() : null,
        proposalCount,
        owner: daoOwner,
      });
      setNftOwner(nftOwnerValue);
      setOraclePrice(price);
      setProposals(proposalsResult ?? []);
      setDeployedCode({
        token: tokenCode,
        staking: stakingCode,
        dao: daoCode,
        nft: nftCode,
        oracle: oracleCode,
      });
    } catch (error) {
      console.error("Failed to load protocol state:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load once on mount — no address to wait on, unlike useDashboard, since
  // this never requires a connected wallet. Same codebase-wide
  // react-hooks/set-state-in-effect gap noted in useDashboard.ts et al.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return {
    token,
    staking,
    dao,
    nftOwner,
    oraclePrice,
    proposals,
    deployedCode,
    loading,
    reload: load,
  };
}
