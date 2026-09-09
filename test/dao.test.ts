import { expect } from "chai";
import hre from "hardhat";

describe("StakeVerseDAO", function () {
  let token: any;
  let dao: any;
  let mockTarget: any;
  let owner: any;
  let user: any;
  let user2: any;
  let user3: any;
  let ethers: any;

  const DAY = 24 * 3600;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const NO_DATA = "0x";

  async function delegateSelf(signer: any) {
    await token.connect(signer).delegate(signer.address);
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async function () {
    const connection = await hre.network.create();

    ethers = connection.ethers;

    [owner, user, user2, user3] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("StakeVerseToken");
    token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const DAO = await ethers.getContractFactory("StakeVerseDAO");
    dao = await DAO.deploy(await token.getAddress(), owner.address);
    await dao.waitForDeployment();

    const MockTarget = await ethers.getContractFactory("MockGovernanceTarget");
    mockTarget = await MockTarget.deploy();
    await mockTarget.waitForDeployment();

    await token.transfer(user.address, ethers.parseEther("1000"));
    await token.transfer(user2.address, ethers.parseEther("1000"));
    await token.transfer(user3.address, ethers.parseEther("1000"));

    // Step 3A: createProposal() now requires the caller to independently
    // clear proposalThreshold via delegated voting power — it is no longer
    // onlyOwner. owner self-delegates here purely as shared test fixture
    // convenience (owner still holds ~997,000 tokens after the transfers
    // above, comfortably above the 1,000-token default threshold), NOT
    // because the contract grants owner any special path. The "no special
    // privilege" property itself is proven with a separate, undelegated
    // deployment in the "proposal threshold" describe block below.
    await delegateSelf(owner);
  });

  describe("proposal creation", function () {
    it("stores description/target/value/data and snapshots strictly in the past", async function () {
      const tx = await dao.createProposal(
        "Increase reward rate",
        DAY,
        ZERO_ADDRESS,
        0,
        NO_DATA
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const proposal = await dao.getProposal(1);

      expect(proposal.description).to.equal("Increase reward rate");
      expect(proposal.target).to.equal(ZERO_ADDRESS);
      expect(proposal.value).to.equal(0n);
      expect(proposal.data).to.equal(NO_DATA);
      expect(proposal.executed).to.equal(false);
      // Backdated by exactly one second from the creation block's timestamp.
      expect(proposal.snapshotTimestamp).to.equal(
        BigInt(block!.timestamp) - 1n
      );
      expect(await dao.state(1)).to.equal(0n); // Active
    });

    it("rejects a zero-target proposal that carries value or calldata", async function () {
      await expect(
        dao.createProposal("bad", DAY, ZERO_ADDRESS, 1, NO_DATA)
      ).to.be.rejectedWith("Target required for value/data");

      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("setValue", [1]);

      await expect(
        dao.createProposal("ok", DAY, ZERO_ADDRESS, 0, calldata)
      ).to.be.rejectedWith("Target required for value/data");

      // Sanity: a real target with real data is accepted.
      await expect(
        dao.createProposal("ok2", DAY, targetAddress, 0, calldata)
      ).to.not.be.rejected;
    });

    it("proposal creation is no longer owner-gated: any address clearing the threshold can create one", async function () {
      // user is not auto-delegated (only owner is, as shared fixture
      // convenience) — delegate explicitly, then create as a non-owner.
      await delegateSelf(user);

      await expect(
        dao.connect(user).createProposal("from a holder", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });
  });

  describe("proposal threshold (Step 3A)", function () {
    it("1. an address below the proposal threshold cannot create a proposal", async function () {
      const [, , , , lowBalance] = await ethers.getSigners();
      await token.transfer(lowBalance.address, ethers.parseEther("500")); // < 1,000 threshold
      await delegateSelf(lowBalance);

      await expect(
        dao.connect(lowBalance).createProposal("nope", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");
    });

    it("2. an address exactly at the threshold can create a proposal", async function () {
      const threshold = await dao.proposalThreshold();
      expect(await token.balanceOf(user.address)).to.equal(threshold); // default 1,000 == default threshold

      await delegateSelf(user);

      await expect(
        dao.connect(user).createProposal("exact", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });

    it("3. an address above the threshold can create a proposal", async function () {
      await token.transfer(user2.address, ethers.parseEther("1")); // 1001 > 1000 threshold
      await delegateSelf(user2);

      await expect(
        dao.connect(user2).createProposal("above", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });

    it("4. the deployer has no special ability to bypass the threshold", async function () {
      // Fresh deployment, deliberately bypassing the shared fixture's
      // convenience owner-delegation, to isolate deployer status itself.
      const Token = await ethers.getContractFactory("StakeVerseToken");
      const freshToken = await Token.deploy(owner.address);
      await freshToken.waitForDeployment();

      const DAO = await ethers.getContractFactory("StakeVerseDAO");
      const freshDao = await DAO.deploy(await freshToken.getAddress(), owner.address);
      await freshDao.waitForDeployment();

      // owner is the deployer AND the DAO's Ownable owner, holds the full
      // 1,000,000-token supply, and has NOT delegated. Deployer/owner
      // status alone must not be enough.
      await expect(
        freshDao.connect(owner).createProposal("deployer bypass?", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");

      // The exact same account succeeds once it clears the bar the same
      // way anyone else must — by delegating — proving it is one uniform
      // rule, not owner-status being separately rejected.
      await freshToken.connect(owner).delegate(owner.address);
      await expect(
        freshDao.connect(owner).createProposal("now eligible like anyone else", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });

    it("5. token transfers cannot be used to bypass the threshold within the same block/transaction", async function () {
      const [, , , , attacker] = await ethers.getSigners();
      expect(await token.balanceOf(attacker.address)).to.equal(0n);

      await ethers.provider.send("evm_setAutomine", [false]);
      try {
        // All three land in the same block: fund the attacker, have them
        // self-delegate, then have them immediately try to propose —
        // simulating a flash-loan-style borrow/delegate/act/repay pattern
        // collapsed into one block.
        await token.connect(owner).transfer(attacker.address, ethers.parseEther("50000"), {
          gasLimit: 300000,
        });
        await token.connect(attacker).delegate(attacker.address, { gasLimit: 300000 });
        await dao
          .connect(attacker)
          .createProposal("flash eligibility", DAY, ZERO_ADDRESS, 0, NO_DATA, {
            gasLimit: 300000,
          });
        await ethers.provider.send("evm_mine", []);
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }

      // The createProposal call in that block must have reverted: no
      // proposal beyond whatever proposalCount already was should exist.
      // proposalCount is still 0 here (no proposal created anywhere yet in
      // this test), so it must remain 0.
      expect(await dao.proposalCount()).to.equal(0n);
    });

    it("6/7. holding tokens without delegating does not satisfy the threshold, however large the balance", async function () {
      // user2 receives a balance far above the threshold but never
      // delegates.
      await token.transfer(user2.address, ethers.parseEther("50000"));

      await expect(
        dao.connect(user2).createProposal("undelegated", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");

      // Delegating (even to someone else) moves the eligibility, proving
      // the rule tracks delegated voting power, not balanceOf():
      // user2 delegates to user3 -> user2 still cannot propose...
      await token.connect(user2).delegate(user3.address);
      await expect(
        dao.connect(user2).createProposal("still undelegated", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");

      // ...but user3, who holds only their own 1,000 tokens directly, can
      // now propose using the inherited delegated weight.
      await expect(
        dao.connect(user3).createProposal("delegate inherits eligibility", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.not.be.rejected;
    });

    it("8. proposal creation by an eligible non-owner is fully compatible with the target/value/calldata model", async function () {
      await delegateSelf(user);

      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("setValue", [99]);

      await dao.connect(user).createProposal("holder-created targeted proposal", DAY, targetAddress, 0, calldata);

      const proposal = await dao.getProposal(1);
      expect(proposal.target).to.equal(targetAddress);
      expect(proposal.data).to.equal(calldata);
      expect(proposal.value).to.equal(0n);

      // The normal vote -> quorum -> execute flow still works end-to-end
      // for a proposal created by a non-owner.
      await dao.connect(owner).vote(1, true); // owner supplies quorum
      await advanceTime(DAY + 1);
      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await dao.executeProposal(1);
      expect(await mockTarget.value()).to.equal(99n);
    });

    it("only the owner can change the proposal threshold", async function () {
      await expect(
        dao.connect(user).setProposalThreshold(0)
      ).to.be.rejected;

      await dao.connect(owner).setProposalThreshold(ethers.parseEther("2000"));
      expect(await dao.proposalThreshold()).to.equal(ethers.parseEther("2000"));
    });

    it("changing the threshold does not retroactively affect an already-created proposal's snapshot/eligibility record", async function () {
      await delegateSelf(user);
      await dao.connect(user).createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      // Raise the bar above what user has.
      await dao.connect(owner).setProposalThreshold(ethers.parseEther("2000000"));

      // Existing proposal is unaffected — it already exists and carries its
      // own recorded snapshot/deadline regardless of the current threshold.
      const proposal = await dao.getProposal(1);
      expect(proposal.description).to.equal("p");

      // But a brand new attempt from the same (now-insufficient) account
      // is correctly rejected against the new bar.
      await expect(
        dao.connect(user).createProposal("p2", DAY, ZERO_ADDRESS, 0, NO_DATA)
      ).to.be.rejectedWith("Below proposal threshold");
    });
  });

  describe("voting power: historical, not live balanceOf()", function () {
    it("a holder can vote using their historical (delegated, pre-snapshot) voting power", async function () {
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await dao.connect(user).vote(1, true);

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });

    it("current balanceOf() is not used as historical voting power: holding tokens without delegating grants zero voting power", async function () {
      // user2 holds 1000 tokens but never called delegate().
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await expect(
        dao.connect(user2).vote(1, true)
      ).to.be.rejectedWith("No governance voting power");
    });

    it("PRIMARY: transferring tokens to another address after the snapshot does not transfer already-used voting power to the recipient", async function () {
      // A (user) holds and self-delegates BEFORE the proposal/snapshot.
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      // A votes using their historical 1000-token power.
      await dao.connect(user).vote(1, true);

      let proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));

      // A transfers the entire balance to B (user2) AFTER the snapshot.
      await token.connect(user).transfer(user2.address, ethers.parseEther("1000"));

      // Even if B now self-delegates, B's checkpoint history only starts
      // now — strictly after the snapshot — so B has no historical power
      // for THIS proposal.
      await delegateSelf(user2);

      await expect(
        dao.connect(user2).vote(1, false)
      ).to.be.rejectedWith("No governance voting power");

      // The proposal's tally is completely unaffected by the transfer.
      proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
      expect(proposal.noVotes).to.equal(0n);
    });

    it("CONVERSE: the original historical voter keeps their voting right even after giving away their current balance", async function () {
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      // user gives away their tokens BEFORE voting, but AFTER the snapshot.
      await token.connect(user).transfer(user2.address, ethers.parseEther("1000"));

      // user now has a balanceOf() of 0, yet can still vote with their
      // pre-transfer historical power.
      expect(await token.balanceOf(user.address)).to.equal(0n);

      await dao.connect(user).vote(1, true);

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });

    it("the same token balance cannot be recycled through a chain of addresses (A -> B -> C)", async function () {
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await dao.connect(user).vote(1, true);

      // Move the same 1000 tokens A -> B -> C, all after the snapshot.
      await token.connect(user).transfer(user2.address, ethers.parseEther("1000"));
      await delegateSelf(user2);
      await token.connect(user2).transfer(user3.address, ethers.parseEther("1000"));
      await delegateSelf(user3);

      await expect(dao.connect(user2).vote(1, true)).to.be.rejectedWith(
        "No governance voting power"
      );
      await expect(dao.connect(user3).vote(1, true)).to.be.rejectedWith(
        "No governance voting power"
      );

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });

    it("delegating AFTER the snapshot does not retroactively grant voting power for an already-created proposal", async function () {
      // user holds tokens from the very start (beforeEach transfer), but
      // does not delegate until after the proposal (and its snapshot)
      // already exist.
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await delegateSelf(user);

      await expect(
        dao.connect(user).vote(1, true)
      ).to.be.rejectedWith("No governance voting power");
    });

    it("unauthorized accounts cannot vote on behalf of another account: voting power is always msg.sender's own historical power", async function () {
      // Only `user` delegates/has power. user2 has a balance but no
      // delegation, and there is no parameter letting user2 vote "as" user.
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await expect(
        dao.connect(user2).vote(1, true)
      ).to.be.rejectedWith("No governance voting power");

      // user's own vote still works, attributed only to user.
      await dao.connect(user).vote(1, true);
      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });

    it("a voter cannot vote twice on the same proposal", async function () {
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await dao.connect(user).vote(1, true);

      await expect(
        dao.connect(user).vote(1, true)
      ).to.be.rejectedWith("Already voted");
    });

    it("voting after the deadline reverts", async function () {
      await delegateSelf(user);

      await dao.createProposal("p", 10, ZERO_ADDRESS, 0, NO_DATA);

      await advanceTime(20);

      await expect(
        dao.connect(user).vote(1, true)
      ).to.be.rejectedWith("Voting period ended");
    });

    it("does not revert with a future-timepoint lookup when a vote lands in the SAME block/timestamp as proposal creation", async function () {
      // Proves the snapshot-backdating design: even in the extreme case of
      // creation and a vote sharing one block (one timestamp), the
      // snapshot (block.timestamp - 1 at creation) is still strictly in
      // the past relative to that shared timestamp.
      await delegateSelf(user);

      await ethers.provider.send("evm_setAutomine", [false]);
      try {
        // Explicit gasLimit on both: with automine off, ethers' default
        // eth_estimateGas simulates against the LATEST (not pending) state,
        // and the vote() call depends on createProposal's not-yet-mined
        // effect — estimation against latest state would see no proposal
        // and throw before the tx is even submitted. Skipping estimation
        // lets both land in the mempool to be mined together in one block.
        await dao.createProposal(
          "same-block",
          DAY,
          ZERO_ADDRESS,
          0,
          NO_DATA,
          { gasLimit: 300000 }
        );
        await dao.connect(user).vote(1, true, { gasLimit: 300000 });
        await ethers.provider.send("evm_mine", []);
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("quorum", function () {
    it("proposal fails when quorum is not reached, even with unanimous yes votes among voters", async function () {
      // Only a tiny fraction of supply participates: nowhere near the
      // default 10% quorum of total supply (owner holds the bulk and does
      // not vote in this test).
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(user).vote(1, true);

      await advanceTime(DAY + 1);

      expect(await dao.quorumReached(1)).to.equal(false);
      expect(await dao.state(1)).to.equal(1n); // Failed
    });

    it("proposal succeeds when quorum is satisfied and yes > no", async function () {
      // owner holds ~99.7% of supply after the beforeEach transfers —
      // comfortably above the 10% quorum threshold on its own.
      await delegateSelf(owner);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);

      await advanceTime(DAY + 1);

      expect(await dao.quorumReached(1)).to.equal(true);
      expect(await dao.state(1)).to.equal(2n); // Succeeded
    });

    it("enforces yes > no even when quorum is satisfied", async function () {
      await delegateSelf(owner);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, false); // big holder votes NO

      await advanceTime(DAY + 1);

      expect(await dao.quorumReached(1)).to.equal(true);
      expect(await dao.state(1)).to.equal(1n); // Failed: yes (0) <= no
    });

    it("a tie (yes == no) fails", async function () {
      // Split the big holder's power across two accounts to produce a tie.
      // owner holds 997,000 after the beforeEach transfers (3 x 1,000 sent
      // out); user already holds 1,000. Sending 498,000 more to user
      // leaves both at exactly 499,000.
      await token.connect(owner).transfer(user.address, ethers.parseEther("498000"));
      await delegateSelf(owner);
      await delegateSelf(user);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);
      await dao.connect(user).vote(1, false);

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(proposal.noVotes);

      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(1n); // Failed
    });

    it("handles the zero-votes-cast edge case without reverting", async function () {
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await advanceTime(DAY + 1);

      const proposal = await dao.getProposal(1);
      expect(proposal.yesVotes).to.equal(0n);
      expect(proposal.noVotes).to.equal(0n);
      expect(await dao.quorumReached(1)).to.equal(false);
      expect(await dao.state(1)).to.equal(1n); // Failed
    });

    it("only the owner can change the quorum numerator, and it is bounded to <= 100", async function () {
      await expect(
        dao.connect(user).setQuorumNumerator(20)
      ).to.be.rejected;

      await expect(
        dao.connect(owner).setQuorumNumerator(101)
      ).to.be.rejectedWith("Too high");

      await dao.connect(owner).setQuorumNumerator(20);
      expect(await dao.quorumNumerator()).to.equal(20n);
    });
  });

  describe("proposal lifecycle / state machine", function () {
    it("Active while voting is open", async function () {
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      expect(await dao.state(1)).to.equal(0n); // Active
    });

    it("querying a non-existent proposal reverts", async function () {
      await expect(dao.state(1)).to.be.rejectedWith(
        "Proposal does not exist"
      );
      await expect(dao.connect(user).vote(1, true)).to.be.rejectedWith(
        "Proposal does not exist"
      );
    });

    it("reverts executing a still-Active proposal", async function () {
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });

    it("reverts executing a Failed proposal", async function () {
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(1n); // Failed

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });

    it("reaches Executed after a successful signaling-only proposal is executed, and cannot be executed again", async function () {
      await delegateSelf(owner);

      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await dao.executeProposal(1);

      expect(await dao.state(1)).to.equal(3n); // Executed

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });

    it("arbitrary callers cannot bypass proposal state: execution is gated by state(), not by caller identity", async function () {
      await dao.createProposal("p", DAY, ZERO_ADDRESS, 0, NO_DATA);

      // Neither the owner nor a random user can execute an Active proposal.
      await expect(dao.connect(owner).executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
      await expect(dao.connect(user).executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
    });
  });

  describe("execution against a real target (MockGovernanceTarget)", function () {
    async function createTargetedProposal(newValue: number) {
      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("setValue", [
        newValue,
      ]);
      await dao.createProposal("set value", DAY, targetAddress, 0, calldata);
      return { targetAddress, calldata };
    }

    it("a successful proposal actually changes target state via the exact approved calldata", async function () {
      await delegateSelf(owner);

      const { targetAddress, calldata } = await createTargetedProposal(42);

      const proposal = await dao.getProposal(1);
      expect(proposal.target).to.equal(targetAddress);
      expect(proposal.data).to.equal(calldata);
      expect(proposal.value).to.equal(0n);

      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await dao.executeProposal(1);

      expect(await mockTarget.value()).to.equal(42n);
      expect(await mockTarget.callCount()).to.equal(1n);
      expect(await mockTarget.lastCaller()).to.equal(await dao.getAddress());
      expect(await dao.state(1)).to.equal(3n); // Executed
    });

    it("forwards ETH value exactly as approved", async function () {
      await delegateSelf(owner);

      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("setValue", [7]);
      const sendValue = ethers.parseEther("1");

      await dao.createProposal("set value with eth", DAY, targetAddress, sendValue, calldata);

      // Fund the DAO so it has ETH to forward on execution.
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: sendValue,
      });

      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      await dao.executeProposal(1);

      expect(await mockTarget.totalValueReceived()).to.equal(sendValue);
    });

    it("a failing target call reverts the execution transaction safely", async function () {
      await delegateSelf(owner);

      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("alwaysReverts", []);

      await dao.createProposal("bad call", DAY, targetAddress, 0, calldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );
    });

    it("a failed execution leaves the proposal Succeeded (not Executed) and still executable again", async function () {
      await delegateSelf(owner);

      const targetAddress = await mockTarget.getAddress();
      const calldata = mockTarget.interface.encodeFunctionData("alwaysReverts", []);

      await dao.createProposal("bad call", DAY, targetAddress, 0, calldata);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );

      // The whole transaction reverted, so `executed` was never actually
      // latched to true — the proposal is still Succeeded, not burned.
      const proposal = await dao.getProposal(1);
      expect(proposal.executed).to.equal(false);
      expect(await dao.state(1)).to.equal(2n); // Succeeded

      // It can still be attempted again (fails again identically here,
      // since the target always reverts, but critically: not because of
      // "already executed" — proving no state corruption occurred).
      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal execution failed"
      );
    });

    it("a successful execution cannot be replayed", async function () {
      await delegateSelf(owner);

      await createTargetedProposal(1);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      await dao.executeProposal(1);
      expect(await mockTarget.callCount()).to.equal(1n);

      await expect(dao.executeProposal(1)).to.be.rejectedWith(
        "Proposal not executable"
      );
      // Target was not called a second time.
      expect(await mockTarget.callCount()).to.equal(1n);
    });

    it("a signaling-only proposal (target = address(0)) transitions straight to Executed with no external call", async function () {
      await delegateSelf(owner);

      await dao.createProposal("signal only", DAY, ZERO_ADDRESS, 0, NO_DATA);
      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      await dao.executeProposal(1);

      expect(await dao.state(1)).to.equal(3n); // Executed
      expect(await mockTarget.callCount()).to.equal(0n);
    });
  });

  describe("integration: a passed proposal can govern a real StakeVerse contract (optional, isolated from DAO core logic)", function () {
    it("executes a proposal that calls StakeVerseStaking.setRewardRate", async function () {
      const Staking = await ethers.getContractFactory("StakeVerseStaking");
      const staking = await Staking.deploy(
        await token.getAddress(),
        owner.address
      );
      await staking.waitForDeployment();

      // Local, test-only ownership transfer of the Staking instance to the
      // DAO so it is authorized to call the owner-gated setter. This does
      // NOT touch scripts/deploy.ts or any production ownership logic.
      await staking.connect(owner).transferOwnership(await dao.getAddress());

      await delegateSelf(owner);

      const calldata = staking.interface.encodeFunctionData("setRewardRate", [
        25,
      ]);

      await dao.createProposal(
        "raise APR to 25%",
        DAY,
        await staking.getAddress(),
        0,
        calldata
      );

      await dao.connect(owner).vote(1, true);
      await advanceTime(DAY + 1);

      expect(await dao.state(1)).to.equal(2n); // Succeeded

      await dao.executeProposal(1);

      expect(await staking.rewardRate()).to.equal(25n);
    });
  });
});
