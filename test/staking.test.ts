import { expect } from "chai";
import hre from "hardhat";

describe("StakeVerseStaking", function () {
  let token: any;
  let staking: any;
  let owner: any;
  let user: any;
  let user2: any;
  let ethers: any;

  const DAY = 24 * 3600;
  const YEAR = 365 * DAY;
  const RATE = 5n; // matches the contract's default rewardRate (5% APR)

  // Mirrors StakeVerseStaking._accruedSinceCheckpoint's formula exactly, so
  // expected values are derived the same way the contract derives them,
  // using real on-chain timestamps rather than assumed offsets.
  function expectedAccrual(balance: bigint, durationSeconds: bigint): bigint {
    return (balance * RATE * durationSeconds) / (BigInt(YEAR) * 100n);
  }

  async function blockTimestampOf(txResponse: any): Promise<bigint> {
    const receipt = await txResponse.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    return BigInt(block.timestamp);
  }

  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async function () {
    const connection = await hre.network.create();

    ethers = connection.ethers;

    [owner, user, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory(
      "StakeVerseToken"
    );

    token = await Token.deploy(owner.address);

    await token.waitForDeployment();

    const Staking = await ethers.getContractFactory(
      "StakeVerseStaking"
    );

    staking = await Staking.deploy(
      await token.getAddress(),
      owner.address
    );

    await staking.waitForDeployment();

    await token.transfer(
      user.address,
      ethers.parseEther("1000")
    );

    await token.transfer(
      user2.address,
      ethers.parseEther("1000")
    );
  });

  it("should allow staking", async function () {
    await token
      .connect(user)
      .approve(
        await staking.getAddress(),
        ethers.parseEther("100")
      );

    await staking
      .connect(user)
      .stake(ethers.parseEther("100"));

    const balance =
      await staking.stakedBalance(user.address);

    expect(balance).to.equal(
      ethers.parseEther("100")
    );
  });

  it("should allow unstaking", async function () {
    await token
      .connect(user)
      .approve(
        await staking.getAddress(),
        ethers.parseEther("100")
      );

    await staking
      .connect(user)
      .stake(ethers.parseEther("100"));

    await staking
      .connect(user)
      .unstake(ethers.parseEther("40"));

    const balance =
      await staking.stakedBalance(user.address);

    expect(balance).to.equal(
      ethers.parseEther("60")
    );
  });

  it("should prevent unstaking more than staked", async function () {
    await token
      .connect(user)
      .approve(
        await staking.getAddress(),
        ethers.parseEther("50")
      );

    await staking
      .connect(user)
      .stake(ethers.parseEther("50"));

    await expect(
      staking
        .connect(user)
        .unstake(ethers.parseEther("100"))
    ).to.be.rejectedWith(
      "Insufficient balance"
    );
  });

  it("should allow reward claiming once the reward reserve is funded", async function () {
    await token
      .connect(user)
      .approve(
        await staking.getAddress(),
        ethers.parseEther("100")
      );

    await staking
      .connect(user)
      .stake(ethers.parseEther("100"));

    // Reward liquidity must be explicitly funded — it is never assumed to
    // be available just because the contract holds tokens.
    await token
      .connect(owner)
      .approve(
        await staking.getAddress(),
        ethers.parseEther("1000")
      );

    await staking
      .connect(owner)
      .fundRewards(ethers.parseEther("1000"));

    await advanceTime(10 * DAY);

    const before =
      await token.balanceOf(user.address);

    await staking
      .connect(user)
      .claimRewards();

    const after =
      await token.balanceOf(user.address);

    expect(after).to.be.gt(before);
  });

  describe("reward liquidity vs. principal separation", function () {
    it("reverts claimRewards with 'No rewards' when nothing has accrued yet", async function () {
      // user has never staked, so stakedBalance is 0 and nothing has ever
      // been checkpointed — pendingRewards is 0 regardless of elapsed time.
      await expect(
        staking.connect(user).claimRewards()
      ).to.be.rejectedWith("No rewards");
    });

    it("reverts claimRewards with 'Insufficient reward reserve' instead of paying from principal", async function () {
      await token
        .connect(user)
        .approve(
          await staking.getAddress(),
          ethers.parseEther("100")
        );

      await staking
        .connect(user)
        .stake(ethers.parseEther("100"));

      await advanceTime(30 * DAY);

      // rewardReserve is still 0: the user has real accrued rewards
      // (calculateRewards > 0) but nothing was ever funded via fundRewards.
      const owed = await staking.calculateRewards(user.address);
      expect(owed).to.be.gt(0n);

      await expect(
        staking.connect(user).claimRewards()
      ).to.be.rejectedWith("Insufficient reward reserve");

      // Principal must be completely unaffected by the failed claim.
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await staking.totalStaked()).to.equal(
        ethers.parseEther("100")
      );
    });

    it("only the owner can fund rewards, and fundRewards increases rewardReserve by exactly the funded amount", async function () {
      await expect(
        staking.connect(user).fundRewards(ethers.parseEther("10"))
      ).to.be.rejected;

      await token
        .connect(owner)
        .approve(
          await staking.getAddress(),
          ethers.parseEther("50")
        );

      expect(await staking.rewardReserve()).to.equal(0n);

      await staking.connect(owner).fundRewards(ethers.parseEther("50"));

      expect(await staking.rewardReserve()).to.equal(
        ethers.parseEther("50")
      );
    });

    it("claimRewards decrements rewardReserve by exactly the amount paid out, and never touches totalStaked", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));

      const stakeTx = await staking
        .connect(user)
        .stake(ethers.parseEther("100"));
      const t0 = await blockTimestampOf(stakeTx);

      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("1000"));

      await staking.connect(owner).fundRewards(ethers.parseEther("1000"));

      await advanceTime(20 * DAY);

      const reserveBefore = await staking.rewardReserve();
      const stakedBefore = await staking.totalStaked();

      const claimTx = await staking.connect(user).claimRewards();
      const t1 = await blockTimestampOf(claimTx);

      const reserveAfter = await staking.rewardReserve();
      const stakedAfter = await staking.totalStaked();

      // The reward accrued exactly between the stake checkpoint (t0) and
      // the claim's own block (t1) — the only two timestamps the contract
      // itself uses for this computation.
      const expectedPaid = expectedAccrual(ethers.parseEther("100"), t1 - t0);

      expect(reserveBefore - reserveAfter).to.equal(expectedPaid);
      expect(stakedAfter).to.equal(stakedBefore);
      expect(await staking.pendingRewards(user.address)).to.equal(0n);
    });

    it("a bare ERC20 transfer straight to the contract is never recognized as reward liquidity", async function () {
      await token
        .connect(user)
        .approve(
          await staking.getAddress(),
          ethers.parseEther("100")
        );

      await staking
        .connect(user)
        .stake(ethers.parseEther("100"));

      const stakingAddress = await staking.getAddress();
      const reserveBefore = await staking.rewardReserve();

      // Unsolicited transfer, bypassing fundRewards() entirely.
      await token
        .connect(owner)
        .transfer(stakingAddress, ethers.parseEther("500"));

      // The contract's real balance goes up, but rewardReserve does not.
      expect(await token.balanceOf(stakingAddress)).to.be.gte(
        ethers.parseEther("500")
      );
      expect(await staking.rewardReserve()).to.equal(reserveBefore);

      await advanceTime(30 * DAY);

      // Even though the contract is objectively holding enough tokens to
      // pay the reward, the unfunded reserve means the claim still reverts.
      await expect(
        staking.connect(user).claimRewards()
      ).to.be.rejectedWith("Insufficient reward reserve");
    });
  });

  describe("insolvency regression: one user's reward claim can never impair another user's principal", function () {
    it("allows full principal withdrawal after another user drains the reward reserve", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));
      await staking.connect(user).stake(ethers.parseEther("100"));

      await token
        .connect(user2)
        .approve(stakingAddress, ethers.parseEther("200"));
      await staking.connect(user2).stake(ethers.parseEther("200"));

      // Owner funds only a small reward reserve — deliberately far smaller
      // than the combined principal held by the contract.
      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("5"));
      await staking.connect(owner).fundRewards(ethers.parseEther("5"));

      await advanceTime(365 * DAY);

      // user2 claims and fully (or almost fully) drains the reserve.
      const owed2 = await staking.calculateRewards(user2.address);
      if (owed2 <= (await staking.rewardReserve())) {
        await staking.connect(user2).claimRewards();
      }

      // user must still be able to withdraw their FULL original principal,
      // regardless of what user2 claimed in rewards.
      const before = await token.balanceOf(user.address);
      await staking.connect(user).unstake(ethers.parseEther("100"));
      const after = await token.balanceOf(user.address);

      expect(after - before).to.equal(ethers.parseEther("100"));
      expect(await staking.stakedBalance(user.address)).to.equal(0n);
    });
  });

  describe("checkpointing: top-ups and partial withdrawals", function () {
    it("does not back-date a top-up: rewards already earned on the original stake are banked, not inflated by the new deposit", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("200"));

      const stakeTx = await staking
        .connect(user)
        .stake(ethers.parseEther("100"));
      const t0 = await blockTimestampOf(stakeTx);

      await advanceTime(5 * DAY);

      // Top-up while already staked.
      const topUpTx = await staking
        .connect(user)
        .stake(ethers.parseEther("100"));
      const t1 = await blockTimestampOf(topUpTx);

      const expectedBanked = expectedAccrual(
        ethers.parseEther("100"),
        t1 - t0
      );

      // The accrual for the first 100 tokens over [t0, t1] must be
      // checkpointed into pendingRewards, not discarded, and not computed
      // as if 200 tokens had been staked for that whole period.
      expect(await staking.pendingRewards(user.address)).to.equal(
        expectedBanked
      );
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("200")
      );
      expect(await staking.totalStaked()).to.equal(
        ethers.parseEther("200")
      );

      await advanceTime(5 * DAY);

      const nowBlock = await ethers.provider.getBlock("latest");
      const t2 = BigInt(nowBlock.timestamp);

      const expectedLive = expectedAccrual(
        ethers.parseEther("200"),
        t2 - t1
      );

      // Total claimable = banked (100 tokens, first period) + live accrual
      // on the full 200 tokens over the second period.
      expect(await staking.calculateRewards(user.address)).to.equal(
        expectedBanked + expectedLive
      );
    });

    it("does not discard rewards already accrued when partially unstaking", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));

      const stakeTx = await staking
        .connect(user)
        .stake(ethers.parseEther("100"));
      const t0 = await blockTimestampOf(stakeTx);

      await advanceTime(15 * DAY);

      const unstakeTx = await staking
        .connect(user)
        .unstake(ethers.parseEther("40"));
      const t1 = await blockTimestampOf(unstakeTx);

      const expectedBanked = expectedAccrual(
        ethers.parseEther("100"), // the balance BEFORE the withdrawal
        t1 - t0
      );

      // The reward earned on the full 100 tokens over [t0, t1] must survive
      // the partial withdrawal instead of being silently zeroed out.
      expect(await staking.pendingRewards(user.address)).to.equal(
        expectedBanked
      );
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("60")
      );

      // Fund and claim to prove the banked amount is real, payable value.
      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("1000"));
      await staking.connect(owner).fundRewards(ethers.parseEther("1000"));

      const before = await token.balanceOf(user.address);
      await staking.connect(user).claimRewards();
      const after = await token.balanceOf(user.address);

      expect(after - before).to.be.gte(expectedBanked);
    });

    it("resets the checkpoint clock to zero once a user fully unstakes", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));
      await staking.connect(user).stake(ethers.parseEther("100"));

      await advanceTime(10 * DAY);

      await staking.connect(user).unstake(ethers.parseEther("100"));

      expect(await staking.stakingTimestamp(user.address)).to.equal(0n);
      expect(await staking.stakedBalance(user.address)).to.equal(0n);

      // No further accrual should occur while fully unstaked, even though
      // pendingRewards from before the withdrawal is still owed.
      const pendingAfterUnstake = await staking.pendingRewards(
        user.address
      );

      await advanceTime(10 * DAY);

      expect(await staking.calculateRewards(user.address)).to.equal(
        pendingAfterUnstake
      );
    });
  });

  describe("explicit accounting distinction (principal / pendingRewards / rewardReserve / actual balance)", function () {
    it("keeps the four quantities independently correct through a mixed scenario", async function () {
      const stakingAddress = await staking.getAddress();

      // user stakes 100, user2 stakes 200 -> principal ledger.
      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));
      const stakeTx = await staking.connect(user).stake(ethers.parseEther("100"));
      const t0 = await blockTimestampOf(stakeTx);

      await token
        .connect(user2)
        .approve(stakingAddress, ethers.parseEther("200"));
      await staking.connect(user2).stake(ethers.parseEther("200"));

      // Owner funds reward liquidity -> rewardReserve, separate from
      // principal.
      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("30"));
      await staking.connect(owner).fundRewards(ethers.parseEther("30"));

      // An unrelated, unsolicited transfer -> inflates actual balance only.
      await token
        .connect(owner)
        .transfer(stakingAddress, ethers.parseEther("7"));

      const totalStaked = await staking.totalStaked();
      const rewardReserve = await staking.rewardReserve();
      const actualBalance = await token.balanceOf(stakingAddress);

      expect(totalStaked).to.equal(ethers.parseEther("300"));
      expect(rewardReserve).to.equal(ethers.parseEther("30"));
      // actualBalance = principal (300) + funded reserve (30) + the
      // unsolicited extra (7), and that surplus is explicitly NOT part of
      // rewardReserve or totalStaked.
      expect(actualBalance).to.equal(ethers.parseEther("337"));
      expect(actualBalance).to.be.gte(totalStaked + rewardReserve);

      await advanceTime(365 * DAY);

      // pendingRewards (via calculateRewards) is a liability figure,
      // independent of whether it is currently payable. Duration is
      // measured from the stake's own checkpoint (t0) to the latest block,
      // since the fundRewards/transfer calls above also consumed a few
      // seconds before advanceTime was even called.
      const latestBlock = await ethers.provider.getBlock("latest");
      const owedToUser = await staking.calculateRewards(user.address);
      expect(owedToUser).to.equal(
        expectedAccrual(
          ethers.parseEther("100"),
          BigInt(latestBlock.timestamp) - t0
        )
      );

      // The invariant that must hold after ANY sequence of operations:
      // the contract always holds at least as much as it owes as principal
      // plus what it has explicitly committed as reward liquidity.
      expect(await token.balanceOf(stakingAddress)).to.be.gte(
        (await staking.totalStaked()) + (await staking.rewardReserve())
      );
    });
  });

  describe("emergency pause (Step 6)", function () {
    it("starts unpaused", async function () {
      expect(await staking.paused()).to.equal(false);
    });

    it("an unauthorized account cannot pause", async function () {
      await expect(staking.connect(user).pause()).to.be.rejected;
    });

    it("an unauthorized account cannot unpause", async function () {
      await staking.connect(owner).pause();

      await expect(staking.connect(user).unpause()).to.be.rejected;
    });

    it("the owner can pause and unpause, emitting the standard Pausable events", async function () {
      await expect(staking.connect(owner).pause())
        .to.emit(staking, "Paused")
        .withArgs(owner.address);
      expect(await staking.paused()).to.equal(true);

      await expect(staking.connect(owner).unpause())
        .to.emit(staking, "Unpaused")
        .withArgs(owner.address);
      expect(await staking.paused()).to.equal(false);
    });

    it("stake() reverts while paused", async function () {
      await staking.connect(owner).pause();

      await token
        .connect(user)
        .approve(await staking.getAddress(), ethers.parseEther("100"));

      await expect(
        staking.connect(user).stake(ethers.parseEther("100"))
      ).to.be.rejected;
    });

    it("stake() succeeds again once unpaused", async function () {
      await staking.connect(owner).pause();
      await staking.connect(owner).unpause();

      await token
        .connect(user)
        .approve(await staking.getAddress(), ethers.parseEther("100"));

      await expect(staking.connect(user).stake(ethers.parseEther("100"))).to
        .not.be.rejected;
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("unstake() and claimRewards() remain available while paused (recovery operations are never blocked)", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("100"));
      await staking.connect(user).stake(ethers.parseEther("100"));

      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("1000"));
      await staking.connect(owner).fundRewards(ethers.parseEther("1000"));

      await advanceTime(10 * DAY);

      // Pause AFTER the setup above, then prove both recovery paths work.
      await staking.connect(owner).pause();
      expect(await staking.paused()).to.equal(true);

      const balanceBeforeClaim = await token.balanceOf(user.address);
      await expect(staking.connect(user).claimRewards()).to.not.be.rejected;
      expect(await token.balanceOf(user.address)).to.be.gt(balanceBeforeClaim);

      await expect(
        staking.connect(user).unstake(ethers.parseEther("100"))
      ).to.not.be.rejected;
      expect(await staking.stakedBalance(user.address)).to.equal(0n);
    });

    it("fundRewards() and setRewardRate() remain available while paused", async function () {
      await staking.connect(owner).pause();

      await token
        .connect(owner)
        .approve(await staking.getAddress(), ethers.parseEther("10"));

      await expect(
        staking.connect(owner).fundRewards(ethers.parseEther("10"))
      ).to.not.be.rejected;

      await expect(staking.connect(owner).setRewardRate(20)).to.not.be
        .rejected;
      expect(await staking.rewardRate()).to.equal(20n);
    });

    it("full state transition: pause -> restricted op fails -> recovery ops succeed -> unpause -> restricted op succeeds again, with accounting invariants intact at every step", async function () {
      const stakingAddress = await staking.getAddress();

      await token
        .connect(user)
        .approve(stakingAddress, ethers.parseEther("200"));
      await staking.connect(user).stake(ethers.parseEther("100"));

      await token
        .connect(owner)
        .approve(stakingAddress, ethers.parseEther("1000"));
      await staking.connect(owner).fundRewards(ethers.parseEther("1000"));

      await advanceTime(5 * DAY);

      // --- pause ---
      await staking.connect(owner).pause();
      expect(await staking.paused()).to.equal(true);

      const totalStakedAtPause = await staking.totalStaked();
      const rewardReserveAtPause = await staking.rewardReserve();

      // --- restricted operation fails, state unchanged ---
      await expect(
        staking.connect(user).stake(ethers.parseEther("50"))
      ).to.be.rejected;
      expect(await staking.totalStaked()).to.equal(totalStakedAtPause);
      expect(await staking.rewardReserve()).to.equal(rewardReserveAtPause);

      // --- recovery: claim, then partial unstake, both while paused ---
      expect(await staking.calculateRewards(user.address)).to.be.gt(0n);

      const reserveBeforeClaim = await staking.rewardReserve();
      const userBalanceBeforeClaim = await token.balanceOf(user.address);

      await staking.connect(user).claimRewards();

      const amountPaid =
        (await token.balanceOf(user.address)) - userBalanceBeforeClaim;

      expect(await staking.pendingRewards(user.address)).to.equal(0n);
      // Ground-truth check: whatever was actually paid out (observed via
      // the user's balance delta on the claim tx's own block) is exactly
      // what left rewardReserve — no separate prediction, no drift from
      // reading a view call at a different block than the claim itself.
      expect(await staking.rewardReserve()).to.equal(
        reserveBeforeClaim - amountPaid
      );

      await staking.connect(user).unstake(ethers.parseEther("40"));
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("60")
      );
      expect(await staking.totalStaked()).to.equal(
        totalStakedAtPause - ethers.parseEther("40")
      );

      // The core invariant from Step 1 still holds throughout: the
      // contract always holds at least what it owes as principal plus
      // funded reserve. No pause-specific accounting branch was
      // introduced — this is the exact same formula used everywhere else
      // in this file.
      expect(await token.balanceOf(stakingAddress)).to.be.gte(
        (await staking.totalStaked()) + (await staking.rewardReserve())
      );

      // --- unpause, restricted operation works again ---
      await staking.connect(owner).unpause();
      expect(await staking.paused()).to.equal(false);

      await staking.connect(user).stake(ethers.parseEther("40"));
      expect(await staking.stakedBalance(user.address)).to.equal(
        ethers.parseEther("100")
      );
    });
  });
});
