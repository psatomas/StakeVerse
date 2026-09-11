import { Contract, formatUnits } from "ethers";

import oracleAbi from "./abis/PriceOracleConsumer.json";

import { CONTRACTS } from "./index";

import { getSigner, getReadOnlyProvider } from "../services/web3";

// PriceOracleConsumer.getLatestETHPrice() returns the Chainlink feed's raw
// `answer`, unscaled (see contracts/PriceOracleConsumer.sol) — the contract
// deliberately does not expose decimals(). Sepolia/mainnet ETH/USD feeds
// report with 8 decimals; that fixed convention is applied here, on the
// display side only, rather than changing what the contract returns.
const ETH_USD_FEED_DECIMALS = 8;

export async function getOracleContract() {
  const signer = await getSigner();

  return new Contract(
    CONTRACTS.oracle,
    oracleAbi.abi,
    signer
  );
}

export async function getLatestEthPrice(): Promise<string> {
  const contract = await getOracleContract();

  const answer = await contract.getLatestETHPrice();

  return formatUnits(answer, ETH_USD_FEED_DECIMALS);
}

// --- Read-only read (Protocol page — no connected wallet required) --------

export function getReadOnlyOracleContract() {
  return new Contract(CONTRACTS.oracle, oracleAbi.abi, getReadOnlyProvider());
}

export async function getLatestEthPriceReadOnly(): Promise<string | null> {
  try {
    const contract = getReadOnlyOracleContract();
    const answer = await contract.getLatestETHPrice();
    return formatUnits(answer, ETH_USD_FEED_DECIMALS);
  } catch (error) {
    console.error("Error inside getLatestEthPriceReadOnly service block:", error);
    return null;
  }
}
