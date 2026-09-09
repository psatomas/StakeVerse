import { expect } from "chai";
import hre from "hardhat";

// Step 7: token monetary policy. StakeVerseToken.mint() is intentionally
// uncapped and exclusively governance-controlled (see the Step 7 report for
// the full policy analysis — Option B was selected as the policy actually
// consistent with this MVP's existing, already-tested design, not chosen
// for security aesthetics). No production Solidity was changed for this
// step. These tests prove the two properties that make that policy safe:
//   1. minting is reachable ONLY through real DAO governance, never the
//      deployer or any other account directly;
//   2. newly minted + delegated voting power can never retroactively
//      affect a proposal whose snapshot already predates it — the same
//      historical-checkpoint guarantee already proven for plain transfers
//      in Steps 2/3A, proven here specifically for mint.
describe("Token Monetary Policy (Step 7)", function () {
  let ethers: any;

  const DAY = 24 * 3600;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const NO_DATA = "0x";
  const INITIAL_SUPPLY = 1_000_000n * 10n ** 18n;

  // Token owned by the DAO, mirroring scripts/deploy.ts's final ownership
  // state. `deployer` retains and self-delegates the full initial supply,
  // so it alone can clear both proposalThreshold and quorum throughout
  // this file without needing extra funded accounts — this file is
  // intentionally lean (Part 12: "do not build a complete economic
  // simulation").
  async function deployGoverned() {
    const connection = await hre.network.create();
    ethers = connection.ethers;

    const signers = await ethers.getSigners();
    const [deployer, recipient, outsider] = signers;

    const Token = await ethers.getContractFactory("StakeVerseToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();

    const DAO = await ethers.getContractFactory("StakeVerseDAO");
    const dao = await DAO.deploy(await token.getAddress(), deployer.address);
    await dao.waitForDeployment();
    const daoAddress = await dao.getAddress();

    await token.connect(deployer).transferOwnership(daoAddress);
    await token.connect(deployer).delegate(deployer.address);

    return { ethers, deployer, recipient, outsider, token, dao, daoAddress };
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  // Creates, votes, advances past the deadline, and executes a mint
  // proposal in one call. Returns the proposal id.
  async function passAndExecuteMint(
    dao: any,
    token: any,
    deployer: any,
    to: string,
    amount: bigint
  ) {
    const calldata = token.interface.encodeFunctionData("mint", [to, amount]);
    await dao
      .connect(deployer)
      .createProposal("mint", DAY, await token.getAddress(), 0, calldata);
    const proposalId = await dao.proposalCount();

    await dao.connect(deployer).vote(proposalId, true);
    await advanceTime(DAY + 1);
    await dao.connect(deployer).executeProposal(proposalId);

    return proposalId;
  }

  describe("supply", function () {
    it("initial supply is exactly INITIAL_SUPPLY", async function () {
      const { token } = await deployGoverned();
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("total supply after a governance mint increases by exactly the minted amount", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const mintAmount = ethers.parseEther("50000");
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);

      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
      expect(await token.balanceOf(recipient.address)).to.equal(mintAmount);
    });
  });

  describe("governance gating", function () {
    it("the deployer cannot call mint() directly", async function () {
      const { deployer, token } = await deployGoverned();

      await expect(token.connect(deployer).mint(deployer.address, 1)).to.be
        .rejected;
    });

    it("an unrelated outsider cannot call mint() directly", async function () {
      const { outsider, token } = await deployGoverned();

      await expect(
        token.connect(outsider).mint(outsider.address, ethers.parseEther("1"))
      ).to.be.rejected;
    });

    it("the DAO can mint through a real governance proposal", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const mintAmount = ethers.parseEther("25000");
      await expect(
        passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount)
      ).to.not.be.rejected;

      expect(await token.balanceOf(recipient.address)).to.equal(mintAmount);
    });
  });

  describe("ERC20Votes implications of minting", function () {
    it("minted tokens carry zero voting power until the recipient explicitly delegates (no auto-delegation)", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const mintAmount = ethers.parseEther("10000");
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);

      expect(await token.balanceOf(recipient.address)).to.equal(mintAmount);
      expect(await token.delegates(recipient.address)).to.equal(ZERO_ADDRESS);
      expect(await token.getVotes(recipient.address)).to.equal(0n);

      await token.connect(recipient).delegate(recipient.address);

      expect(await token.getVotes(recipient.address)).to.equal(mintAmount);
    });

    it("by contrast, minted + delegated voting power IS available for a proposal created after the mint", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const mintAmount = ethers.parseEther("2000"); // above default proposalThreshold
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);
      await token.connect(recipient).delegate(recipient.address);

      // recipient can now even CREATE a proposal itself, proving the
      // minted supply meaningfully participates in governance going
      // forward, not just "vote" narrowly.
      await expect(
        dao
          .connect(recipient)
          .createProposal("new proposer", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;

      const newId = await dao.proposalCount();
      await dao.connect(recipient).vote(newId, true);

      const proposal = await dao.getProposal(newId);
      expect(proposal.yesVotes).to.equal(mintAmount);
    });
  });

  describe("REGRESSION (Part 5): mint cannot retroactively affect an already-decided proposal", function () {
    it("newly minted + delegated voting power is invisible at a snapshot that predates the mint, and cannot join a proposal whose voting has already closed", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      // P1: created, voted, and fully executed BEFORE any mint exists.
      await dao
        .connect(deployer)
        .createProposal("already decided", DAY, ZERO_ADDRESS, 0, NO_DATA);
      const p1Id = await dao.proposalCount();
      const p1SnapshotBefore = (await dao.getProposal(p1Id)).snapshotTimestamp;

      await dao.connect(deployer).vote(p1Id, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(p1Id)).to.equal(2n); // Succeeded
      await dao.connect(deployer).executeProposal(p1Id);
      expect(await dao.state(p1Id)).to.equal(3n); // Executed

      const p1TallyBefore = await dao.getProposal(p1Id);

      // Now mint a LARGE amount to `recipient` — via a second, separate
      // governance proposal — and have recipient delegate to self. All of
      // this happens strictly after P1's snapshot, voting, and execution.
      const mintAmount = ethers.parseEther("500000");
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);
      await token.connect(recipient).delegate(recipient.address);

      // recipient genuinely has real, current voting power now...
      expect(await token.getVotes(recipient.address)).to.equal(mintAmount);

      // ...but at P1's OWN (already past) snapshot, recipient's historical
      // power is still exactly zero. The mint cannot retroactively grant
      // power for a timepoint that predates it.
      expect(
        await token.getPastVotes(recipient.address, p1SnapshotBefore)
      ).to.equal(0n);

      // P1's own recorded tally is completely unchanged.
      const p1TallyAfter = await dao.getProposal(p1Id);
      expect(p1TallyAfter.yesVotes).to.equal(p1TallyBefore.yesVotes);
      expect(p1TallyAfter.noVotes).to.equal(p1TallyBefore.noVotes);

      // And recipient cannot even attempt to join P1 anymore regardless —
      // voting closed at its deadline, independent of the mint. Two
      // independent, reinforcing protections: temporal (voting window
      // already closed) and historical (checkpoint predates the mint).
      await expect(dao.connect(recipient).vote(p1Id, true)).to.be.rejectedWith(
        "Voting period ended"
      );
    });
  });

  describe("quorum implications (Part 9)", function () {
    it("minting raises the absolute quorum requirement for proposals created afterward, but never for one already snapshotted", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const numerator = await dao.quorumNumerator();

      await dao
        .connect(deployer)
        .createProposal("before mint", DAY, ZERO_ADDRESS, 0, NO_DATA);
      const beforeId = await dao.proposalCount();
      const beforeSnapshot = (await dao.getProposal(beforeId)).snapshotTimestamp;
      const supplyAtBeforeSnapshot = await token.getPastTotalSupply(beforeSnapshot);
      const quorumBefore = (supplyAtBeforeSnapshot * numerator) / 100n;

      const mintAmount = ethers.parseEther("100000");
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);

      await dao
        .connect(deployer)
        .createProposal("after mint", DAY, ZERO_ADDRESS, 0, NO_DATA);
      const afterId = await dao.proposalCount();
      const afterSnapshot = (await dao.getProposal(afterId)).snapshotTimestamp;
      const supplyAtAfterSnapshot = await token.getPastTotalSupply(afterSnapshot);
      const quorumAfter = (supplyAtAfterSnapshot * numerator) / 100n;

      expect(supplyAtAfterSnapshot).to.equal(supplyAtBeforeSnapshot + mintAmount);
      expect(quorumAfter - quorumBefore).to.equal((mintAmount * numerator) / 100n);

      // The earlier proposal's own quorum requirement is untouched — its
      // snapshot is already fixed in the past.
      expect(await token.getPastTotalSupply(beforeSnapshot)).to.equal(
        supplyAtBeforeSnapshot
      );
    });
  });

  describe("staking interaction (Part 10)", function () {
    it("newly minted tokens can be staked immediately like any other SVT, without touching rewardReserve", async function () {
      const { deployer, recipient, token, dao } = await deployGoverned();

      const Staking = await ethers.getContractFactory("StakeVerseStaking");
      const staking = await Staking.deploy(
        await token.getAddress(),
        deployer.address
      );
      await staking.waitForDeployment();
      const stakingAddress = await staking.getAddress();

      const mintAmount = ethers.parseEther("1000");
      await passAndExecuteMint(dao, token, deployer, recipient.address, mintAmount);

      await token.connect(recipient).approve(stakingAddress, mintAmount);
      await staking.connect(recipient).stake(mintAmount);

      expect(await staking.stakedBalance(recipient.address)).to.equal(
        mintAmount
      );
      expect(await staking.totalStaked()).to.equal(mintAmount);
      // Minting and staking never touch rewardReserve — Step 1's
      // principal/reserve separation holds regardless of where the
      // principal's tokens originally came from.
      expect(await staking.rewardReserve()).to.equal(0n);
    });
  });
});
