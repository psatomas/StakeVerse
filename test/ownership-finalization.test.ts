import { expect } from "chai";
import hre from "hardhat";

// Step 4: verifies the FINAL ownership state exactly as scripts/deploy.ts
// now produces it — Token, Staking, NFT, and the DAO itself all owned by
// the DAO from a single consistent deployment flow — rather than ownership
// being transferred ad hoc per-test as in Step 3C's isolated readiness
// checks. Nothing here touches the production Sepolia deployment; this is
// scripts/deploy.ts's exact sequence, reproduced against a fresh local
// Hardhat network per test.
describe("Ownership Finalization (Step 4)", function () {
  let ethers: any;

  const DAY = 24 * 3600;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const NO_DATA = "0x";

  // Mirrors scripts/deploy.ts's deployment order and constructor arguments
  // exactly: Token (deployer-owned, unavoidable) -> DAO (deployer-owned,
  // unavoidable) -> Staking (DAO-owned directly) -> NFT (DAO-owned
  // directly) -> Token.transferOwnership(DAO) -> DAO.transferOwnership(DAO).
  async function deployFinal() {
    const connection = await hre.network.create();
    ethers = connection.ethers;

    const signers = await ethers.getSigners();
    const [deployer, proposer, voter2, executor, outsider] = signers;

    const Token = await ethers.getContractFactory("StakeVerseToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();

    const DAO = await ethers.getContractFactory("StakeVerseDAO");
    const dao = await DAO.deploy(await token.getAddress(), deployer.address);
    await dao.waitForDeployment();
    const daoAddress = await dao.getAddress();

    const Staking = await ethers.getContractFactory("StakeVerseStaking");
    const staking = await Staking.deploy(await token.getAddress(), daoAddress);
    await staking.waitForDeployment();

    const NFT = await ethers.getContractFactory("StakeVerseNFT");
    const nft = await NFT.deploy(daoAddress);
    await nft.waitForDeployment();

    await token.connect(deployer).transferOwnership(daoAddress);
    await dao.connect(deployer).transferOwnership(daoAddress);

    return {
      ethers,
      deployer,
      proposer,
      voter2,
      executor,
      outsider,
      token,
      dao,
      staking,
      nft,
      daoAddress,
    };
  }

  async function delegateSelf(token: any, signer: any) {
    await token.connect(signer).delegate(signer.address);
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  // ---------------------------------------------------------------------
  // Part 3 + Part 7: the deployment produces exactly the intended final
  // ownership state.
  // ---------------------------------------------------------------------
  describe("Part 3 & 7: final ownership state", function () {
    it("every governed contract, and the DAO itself, is owned by the DAO", async function () {
      const { token, dao, staking, nft, daoAddress } = await deployFinal();

      expect(await token.owner()).to.equal(daoAddress);
      expect(await staking.owner()).to.equal(daoAddress);
      expect(await nft.owner()).to.equal(daoAddress);
      expect(await dao.owner()).to.equal(daoAddress);
    });

    it("the deployer retains no ownership anywhere post-deployment", async function () {
      const { deployer, token, dao, staking, nft } = await deployFinal();

      expect(await token.owner()).to.not.equal(deployer.address);
      expect(await staking.owner()).to.not.equal(deployer.address);
      expect(await nft.owner()).to.not.equal(deployer.address);
      expect(await dao.owner()).to.not.equal(deployer.address);
    });
  });

  // ---------------------------------------------------------------------
  // Part 5: deployer privilege removal — every onlyOwner function, on
  // every contract, tested as an actual authority boundary (not just an
  // owner() address check).
  // ---------------------------------------------------------------------
  describe("Part 5: deployer privilege removal (authority boundaries)", function () {
    it("StakeVerseToken: deployer cannot mint or transfer/renounce ownership directly", async function () {
      const { deployer, token, daoAddress } = await deployFinal();

      await expect(
        token.connect(deployer).mint(deployer.address, ethers.parseEther("1"))
      ).to.be.rejected;
      await expect(
        token.connect(deployer).transferOwnership(deployer.address)
      ).to.be.rejected;
      await expect(token.connect(deployer).renounceOwnership()).to.be.rejected;

      // Sanity: still actually owned by the DAO after the rejected attempts.
      expect(await token.owner()).to.equal(daoAddress);
    });

    it("StakeVerseStaking: deployer cannot setRewardRate, fundRewards, or transfer/renounce ownership directly", async function () {
      const { deployer, staking, daoAddress } = await deployFinal();

      await expect(staking.connect(deployer).setRewardRate(50)).to.be
        .rejected;
      await expect(
        staking.connect(deployer).fundRewards(ethers.parseEther("1"))
      ).to.be.rejected;
      await expect(
        staking.connect(deployer).transferOwnership(deployer.address)
      ).to.be.rejected;
      await expect(staking.connect(deployer).renounceOwnership()).to.be
        .rejected;

      expect(await staking.owner()).to.equal(daoAddress);
    });

    it("StakeVerseNFT: deployer cannot mint or transfer/renounce ownership directly", async function () {
      const { deployer, nft, daoAddress } = await deployFinal();

      await expect(nft.connect(deployer).mint(deployer.address)).to.be
        .rejected;
      await expect(
        nft.connect(deployer).transferOwnership(deployer.address)
      ).to.be.rejected;
      await expect(nft.connect(deployer).renounceOwnership()).to.be.rejected;

      expect(await nft.owner()).to.equal(daoAddress);
    });

    it("StakeVerseDAO: deployer cannot set quorum/threshold or transfer/renounce ownership directly", async function () {
      const { deployer, dao, daoAddress } = await deployFinal();

      await expect(dao.connect(deployer).setQuorumNumerator(50)).to.be
        .rejected;
      await expect(dao.connect(deployer).setProposalThreshold(0)).to.be
        .rejected;
      await expect(
        dao.connect(deployer).transferOwnership(deployer.address)
      ).to.be.rejected;
      await expect(dao.connect(deployer).renounceOwnership()).to.be.rejected;

      expect(await dao.owner()).to.equal(daoAddress);
    });

    it("createProposal remains permissionless (subject only to proposalThreshold), unaffected by DAO self-ownership", async function () {
      const { deployer, proposer, token, dao } = await deployFinal();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, proposer);

      await expect(
        dao
          .connect(proposer)
          .createProposal("still permissionless", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });
  });

  // ---------------------------------------------------------------------
  // Part 4: full governance regression against the FINAL ownership state,
  // using the real governed contracts (not mocks).
  // ---------------------------------------------------------------------
  describe("Part 4: full governance regression on the final ownership state", function () {
    it("distribute -> delegate -> threshold -> propose(non-owner) -> snapshot -> vote -> quorum -> majority -> execute(unrelated account) -> governed state changes -> Executed -> replay fails", async function () {
      const { deployer, proposer, voter2, executor, token, dao, staking } =
        await deployFinal();

      // 1. distribute tokens
      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await token.connect(deployer).transfer(voter2.address, ethers.parseEther("500"));
      expect(await token.balanceOf(executor.address)).to.equal(0n);

      // 2. delegate voting power
      await delegateSelf(token, deployer); // deployer still holds most supply, may vote (not administer)
      await delegateSelf(token, proposer);
      await delegateSelf(token, voter2);

      // 3. satisfy proposal threshold
      const threshold = await dao.proposalThreshold();
      expect(await token.getVotes(proposer.address)).to.be.gte(threshold);

      // 4. create proposal as a non-owner (the DAO owns itself; "owner" here
      // is irrelevant to proposal creation, which is never owner-gated —
      // proposer is simply an ordinary eligible holder).
      const newRate = 17n;
      const calldata = staking.interface.encodeFunctionData("setRewardRate", [
        newRate,
      ]);
      const createTx = await dao
        .connect(proposer)
        .createProposal(
          "final-ownership regression",
          3 * DAY,
          await staking.getAddress(),
          0,
          calldata
        );
      const receipt = await createTx.wait();
      const createdBlock = await ethers.provider.getBlock(receipt.blockNumber);

      // 5. verify historical snapshot
      const proposal = await dao.getProposal(1);
      expect(proposal.snapshotTimestamp).to.equal(
        BigInt(createdBlock.timestamp) - 1n
      );

      // 6. vote
      await dao.connect(deployer).vote(1, true);
      await dao.connect(proposer).vote(1, true);
      await dao.connect(voter2).vote(1, false);

      // 7. reach quorum
      expect(await dao.quorumReached(1)).to.equal(true);

      // 8. pass majority
      const afterVotes = await dao.getProposal(1);
      expect(afterVotes.yesVotes).to.be.gt(afterVotes.noVotes);

      // 9. advance beyond deadline
      await advanceTime(3 * DAY + 1);
      expect(await dao.state(1)).to.equal(2n); // Succeeded

      // 10. execute from an unrelated, zero-voting-power account
      await dao.connect(executor).executeProposal(1);

      // 11. verify governed state change
      expect(await staking.rewardRate()).to.equal(newRate);

      // 12. verify Executed
      expect(await dao.state(1)).to.equal(3n);

      // 13. verify replay fails
      await expect(
        dao.connect(executor).executeProposal(1)
      ).to.be.rejectedWith("Proposal not executable");
      expect(await staking.rewardRate()).to.equal(newRate); // unchanged by the replay attempt
    });
  });

  // ---------------------------------------------------------------------
  // Part 6: DAO self-ownership remains fully functional.
  // ---------------------------------------------------------------------
  describe("Part 6: DAO self-ownership functional checks", function () {
    it("quorum and proposal threshold can both be changed through governance, and create/vote/execute all keep working", async function () {
      const { deployer, proposer, token, dao, daoAddress } = await deployFinal();

      expect(await dao.owner()).to.equal(daoAddress);

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);

      // --- Change quorumNumerator via a self-targeting proposal ---
      const newQuorum = 20n;
      const quorumCalldata = dao.interface.encodeFunctionData(
        "setQuorumNumerator",
        [newQuorum]
      );
      await dao
        .connect(proposer)
        .createProposal("adjust quorum", DAY, daoAddress, 0, quorumCalldata);
      await dao.connect(deployer).vote(1, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(1)).to.equal(2n);
      await dao.connect(proposer).executeProposal(1);
      expect(await dao.quorumNumerator()).to.equal(newQuorum);

      // --- Change proposalThreshold via a self-targeting proposal ---
      const newThreshold = ethers.parseEther("2000");
      const thresholdCalldata = dao.interface.encodeFunctionData(
        "setProposalThreshold",
        [newThreshold]
      );
      await dao
        .connect(proposer)
        .createProposal(
          "adjust proposal threshold",
          DAY,
          daoAddress,
          0,
          thresholdCalldata
        );
      await dao.connect(deployer).vote(2, true);
      await advanceTime(DAY + 1);
      await dao.connect(proposer).executeProposal(2);
      expect(await dao.proposalThreshold()).to.equal(newThreshold);

      // --- No critical function became unusable: create/vote/execute all
      // still work after two rounds of DAO-calling-itself. ---
      await dao
        .connect(deployer) // deployer, as an ordinary eligible holder now
        .createProposal("still works", DAY, ZERO_ADDRESS, 0, NO_DATA);
      expect(await dao.state(3)).to.equal(0n); // Active
      await dao.connect(deployer).vote(3, true); // big holder, needed to clear the now-20% quorum
      await dao.connect(proposer).vote(3, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(3)).to.equal(2n); // Succeeded
      await dao.connect(proposer).executeProposal(3);
      expect(await dao.state(3)).to.equal(3n); // Executed
    });

    it("documents the accepted design consequence: an unreachable quorum, once self-governed, has no external override", async function () {
      const { deployer, proposer, voter2, token, dao, daoAddress } =
        await deployFinal();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      // voter2 deliberately holds tokens but never votes and never
      // delegates — this is what makes 100% participation genuinely
      // unreachable below, not merely unlikely.
      await token.connect(deployer).transfer(voter2.address, ethers.parseEther("100"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);

      // Push quorum to 100% of total supply through legitimate governance.
      const calldata = dao.interface.encodeFunctionData(
        "setQuorumNumerator",
        [100]
      );
      await dao
        .connect(proposer)
        .createProposal("push quorum to 100%", DAY, daoAddress, 0, calldata);
      await dao.connect(deployer).vote(1, true); // deployer alone is not 100% of supply
      await advanceTime(DAY + 1);
      await dao.connect(proposer).executeProposal(1);
      expect(await dao.quorumNumerator()).to.equal(100n);

      // Now nothing can pass unless literally every voting-unit of supply
      // participates — and there is no owner-only override left, because
      // the DAO owns itself and setQuorumNumerator is onlyOwner.
      await dao
        .connect(proposer)
        .createProposal("now nearly impossible", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(deployer).vote(2, true);
      await dao.connect(proposer).vote(2, true);
      await advanceTime(DAY + 1);

      // deployer + proposer do not hold 100% of supply (some remains
      // undelegated with other signers), so quorum is not met.
      expect(await dao.quorumReached(2)).to.equal(false);
      expect(await dao.state(2)).to.equal(1n); // Failed

      // The ONLY path back to a workable quorum is another proposal
      // lowering it again — which itself now needs 100% participation to
      // pass. No deployer/admin escape hatch exists; this is the accepted
      // MVP limitation, not a bug.
      const lowerCalldata = dao.interface.encodeFunctionData(
        "setQuorumNumerator",
        [10]
      );
      await expect(
        dao.connect(deployer).setQuorumNumerator(10)
      ).to.be.rejected; // deployer truly has no override
    });
  });

  // ---------------------------------------------------------------------
  // Step 6: emergency pause, proven against the FINAL ownership state —
  // Staking's onlyOwner is the DAO, so pause()/unpause() are exercised
  // exclusively through real governance proposals, executed by an
  // unrelated fourth-party account, never by direct owner impersonation.
  // ---------------------------------------------------------------------
  describe("Step 6: emergency pause via governance", function () {
    it("the deployer cannot pause staking directly, post-finalization", async function () {
      const { deployer, staking } = await deployFinal();

      expect(await staking.paused()).to.equal(false);

      await expect(staking.connect(deployer).pause()).to.be.rejected;
      expect(await staking.paused()).to.equal(false);
    });

    it("the deployer cannot unpause staking directly either, even once it is genuinely paused", async function () {
      const { deployer, proposer, executor, token, dao, staking } =
        await deployFinal();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);

      const pauseCalldata = staking.interface.encodeFunctionData("pause", []);
      await dao
        .connect(proposer)
        .createProposal("pause", DAY, await staking.getAddress(), 0, pauseCalldata);
      await dao.connect(deployer).vote(1, true);
      await advanceTime(DAY + 1);
      await dao.connect(executor).executeProposal(1);
      expect(await staking.paused()).to.equal(true);

      await expect(staking.connect(deployer).unpause()).to.be.rejected;
      expect(await staking.paused()).to.equal(true);
    });

    it("the DAO can pause staking through governance, executed by a fourth-party account with zero voting power", async function () {
      const { deployer, proposer, executor, token, dao, staking } =
        await deployFinal();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);

      const pauseCalldata = staking.interface.encodeFunctionData("pause", []);

      await dao
        .connect(proposer)
        .createProposal(
          "emergency pause staking",
          DAY,
          await staking.getAddress(),
          0,
          pauseCalldata
        );
      await dao.connect(deployer).vote(1, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(1)).to.equal(2n); // Succeeded

      expect(await staking.paused()).to.equal(false);

      // Executed by `executor`: unrelated, holds no tokens, never voted —
      // proves this is not owner impersonation in disguise.
      await dao.connect(executor).executeProposal(1);

      expect(await staking.paused()).to.equal(true);
    });

    it("the DAO can unpause staking through a second governance proposal, also executed by a fourth-party account", async function () {
      const { deployer, proposer, executor, token, dao, staking } =
        await deployFinal();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);

      const pauseCalldata = staking.interface.encodeFunctionData("pause", []);
      await dao
        .connect(proposer)
        .createProposal("pause", DAY, await staking.getAddress(), 0, pauseCalldata);
      await dao.connect(deployer).vote(1, true);
      await advanceTime(DAY + 1);
      await dao.connect(executor).executeProposal(1);
      expect(await staking.paused()).to.equal(true);

      const unpauseCalldata = staking.interface.encodeFunctionData(
        "unpause",
        []
      );
      await dao
        .connect(proposer)
        .createProposal(
          "unpause",
          DAY,
          await staking.getAddress(),
          0,
          unpauseCalldata
        );
      await dao.connect(deployer).vote(2, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(2)).to.equal(2n); // Succeeded

      await dao.connect(executor).executeProposal(2);

      expect(await staking.paused()).to.equal(false);
    });

    it("full incident-response cycle in the final ownership state: pause blocks new stake, principal stays withdrawable, governance remains operable, then unpause restores staking", async function () {
      const { deployer, proposer, voter2, executor, token, dao, staking } =
        await deployFinal();

      const stakingAddress = await staking.getAddress();

      await token.connect(deployer).transfer(proposer.address, ethers.parseEther("1500"));
      await token.connect(deployer).transfer(voter2.address, ethers.parseEther("1000"));
      await delegateSelf(token, deployer);
      await delegateSelf(token, proposer);
      await delegateSelf(token, voter2);

      // voter2 stakes BEFORE the pause, to prove principal stays
      // withdrawable throughout the incident.
      await token.connect(voter2).approve(stakingAddress, ethers.parseEther("1000"));
      await staking.connect(voter2).stake(ethers.parseEther("1000"));

      // --- Governance pauses staking ---
      const pauseCalldata = staking.interface.encodeFunctionData("pause", []);
      await dao
        .connect(proposer)
        .createProposal("pause for incident", DAY, stakingAddress, 0, pauseCalldata);
      await dao.connect(deployer).vote(1, true);
      await advanceTime(DAY + 1);
      await dao.connect(executor).executeProposal(1);
      expect(await staking.paused()).to.equal(true);

      // --- New deposits blocked ---
      await token.connect(proposer).approve(stakingAddress, ethers.parseEther("100"));
      await expect(
        staking.connect(proposer).stake(ethers.parseEther("100"))
      ).to.be.rejected;

      // --- Existing principal remains withdrawable during the incident ---
      await expect(
        staking.connect(voter2).unstake(ethers.parseEther("1000"))
      ).to.not.be.rejected;
      expect(await staking.stakedBalance(voter2.address)).to.equal(0n);

      // --- Governance itself remains fully operable while Staking is
      // paused (no lockout: creating/voting on a NEW proposal targeting
      // Staking again works normally) ---
      const unpauseCalldata = staking.interface.encodeFunctionData(
        "unpause",
        []
      );
      await dao
        .connect(proposer)
        .createProposal(
          "resolve incident",
          DAY,
          stakingAddress,
          0,
          unpauseCalldata
        );
      await dao.connect(deployer).vote(2, true);
      await advanceTime(DAY + 1);
      expect(await dao.state(2)).to.equal(2n); // Succeeded — governance was never blocked

      await dao.connect(executor).executeProposal(2);
      expect(await staking.paused()).to.equal(false);

      // --- Staking fully restored ---
      await expect(staking.connect(proposer).stake(ethers.parseEther("100")))
        .to.not.be.rejected;
      expect(await staking.stakedBalance(proposer.address)).to.equal(
        ethers.parseEther("100")
      );
    });
  });
});
