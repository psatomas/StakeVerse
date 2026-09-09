import { expect } from "chai";
import hre from "hardhat";

// Step 3C: end-to-end governance and ownership-readiness verification.
//
// This file is deliberately self-contained (its own fresh deployments per
// test) rather than relying on dao.test.ts's fixtures, so it can freely do
// things — like transferring ownership of governed contracts to the DAO —
// that must NEVER touch the production deployment. Nothing here modifies
// scripts/deploy.ts or any real ownership; every transferOwnership call
// below is scoped to a contract instance deployed fresh inside that one
// test's isolated Hardhat network.
describe("Governance Integration & Ownership Readiness (Step 3C)", function () {
  let ethers: any;

  const DAY = 24 * 3600;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const NO_DATA = "0x";

  async function deployBase() {
    const connection = await hre.network.create();
    ethers = connection.ethers;

    const signers = await ethers.getSigners();
    const [owner, proposer, voter2, voter3, executor, outsider] = signers;

    const Token = await ethers.getContractFactory("StakeVerseToken");
    const token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const DAO = await ethers.getContractFactory("StakeVerseDAO");
    const dao = await DAO.deploy(await token.getAddress(), owner.address);
    await dao.waitForDeployment();

    const Staking = await ethers.getContractFactory("StakeVerseStaking");
    const staking = await Staking.deploy(await token.getAddress(), owner.address);
    await staking.waitForDeployment();

    const NFT = await ethers.getContractFactory("StakeVerseNFT");
    const nft = await NFT.deploy(owner.address);
    await nft.waitForDeployment();

    return {
      ethers,
      owner,
      proposer,
      voter2,
      voter3,
      executor,
      outsider,
      token,
      dao,
      staking,
      nft,
    };
  }

  async function delegateSelf(token: any, signer: any) {
    await token.connect(signer).delegate(signer.address);
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  async function blockTimestampOf(txResponse: any): Promise<bigint> {
    const receipt = await txResponse.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    return BigInt(block.timestamp);
  }

  // ---------------------------------------------------------------------
  // Part 1: end-to-end governance flow (steps 1-16 of the brief, in order)
  // ---------------------------------------------------------------------
  describe("Part 1: end-to-end governance flow", function () {
    it("delegate -> threshold -> propose -> snapshot -> vote -> quorum -> succeed -> execute -> executed -> no replay", async function () {
      const { owner, proposer, voter2, voter3, executor, token, dao, staking } =
        await deployBase();

      // 2. Distribute governance tokens to multiple test accounts.
      await token.transfer(proposer.address, ethers.parseEther("1500")); // > 1,000 threshold
      await token.transfer(voter2.address, ethers.parseEther("500"));
      await token.transfer(voter3.address, ethers.parseEther("2500"));
      // owner retains ~995,500 of the 1,000,000 supply.
      // executor deliberately receives NOTHING — execution must not require
      // any voting power at all.
      expect(await token.balanceOf(executor.address)).to.equal(0n);

      // 3. Have the accounts explicitly delegate voting power.
      await delegateSelf(token, owner);
      await delegateSelf(token, proposer);
      await delegateSelf(token, voter2);
      // voter3 deliberately does NOT vote later, to prove voting is
      // optional and doesn't block the flow — delegate anyway so the
      // eligibility math below is exercised for a non-voting holder too.
      await delegateSelf(token, voter3);

      // 4. Verify delegated voting power (current, via getVotes — not
      // balanceOf).
      expect(await token.getVotes(proposer.address)).to.equal(
        ethers.parseEther("1500")
      );
      expect(await token.getVotes(voter2.address)).to.equal(
        ethers.parseEther("500")
      );

      // 5. Verify proposal-threshold eligibility.
      const threshold = await dao.proposalThreshold();
      expect(await token.getVotes(proposer.address)).to.be.gte(threshold);
      expect(await token.getVotes(voter2.address)).to.be.lt(threshold);

      // 6. Create a proposal from a NON-OWNER eligible account, targeting a
      // real governed contract (requires local ownership transfer, scoped
      // to this isolated test only).
      await staking.connect(owner).transferOwnership(await dao.getAddress());

      const newRate = 42n;
      const calldata = staking.interface.encodeFunctionData("setRewardRate", [
        newRate,
      ]);

      const createTx = await dao
        .connect(proposer)
        .createProposal(
          "Raise staking APR to 42%",
          3 * DAY,
          await staking.getAddress(),
          0,
          calldata
        );
      const createdAt = await blockTimestampOf(createTx);

      // 7. Verify the proposal snapshot.
      const proposal = await dao.getProposal(1);
      expect(proposal.snapshotTimestamp).to.equal(createdAt - 1n);
      expect(await dao.state(1)).to.equal(0n); // Active

      // 8. Vote from multiple accounts (mixed support; voter3 abstains by
      // never calling vote() at all).
      await dao.connect(owner).vote(1, true);
      await dao.connect(proposer).vote(1, true);
      await dao.connect(voter2).vote(1, false);

      // 9. Verify historical voting power is used: the recorded tallies
      // must equal the SUM of each voter's getPastVotes at the proposal's
      // own snapshot, computed independently here — not balanceOf, not
      // live getVotes.
      const ownerHistPower = await token.getPastVotes(
        owner.address,
        proposal.snapshotTimestamp
      );
      const proposerHistPower = await token.getPastVotes(
        proposer.address,
        proposal.snapshotTimestamp
      );
      const voter2HistPower = await token.getPastVotes(
        voter2.address,
        proposal.snapshotTimestamp
      );

      const afterVotes = await dao.getProposal(1);
      expect(afterVotes.yesVotes).to.equal(ownerHistPower + proposerHistPower);
      expect(afterVotes.noVotes).to.equal(voter2HistPower);

      // 10. Verify quorum.
      expect(await dao.quorumReached(1)).to.equal(true);

      // 11. Advance time beyond the voting deadline.
      await advanceTime(3 * DAY + 1);

      // 12. Verify the proposal becomes Succeeded.
      expect(await dao.state(1)).to.equal(2n); // Succeeded

      // 13. Execute the proposal from a THIRD-PARTY account (zero tokens,
      // never voted, never delegated meaningfully — proves execution is
      // permissionless and requires no voting power).
      await dao.connect(executor).executeProposal(1);

      // 14. Verify the target contract's state changed exactly as
      // specified.
      expect(await staking.rewardRate()).to.equal(newRate);

      // 15. Verify the proposal becomes Executed.
      expect(await dao.state(1)).to.equal(3n); // Executed

      // 16. Verify a second execution attempt fails.
      await expect(
        dao.connect(executor).executeProposal(1)
      ).to.be.rejectedWith("Proposal not executable");
      // And the target was not called twice.
      expect(await staking.rewardRate()).to.equal(newRate);
    });
  });

  // ---------------------------------------------------------------------
  // Part 2: governance failure paths
  // ---------------------------------------------------------------------
  describe("Part 2: governance failure paths", function () {
    it("proposal creation below threshold fails end-to-end", async function () {
      const { proposer, token, dao } = await deployBase();
      await token.transfer(proposer.address, ethers.parseEther("500")); // < 1,000
      await delegateSelf(token, proposer);

      await expect(
        dao.connect(proposer).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");
    });

    it("no delegation: holding tokens alone satisfies neither the threshold nor voting", async function () {
      const { owner, proposer, token, dao } = await deployBase();
      await token.transfer(proposer.address, ethers.parseEther("50000")); // well above threshold, undelegated

      await expect(
        dao.connect(proposer).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");

      // Even a proposal that DOES exist (owner-created after delegating)
      // can't be voted on by the undelegated holder.
      await delegateSelf(token, owner);
      await dao.connect(owner).createProposal("p2", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await expect(
        dao.connect(proposer).vote(1, true)
      ).to.be.rejectedWith("No governance voting power");
    });

    it("insufficient quorum: passes majority but still Failed", async function () {
      const { owner, proposer, token, dao } = await deployBase();
      await token.transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, proposer);
      // owner deliberately does NOT vote, so participation stays far below
      // the 10% quorum of the 1,000,000 total supply.

      await dao.connect(proposer).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(proposer).vote(1, true); // unanimous among voters, still tiny

      await advanceTime(DAY + 1);

      expect(await dao.quorumReached(1)).to.equal(false);
      expect(await dao.state(1)).to.equal(1n); // Failed
      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });

    it("failed majority: quorum met, but noVotes >= yesVotes", async function () {
      const { owner, proposer, token, dao } = await deployBase();
      await token.transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, owner); // big holder
      await delegateSelf(token, proposer);

      await dao.connect(proposer).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, false); // big holder votes NO
      await dao.connect(proposer).vote(1, true);

      await advanceTime(DAY + 1);

      expect(await dao.quorumReached(1)).to.equal(true);
      expect(await dao.state(1)).to.equal(1n); // Failed
    });

    it("tie (yesVotes == noVotes) fails", async function () {
      const { owner, proposer, token, dao } = await deployBase();
      // Split evenly: owner keeps 500,000, proposer gets 500,000.
      await token.transfer(proposer.address, ethers.parseEther("500000"));
      await delegateSelf(token, owner);
      await delegateSelf(token, proposer);

      await dao.connect(proposer).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);
      await dao.connect(proposer).vote(1, false);

      const p = await dao.getProposal(1);
      expect(p.yesVotes).to.equal(p.noVotes);

      await advanceTime(DAY + 1);
      expect(await dao.state(1)).to.equal(1n); // Failed
    });

    it("vote after deadline reverts", async function () {
      const { owner, token, dao } = await deployBase();
      await delegateSelf(token, owner);
      await dao.connect(owner).createProposal("p", 10, ZERO_ADDRESS, 0, NO_DATA);
      await advanceTime(20);

      await expect(dao.connect(owner).vote(1, true)).to.be.rejectedWith(
        "Voting period ended"
      );
    });

    it("double vote on the same proposal reverts", async function () {
      const { owner, token, dao } = await deployBase();
      await delegateSelf(token, owner);
      await dao.connect(owner).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);

      await expect(dao.connect(owner).vote(1, true)).to.be.rejectedWith(
        "Already voted"
      );
    });

    it("invalid target: a plain EOA address as target executes as a silent no-op, not a revert", async function () {
      // Documents real EVM behavior rather than asserting a defect: a
      // low-level .call() against an address with no contract code always
      // "succeeds" trivially, regardless of the calldata supplied. The DAO
      // has no way to distinguish "EOA" from "contract" at proposal-
      // creation time, and does not attempt to (see Part 5 analysis).
      const { owner, executor, token, dao } = await deployBase();
      await delegateSelf(token, owner);

      const eoaTarget = executor.address; // a plain wallet, no contract code
      const fakeCalldata = "0x12345678";

      await dao
        .connect(owner)
        .createProposal("call an EOA", DAY, eoaTarget, 0, fakeCalldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      // Executes without reverting — a no-op against the EOA.
      await expect(dao.executeProposal(1)).to.not.be.rejected;
      expect(await dao.state(1)).to.equal(3n); // Executed
    });

    it("invalid calldata: an unrecognized selector against a real contract with no fallback reverts safely and remains retryable", async function () {
      const { owner, token, dao, staking } = await deployBase();
      await staking.connect(owner).transferOwnership(await dao.getAddress());
      await delegateSelf(token, owner);

      // StakeVerseStaking has neither a fallback nor a receive() function,
      // so an unrecognized 4-byte selector must revert.
      const bogusCalldata = "0xdeadbeef";

      await dao
        .connect(owner)
        .createProposal("garbage calldata", DAY, await staking.getAddress(), 0, bogusCalldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );

      // Retryable: state reverted to Succeeded, not burned as Executed.
      const proposal = await dao.getProposal(1);
      expect(proposal.executed).to.equal(false);
      expect(await dao.state(1)).to.equal(2n);

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );
    });

    it("target execution revert / retry after failed execution / execution replay, chained", async function () {
      const { owner, token, dao } = await deployBase();

      const MockTarget = await ethers.getContractFactory("MockGovernanceTarget");
      const mockTarget = await MockTarget.deploy();
      await mockTarget.waitForDeployment();

      await delegateSelf(token, owner);

      const revertCalldata = mockTarget.interface.encodeFunctionData(
        "alwaysReverts",
        []
      );

      await dao
        .connect(owner)
        .createProposal(
          "will fail",
          DAY,
          await mockTarget.getAddress(),
          0,
          revertCalldata
        );
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      // Revert on execution.
      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );

      // Retry after failed execution: still Succeeded.
      expect(await dao.state(1)).to.equal(2n);
      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );

      // A second, independent proposal targeting a WORKING call succeeds
      // and then correctly rejects replay.
      const okCalldata = mockTarget.interface.encodeFunctionData("setValue", [
        7,
      ]);
      await dao
        .connect(owner)
        .createProposal(
          "will succeed",
          DAY,
          await mockTarget.getAddress(),
          0,
          okCalldata
        );
      await dao.connect(owner).vote(2, true);
      await advanceTime(DAY + 1);

      await dao.executeProposal(2);
      expect(await mockTarget.value()).to.equal(7n);

      await expect(dao.executeProposal(2)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });

    it("unauthorized administrative actions: non-owner cannot call any onlyOwner function on any governed contract", async function () {
      const { owner, outsider, token, staking, nft, dao } = await deployBase();

      await expect(
        token.connect(outsider).mint(outsider.address, 1)
      ).to.be.rejected;
      await expect(staking.connect(outsider).setRewardRate(1)).to.be.rejected;
      await expect(
        staking
          .connect(outsider)
          .fundRewards(ethers.parseEther("1"))
      ).to.be.rejected;
      await expect(
        nft.connect(outsider).mint(outsider.address)
      ).to.be.rejected;
      await expect(
        dao.connect(outsider).setQuorumNumerator(50)
      ).to.be.rejected;
      await expect(
        dao.connect(outsider).setProposalThreshold(0)
      ).to.be.rejected;

      // Confirm the legitimate owner path is unaffected by these rejections
      // (sanity: the reverts above are access-control, not a broken
      // contract).
      await token.connect(owner).mint(owner.address, 1);
    });
  });

  // ---------------------------------------------------------------------
  // Part 3: ownership-readiness (isolated tests only — production
  // deployment ownership is never touched anywhere in this file)
  // ---------------------------------------------------------------------
  describe("Part 3: ownership readiness", function () {
    it("StakeVerseToken: DAO can execute mint() through governance once it owns the token; deployer cannot call it directly afterward", async function () {
      const { owner, executor, token, dao } = await deployBase();

      await token.connect(owner).transferOwnership(await dao.getAddress());
      expect(await token.owner()).to.equal(await dao.getAddress());

      // Deployer loses administrative authority.
      await expect(
        token.connect(owner).mint(owner.address, ethers.parseEther("1"))
      ).to.be.rejected;

      await delegateSelf(token, owner);

      const mintAmount = ethers.parseEther("10000");
      const calldata = token.interface.encodeFunctionData("mint", [
        executor.address,
        mintAmount,
      ]);

      await dao
        .connect(owner)
        .createProposal("mint via governance", DAY, await token.getAddress(), 0, calldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      const before = await token.balanceOf(executor.address);
      await dao.connect(executor).executeProposal(1);
      const after = await token.balanceOf(executor.address);

      expect(after - before).to.equal(mintAmount);
      expect(await dao.state(1)).to.equal(3n); // Executed
    });

    it("StakeVerseStaking: DAO can execute setRewardRate() and, composed with owning Token too, fundRewards(); deployer is blocked from both directly", async function () {
      const { owner, token, dao, staking } = await deployBase();

      await staking.connect(owner).transferOwnership(await dao.getAddress());
      // Token ownership also moves to the DAO here so the DAO can mint
      // itself a treasury balance and approve Staking to pull from it —
      // see the Part 5 write-up on what fundRewards-via-governance
      // actually requires (the DAO must hold and approve tokens; there is
      // no separate treasury mechanism).
      await token.connect(owner).transferOwnership(await dao.getAddress());

      expect(await staking.owner()).to.equal(await dao.getAddress());
      expect(await token.owner()).to.equal(await dao.getAddress());

      // Deployer loses administrative authority on both.
      await expect(staking.connect(owner).setRewardRate(99)).to.be.rejected;
      await expect(
        staking.connect(owner).fundRewards(ethers.parseEther("1"))
      ).to.be.rejected;

      await delegateSelf(token, owner);

      // --- Proposal 1: setRewardRate ---
      const newRate = 33n;
      const rateCalldata = staking.interface.encodeFunctionData(
        "setRewardRate",
        [newRate]
      );
      await dao
        .connect(owner)
        .createProposal(
          "set reward rate",
          DAY,
          await staking.getAddress(),
          0,
          rateCalldata
        );
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);
      await dao.executeProposal(1);
      expect(await staking.rewardRate()).to.equal(newRate);

      // --- Proposal 2: mint the DAO itself a treasury balance ---
      // (Token ownership already moved to the DAO above — this proves DAO
      // "calling Token" composes with DAO "calling Staking" below.)
      const fundAmount = ethers.parseEther("5000");
      const mintCalldata = token.interface.encodeFunctionData("mint", [
        await dao.getAddress(),
        fundAmount,
      ]);
      await dao
        .connect(owner)
        .createProposal(
          "mint DAO treasury",
          DAY,
          await token.getAddress(),
          0,
          mintCalldata
        );
      await dao.connect(owner).vote(2, true);
      await advanceTime(DAY + 1);
      await dao.executeProposal(2);
      expect(await token.balanceOf(await dao.getAddress())).to.equal(
        fundAmount
      );

      // --- Proposal 3: DAO approves Staking to pull from its own balance ---
      const approveCalldata = token.interface.encodeFunctionData("approve", [
        await staking.getAddress(),
        fundAmount,
      ]);
      await dao
        .connect(owner)
        .createProposal(
          "approve staking",
          DAY,
          await token.getAddress(),
          0,
          approveCalldata
        );
      await dao.connect(owner).vote(3, true);
      await advanceTime(DAY + 1);
      await dao.executeProposal(3);
      expect(
        await token.allowance(await dao.getAddress(), await staking.getAddress())
      ).to.equal(fundAmount);

      // --- Proposal 4: fundRewards, now that the DAO holds + approved ---
      const fundCalldata = staking.interface.encodeFunctionData(
        "fundRewards",
        [fundAmount]
      );
      await dao
        .connect(owner)
        .createProposal(
          "fund staking rewards",
          DAY,
          await staking.getAddress(),
          0,
          fundCalldata
        );
      await dao.connect(owner).vote(4, true);
      await advanceTime(DAY + 1);
      await dao.executeProposal(4);

      expect(await staking.rewardReserve()).to.equal(fundAmount);
      expect(await token.balanceOf(await dao.getAddress())).to.equal(0n);
    });

    it("StakeVerseNFT: DAO can execute mint() through governance; deployer cannot call it directly afterward", async function () {
      const { owner, executor, token, dao, nft } = await deployBase();

      // mint(address) is the only onlyOwner administrative function on
      // StakeVerseNFT.
      await nft.connect(owner).transferOwnership(await dao.getAddress());
      expect(await nft.owner()).to.equal(await dao.getAddress());

      await expect(nft.connect(owner).mint(owner.address)).to.be.rejected;

      await delegateSelf(token, owner);

      const calldata = nft.interface.encodeFunctionData("mint", [
        executor.address,
      ]);
      await dao
        .connect(owner)
        .createProposal("mint membership NFT", DAY, await nft.getAddress(), 0, calldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);
      await dao.executeProposal(1);

      expect(await nft.balanceOf(executor.address)).to.equal(1n);
      expect(await nft.ownerOf(0)).to.equal(executor.address);
    });

    it("StakeVerseDAO self-ownership: admin setters require governance, but every non-owner-gated function (createProposal, vote, executeProposal, state, quorumReached) remains fully usable", async function () {
      const { owner, proposer, token, dao } = await deployBase();

      await dao.connect(owner).transferOwnership(await dao.getAddress());
      expect(await dao.owner()).to.equal(await dao.getAddress());

      // Deployer loses the two onlyOwner admin setters.
      await expect(dao.connect(owner).setQuorumNumerator(50)).to.be.rejected;
      await expect(dao.connect(owner).setProposalThreshold(0)).to.be.rejected;

      // createProposal is NOT onlyOwner (Step 3A) — a non-owner, eligible
      // holder can still create proposals with the DAO owning itself.
      await token.transfer(proposer.address, ethers.parseEther("1500"));
      await delegateSelf(token, proposer);
      await delegateSelf(token, owner);

      await expect(
        dao.connect(proposer).createProposal("still works", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;

      // vote()/state()/quorumReached()/getProposal() never had an owner
      // gate and remain callable by anyone.
      await expect(dao.connect(owner).vote(1, true)).to.not.be.rejected;
      expect(await dao.state(1)).to.not.be.undefined;
      expect(await dao.quorumReached(1)).to.not.be.undefined;

      // DAO calling itself: the ONLY way to change quorumNumerator now is
      // a self-targeting proposal.
      const newNumerator = 25n;
      const selfCalldata = dao.interface.encodeFunctionData(
        "setQuorumNumerator",
        [newNumerator]
      );
      await dao
        .connect(proposer)
        .createProposal(
          "DAO adjusts its own quorum",
          DAY,
          await dao.getAddress(),
          0,
          selfCalldata
        );
      await dao.connect(owner).vote(2, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(2)).to.equal(2n); // Succeeded
      await dao.executeProposal(2);

      expect(await dao.quorumNumerator()).to.equal(newNumerator);
      expect(await dao.state(2)).to.equal(3n); // Executed

      // No critical function became unusable: executeProposal, vote, and
      // createProposal all still work after self-ownership AND after a
      // successful self-call.
      await dao
        .connect(proposer)
        .createProposal("still works after self-call", DAY, ZERO_ADDRESS, 0, NO_DATA);
      expect(await dao.state(3)).to.equal(0n); // Active
    });
  });
});
