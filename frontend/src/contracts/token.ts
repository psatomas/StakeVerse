import {
  Contract,
  formatUnits,
  parseUnits,
  ZeroAddress,
} from "ethers";

import tokenAbi from "./abis/StakeVerseToken.json";

import { CONTRACTS } from "./index";

import { getSigner } from "../services/web3";

export async function getTokenContract() {
  const signer = await getSigner();

  return new Contract(
    CONTRACTS.token,
    tokenAbi.abi,
    signer
  );
}

export async function getTokenBalance(
  address: string
) {
  const contract = await getTokenContract();

  const balance = await contract.balanceOf(address);

  return formatUnits(balance, 18);
}

export async function approveTokens(
  amount: string
) {
  const contract = await getTokenContract();

  const tx = await contract.approve(
    CONTRACTS.staking,
    parseUnits(amount, 18)
  );

  return await tx.wait();
}

// --- ERC20Votes: delegation / voting power -------------------------------
//
// IMPORTANT: none of this reads balanceOf() as voting power. Holding SVT
// gives zero voting power until the holder calls delegate() — these
// functions surface exactly that ERC20Votes behavior rather than papering
// over it, so the UI can show it explicitly instead of silently delegating
// on the user's behalf.

/// The address `holder` currently delegates their voting power to.
/// ZeroAddress means "never delegated" — NOT "delegates to no one holding
/// zero power" and NOT "delegates to self"; ERC20Votes leaves this at the
/// zero address by default.
export async function getDelegate(holder: string): Promise<string> {
  const contract = await getTokenContract();
  return contract.delegates(holder);
}

/// Current (live) voting power — i.e. what a vote cast RIGHT NOW would use
/// as its weight if there were no historical snapshot involved. This is
/// getVotes(), never balanceOf(). Actual votes/proposal-creation on the DAO
/// use the HISTORICAL variant (getPastVotes at a specific snapshot), which
/// this value only approximates for "am I currently eligible" display
/// purposes.
export async function getCurrentVotingPower(holder: string): Promise<bigint> {
  const contract = await getTokenContract();
  return contract.getVotes(holder);
}

/// Historical voting power as of a specific past timepoint (a proposal's
/// snapshotTimestamp). This is what the DAO itself actually checks for
/// voting and proposal-creation eligibility — never balanceOf().
export async function getPastVotingPower(
  holder: string,
  timepoint: number
): Promise<bigint> {
  const contract = await getTokenContract();
  return contract.getPastVotes(holder, timepoint);
}

export async function getPastTotalVotingSupply(
  timepoint: number
): Promise<bigint> {
  const contract = await getTokenContract();
  return contract.getPastTotalSupply(timepoint);
}

export function hasActivatedVotingPower(delegate: string): boolean {
  return delegate !== ZeroAddress && delegate !== "";
}

/// The explicit "Activate Voting Power" action: self-delegation. This is
/// the ONLY delegation call this app ever issues on the user's behalf, and
/// it always requires the user to click a button and confirm a wallet
/// transaction — nothing here delegates automatically.
export async function delegateToSelf(address: string) {
  const contract = await getTokenContract();

  const tx = await contract.delegate(address);

  return tx.wait();
}

/// Delegates to an arbitrary address (not necessarily the caller). Also
/// always explicit/user-initiated.
export async function delegateTo(delegatee: string) {
  const contract = await getTokenContract();

  const tx = await contract.delegate(delegatee);

  return tx.wait();
}