import { expect } from "chai";
import hre from "hardhat";

// Step 8: NFT issuance policy. StakeVerseNFT.mint() remains uncapped,
// unlimited-per-address, and exclusively governance-controlled — no
// production Solidity was changed. See the Step 8 report for the full
// analysis, including a documented discrepancy between the README's
// "exclusive access / Sybil mitigation / programmed scarcity" claims and
// this contract's actual behavior, which is explicitly out of this step's
// scope to fix (it would require modifying Staking/DAO gating logic, both
// forbidden here).
describe("NFT Issuance Policy (Step 8)", function () {
  let ethers: any;

  const DAY = 24 * 3600;

  // NFT deployed DAO-owned directly, matching scripts/deploy.ts's final
  // ownership state (Step 4) — not transferred ad hoc mid-test.
  async function deployGoverned() {
    const connection = await hre.network.create();
    ethers = connection.ethers;

    const signers = await ethers.getSigners();
    const [deployer, holderA, holderB, outsider] = signers;

    const Token = await ethers.getContractFactory("StakeVerseToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();

    const DAO = await ethers.getContractFactory("StakeVerseDAO");
    const dao = await DAO.deploy(await token.getAddress(), deployer.address);
    await dao.waitForDeployment();
    const daoAddress = await dao.getAddress();

    const NFT = await ethers.getContractFactory("StakeVerseNFT");
    const nft = await NFT.deploy(daoAddress);
    await nft.waitForDeployment();

    // deployer retains the full initial SVT supply and self-delegates, so
    // it alone clears both proposalThreshold and quorum for every
    // proposal in this file — kept deliberately lean, no large test
    // framework (Part 9).
    await token.connect(deployer).delegate(deployer.address);

    return {
      ethers,
      deployer,
      holderA,
      holderB,
      outsider,
      token,
      dao,
      nft,
      daoAddress,
    };
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  async function passAndExecuteNftMint(
    dao: any,
    nft: any,
    deployer: any,
    to: string
  ) {
    const calldata = nft.interface.encodeFunctionData("mint", [to]);
    await dao
      .connect(deployer)
      .createProposal("mint nft", DAY, await nft.getAddress(), 0, calldata);
    const proposalId = await dao.proposalCount();

    await dao.connect(deployer).vote(proposalId, true);
    await advanceTime(DAY + 1);
    await dao.connect(deployer).executeProposal(proposalId);

    return proposalId;
  }

  describe("initial state", function () {
    it("starts with nextTokenId == 0 (no tokens minted)", async function () {
      const { nft } = await deployGoverned();
      expect(await nft.nextTokenId()).to.equal(0n);
    });

    it("is owned by the DAO directly, matching the final deployment ownership state", async function () {
      const { nft, daoAddress } = await deployGoverned();
      expect(await nft.owner()).to.equal(daoAddress);
    });
  });

  describe("governance-gated minting (Part 5)", function () {
    it("the deployer cannot mint directly", async function () {
      const { deployer, nft } = await deployGoverned();
      await expect(nft.connect(deployer).mint(deployer.address)).to.be
        .rejected;
    });

    it("an unrelated outsider cannot mint directly", async function () {
      const { outsider, nft } = await deployGoverned();
      await expect(nft.connect(outsider).mint(outsider.address)).to.be
        .rejected;
    });

    it("the DAO can mint through a real governance proposal", async function () {
      const { deployer, holderA, nft, dao } = await deployGoverned();

      await expect(
        passAndExecuteNftMint(dao, nft, deployer, holderA.address)
      ).to.not.be.rejected;

      expect(await nft.balanceOf(holderA.address)).to.equal(1n);
      expect(await nft.ownerOf(0)).to.equal(holderA.address);
    });
  });

  describe("token ID safety (Part 4)", function () {
    it("token IDs increment strictly sequentially across governance mints, with no collisions or overwrites", async function () {
      const { deployer, holderA, holderB, nft, dao } = await deployGoverned();

      await passAndExecuteNftMint(dao, nft, deployer, holderA.address);
      await passAndExecuteNftMint(dao, nft, deployer, holderB.address);
      await passAndExecuteNftMint(dao, nft, deployer, holderA.address);

      expect(await nft.nextTokenId()).to.equal(3n);
      expect(await nft.ownerOf(0)).to.equal(holderA.address);
      expect(await nft.ownerOf(1)).to.equal(holderB.address);
      expect(await nft.ownerOf(2)).to.equal(holderA.address);
      expect(await nft.balanceOf(holderA.address)).to.equal(2n);
      expect(await nft.balanceOf(holderB.address)).to.equal(1n);

      // nextTokenId is a plain uint256, monotonically incremented once per
      // successful mint from a freshly deployed contract — the ID space is
      // used exactly once, sequentially, by construction. Solidity 0.8's
      // checked arithmetic would revert nextTokenId++ on overflow, which
      // would require ~2^256 prior mints — not reachable by any real
      // sequence of transactions, so no dedicated overflow test is
      // meaningful here (Part 4: "do not add unnecessary counter
      // abstractions").
    });
  });

  describe("unlimited, multi-mint-per-address issuance (deliberate policy, Option A)", function () {
    it("governance can mint multiple NFTs to the SAME address across separate proposals — deliberate, and every mint independently gated by governance", async function () {
      const { deployer, holderA, nft, dao } = await deployGoverned();

      await passAndExecuteNftMint(dao, nft, deployer, holderA.address);
      await passAndExecuteNftMint(dao, nft, deployer, holderA.address);
      await passAndExecuteNftMint(dao, nft, deployer, holderA.address);

      expect(await nft.balanceOf(holderA.address)).to.equal(3n);
      expect(await nft.ownerOf(0)).to.equal(holderA.address);
      expect(await nft.ownerOf(1)).to.equal(holderA.address);
      expect(await nft.ownerOf(2)).to.equal(holderA.address);

      // Each of those three mints required its own independently
      // successful governance proposal — there is no bulk-mint call that
      // bypasses the per-mint governance gate.
      expect(await dao.proposalCount()).to.equal(3n);
    });

    it("there is no supply cap: repeated governance mints keep succeeding with no ceiling", async function () {
      const { deployer, holderA, nft, dao } = await deployGoverned();

      for (let i = 0; i < 10; i++) {
        await passAndExecuteNftMint(dao, nft, deployer, holderA.address);
      }

      expect(await nft.nextTokenId()).to.equal(10n);
      expect(await nft.balanceOf(holderA.address)).to.equal(10n);
    });
  });
});
