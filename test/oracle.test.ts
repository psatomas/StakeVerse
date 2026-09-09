import { expect } from "chai";
import hre from "hardhat";

describe("PriceOracleConsumer", function () {
  let oracle: any;
  let mockFeed: any;
  let ethers: any;

  const INITIAL_ANSWER = 3000n * 10n ** 8n;

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  async function latestBlockTimestamp(): Promise<bigint> {
    const block = await ethers.provider.getBlock("latest");
    return BigInt(block.timestamp);
  }

  beforeEach(async function () {
    const connection = await hre.network.create();

    ethers = connection.ethers;

    const MockFeed =
      await ethers.getContractFactory(
        "MockV3Aggregator"
      );

    mockFeed =
      await MockFeed.deploy(
        INITIAL_ANSWER
      );

    await mockFeed.waitForDeployment();

    const Oracle =
      await ethers.getContractFactory(
        "PriceOracleConsumer"
      );

    oracle =
      await Oracle.deploy(
        await mockFeed.getAddress()
      );

    await oracle.waitForDeployment();
  });

  it("should deploy correctly", async function () {
    expect(
      await oracle.getAddress()
    ).to.not.equal(
      ethers.ZeroAddress
    );
  });

  it("should return latest ETH price", async function () {
    const price =
      await oracle.getLatestETHPrice();

    expect(price).to.not.equal(0);
  });

  it("should return positive ETH price value", async function () {
    const price =
      await oracle.getLatestETHPrice();

    expect(price).to.be.gt(0);
  });

  describe("valid data (baseline)", function () {
    it("returns exactly the feed's answer for a fresh, valid round", async function () {
      expect(await oracle.getLatestETHPrice()).to.equal(INITIAL_ANSWER);
    });

    it("does not scale or otherwise alter the raw feed answer (price units unchanged)", async function () {
      // Mirrors Part 8: no normalization was introduced — the returned
      // value is exactly the mock's configured answer, in the feed's own
      // 8-decimal units, exactly as the pre-hardening implementation
      // behaved for a valid round.
      const newAnswer = 1n * 10n ** 8n; // $1.00 at 8 decimals
      await mockFeed.setAnswer(newAnswer);
      expect(await oracle.getLatestETHPrice()).to.equal(newAnswer);
    });
  });

  describe("zero / negative price", function () {
    it("reverts when answer == 0", async function () {
      await mockFeed.setAnswer(0);
      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Invalid price"
      );
    });

    it("reverts when answer < 0", async function () {
      await mockFeed.setAnswer(-1);
      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Invalid price"
      );
    });
  });

  describe("updatedAt validation", function () {
    it("reverts when updatedAt == 0 (round not complete)", async function () {
      await mockFeed.setUpdatedAt(0);
      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Round not complete"
      );
    });

    it("reverts when updatedAt is in the future", async function () {
      const now = await latestBlockTimestamp();
      await mockFeed.setUpdatedAt(now + 1000n);

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Future update"
      );
    });
  });

  describe("staleness (MAX_ORACLE_AGE)", function () {
    it("documents the chosen freshness window", async function () {
      expect(await oracle.MAX_ORACLE_AGE()).to.equal(3n * 3600n); // 3 hours
    });

    it("reverts when block.timestamp - updatedAt > MAX_ORACLE_AGE", async function () {
      const maxAge = await oracle.MAX_ORACLE_AGE();

      // mockFeed's updatedAt was set to its own deployment block's
      // timestamp in its constructor — advance strictly past the window
      // relative to that fixed point using EVM time control, never
      // wall-clock time.
      await advanceTime(Number(maxAge) + 1);

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Stale price"
      );
    });

    it("boundary: accepts exactly block.timestamp - updatedAt == MAX_ORACLE_AGE", async function () {
      const maxAge = await oracle.MAX_ORACLE_AGE();

      // updatedAt is fixed at mockFeed's deployment block timestamp.
      // Advance EVM time so the NEXT mined block's timestamp lands exactly
      // updatedAt + MAX_ORACLE_AGE, then read the price against that exact
      // block — proving the boundary itself is accepted (the contract
      // uses <=, i.e. rejects only when the gap is strictly greater than
      // MAX_ORACLE_AGE).
      const deployReceipt = await (
        await mockFeed.deploymentTransaction()
      ).wait();
      const deployBlock = await ethers.provider.getBlock(
        deployReceipt.blockNumber
      );
      const updatedAt = BigInt(deployBlock.timestamp);

      const target = updatedAt + maxAge;
      const current = await latestBlockTimestamp();
      const delta = target - current;

      await advanceTime(Number(delta));
      expect(await latestBlockTimestamp()).to.equal(target);

      await expect(oracle.getLatestETHPrice()).to.not.be.rejected;
      expect(await oracle.getLatestETHPrice()).to.equal(INITIAL_ANSWER);
    });

    it("boundary + 1 second reverts as stale", async function () {
      const maxAge = await oracle.MAX_ORACLE_AGE();

      const deployReceipt = await (
        await mockFeed.deploymentTransaction()
      ).wait();
      const deployBlock = await ethers.provider.getBlock(
        deployReceipt.blockNumber
      );
      const updatedAt = BigInt(deployBlock.timestamp);

      const target = updatedAt + maxAge + 1n;
      const current = await latestBlockTimestamp();
      const delta = target - current;

      await advanceTime(Number(delta));

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Stale price"
      );
    });
  });

  describe("round validation", function () {
    it("reverts when roundId == 0", async function () {
      await mockFeed.setRoundId(0);
      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Invalid round"
      );
    });

    it("accepts when answeredInRound == roundId (the standard, expected relationship for modern OCR feeds)", async function () {
      await mockFeed.setRoundId(5);
      await mockFeed.setAnsweredInRound(5);

      await expect(oracle.getLatestETHPrice()).to.not.be.rejected;
    });

    it("reverts when answeredInRound < roundId", async function () {
      // Kept as a defense-in-depth check only — see the contract's
      // documentation on getLatestETHPrice(): modern Chainlink OCR
      // aggregators always report answeredInRound == roundId, so this
      // branch is not expected to fire against a real feed, but a
      // malformed/non-standard feed reporting an inconsistent round must
      // still be rejected rather than silently trusted.
      await mockFeed.setRoundId(5);
      await mockFeed.setAnsweredInRound(4);

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Stale round"
      );
    });
  });

  describe("consumer integration (Part 9)", function () {
    // PriceOracleConsumer is not currently consumed by any other contract
    // in this repository (verified by inspection — no Staking/DAO/Token/
    // NFT reference it, and the frontend's oracle.ts/useOracle.ts/
    // OracleCard.tsx are dead code, never rendered). Per the Step 5 brief,
    // that fact is documented here and the oracle contract itself is
    // exercised as its own "consumer" endpoint end-to-end below, rather
    // than inventing a synthetic consumer contract.
    it("a full valid round succeeds end-to-end through the real contract (not the mock in isolation)", async function () {
      await mockFeed.setRoundId(10);
      await mockFeed.setAnsweredInRound(10);
      await mockFeed.setAnswer(4200n * 10n ** 8n);
      await mockFeed.setUpdatedAt(await latestBlockTimestamp());

      expect(await oracle.getLatestETHPrice()).to.equal(4200n * 10n ** 8n);
    });

    it("a stale round reverts through the real contract", async function () {
      const maxAge = await oracle.MAX_ORACLE_AGE();
      await advanceTime(Number(maxAge) + 1);

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Stale price"
      );
    });

    it("an invalid (zero-price) round reverts through the real contract", async function () {
      await mockFeed.setAnswer(0);

      await expect(oracle.getLatestETHPrice()).to.be.rejectedWith(
        "Invalid price"
      );
    });
  });
});
