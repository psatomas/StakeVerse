import { ethers } from "ethers";
import hre from "hardhat";
import "dotenv/config";

async function main() {
  console.log("🚀 Deploying StakeVerse Protocol (governance-owned mode)\n");

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY!, provider);

  console.log("Deployer:", wallet.address);

  // Explicit, self-incrementing nonce for every transaction this script
  // sends. This deployment fires several sequential transactions from one
  // wallet (5 deployments + 2 ownership transfers); relying on the
  // provider/signer to re-derive "pending" nonce for each call independently
  // is a known source of nonce races against some JSON-RPC backends. Tracking
  // it explicitly here makes the whole sequence deterministic regardless of
  // what the RPC endpoint reports moment to moment.
  let nonce = await wallet.getNonce();
  const nextNonce = () => nonce++;

  // helper to get ABI + bytecode from Hardhat artifacts
  const loadArtifact = async (name: string) => {
    return await hre.artifacts.readArtifact(name);
  };

  // ---------------- TOKEN ----------------
  // Deployed with the deployer as initialOwner. This is unavoidable: the
  // DAO's own constructor needs this address, so the DAO cannot already own
  // it at this point. Ownership moves to the DAO explicitly below, once the
  // DAO exists.
  const tokenArtifact = await loadArtifact("StakeVerseToken");

  const TokenFactory = new ethers.ContractFactory(
    tokenArtifact.abi,
    tokenArtifact.bytecode,
    wallet
  );

  const Token = await TokenFactory.deploy(wallet.address, {
    nonce: nextNonce(),
  });
  await Token.waitForDeployment();

  const tokenAddress = await Token.getAddress();
  console.log("Token:", tokenAddress);

  // ---------------- DAO ----------------
  // Deployed right after Token — its only constructor dependency — and
  // deliberately BEFORE Staking/NFT below, so that Staking and NFT can be
  // constructed with the DAO's address as their initialOwner directly, with
  // no post-deploy transfer needed for either. The DAO itself still starts
  // owned by the deployer: a contract cannot be handed ownership of itself
  // before it exists on-chain, so that one transfer (below) is unavoidable.
  const daoArtifact = await loadArtifact("StakeVerseDAO");

  const DAOFactory = new ethers.ContractFactory(
    daoArtifact.abi,
    daoArtifact.bytecode,
    wallet
  );

  const DAO = await DAOFactory.deploy(tokenAddress, wallet.address, {
    nonce: nextNonce(),
  });
  await DAO.waitForDeployment();

  const daoAddress = await DAO.getAddress();
  console.log("DAO:", daoAddress);

  // ---------------- STAKING ----------------
  // Constructed with the DAO as initialOwner directly — deterministic, no
  // post-deploy ownership transfer required.
  const stakingArtifact = await loadArtifact("StakeVerseStaking");

  const StakingFactory = new ethers.ContractFactory(
    stakingArtifact.abi,
    stakingArtifact.bytecode,
    wallet
  );

  const Staking = await StakingFactory.deploy(tokenAddress, daoAddress, {
    nonce: nextNonce(),
  });
  await Staking.waitForDeployment();

  const stakingAddress = await Staking.getAddress();
  console.log("Staking:", stakingAddress);

  // ---------------- NFT ----------------
  // Same: constructed with the DAO as initialOwner directly.
  const nftArtifact = await loadArtifact("StakeVerseNFT");

  const NFTFactory = new ethers.ContractFactory(
    nftArtifact.abi,
    nftArtifact.bytecode,
    wallet
  );

  const NFT = await NFTFactory.deploy(daoAddress, { nonce: nextNonce() });
  await NFT.waitForDeployment();

  const nftAddress = await NFT.getAddress();
  console.log("NFT:", nftAddress);

  // ---------------- ORACLE ----------------
  // Unchanged: PriceOracleConsumer has no Ownable/owner concept, so it is
  // outside this step's ownership-finalization scope.
  const oracleArtifact = await loadArtifact("PriceOracleConsumer");

  const OracleFactory = new ethers.ContractFactory(
    oracleArtifact.abi,
    oracleArtifact.bytecode,
    wallet
  );

  const Oracle = await OracleFactory.deploy(
    process.env.CHAINLINK_PRICE_FEED,
    { nonce: nextNonce() }
  );
  await Oracle.waitForDeployment();

  const oracleAddress = await Oracle.getAddress();
  console.log("Oracle:", oracleAddress);

  // ---------------- OWNERSHIP FINALIZATION ----------------
  // The only two ownership transfers that cannot be expressed as
  // constructor arguments, given the dependency ordering above:
  //   1. Token -> DAO  (Token necessarily predates the DAO)
  //   2. DAO   -> DAO  (a contract cannot own itself before it exists)
  console.log("\nFinalizing ownership...");

  const transferTokenTx = await Token.transferOwnership(daoAddress, {
    nonce: nextNonce(),
  });
  await transferTokenTx.wait();

  const transferDaoTx = await DAO.transferOwnership(daoAddress, {
    nonce: nextNonce(),
  });
  await transferDaoTx.wait();

  // ---------------- OWNERSHIP VERIFICATION ----------------
  // Deployment must fail loudly rather than silently produce a partially
  // decentralized deployment with the deployer still holding administrative
  // authority somewhere.
  const [tokenOwner, stakingOwner, nftOwner, daoOwner] = await Promise.all([
    Token.owner(),
    Staking.owner(),
    NFT.owner(),
    DAO.owner(),
  ]);

  const expectations: Array<[string, string, string]> = [
    ["Token", tokenOwner, daoAddress],
    ["Staking", stakingOwner, daoAddress],
    ["NFT", nftOwner, daoAddress],
    ["DAO", daoOwner, daoAddress],
  ];

  const failures = expectations.filter(
    ([, actual, expected]) => actual.toLowerCase() !== expected.toLowerCase()
  );

  if (failures.length > 0) {
    const details = failures
      .map(
        ([name, actual, expected]) =>
          `  - ${name}.owner() = ${actual}, expected ${expected}`
      )
      .join("\n");

    throw new Error(
      "Ownership finalization failed — deployment aborted rather than " +
        `left partially decentralized:\n${details}`
    );
  }

  console.log(
    "✅ Ownership finalized: the DAO governs Token, Staking, NFT, and itself.\n"
  );

  console.log("✅ DEPLOYMENT COMPLETE\n");

  console.log({
    tokenAddress,
    nftAddress,
    stakingAddress,
    daoAddress,
    oracleAddress,
    tokenOwner,
    stakingOwner,
    nftOwner,
    daoOwner,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
