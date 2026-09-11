import { Contract, formatUnits } from "ethers";

import oracleAbi from "./abis/PriceOracleConsumer.json";

import { CONTRACTS } from "./index";

import { getSigner } from "../services/web3";

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
