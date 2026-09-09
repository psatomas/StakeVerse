import { expect } from "chai";
import hre from "hardhat";

describe("StakeVerseToken", function () {
  let token: any;
  let owner: any;
  let user: any;
  let ethers: any;

  beforeEach(async function () {
    const connection = await hre.network.create();

    ethers = connection.ethers;

    [owner, user] =
      await ethers.getSigners();

    const Token =
      await ethers.getContractFactory(
        "StakeVerseToken"
      );

    token = await Token.deploy(
      owner.address
    );

    await token.waitForDeployment();
  });

  it("should deploy correctly", async function () {
    expect(
      await token.getAddress()
    ).to.not.equal(
      ethers.ZeroAddress
    );
  });

  it("should mint initial supply to owner", async function () {
    const balance =
      await token.balanceOf(
        owner.address
      );

    expect(balance).to.be.gt(0);
  });

  it("should transfer tokens", async function () {
    await token.transfer(
      user.address,
      ethers.parseEther("100")
    );

    const balance =
      await token.balanceOf(
        user.address
      );

    expect(balance).to.equal(
      ethers.parseEther("100")
    );
  });

  it("should approve allowance", async function () {
    await token.approve(
      user.address,
      ethers.parseEther("50")
    );

    const allowance =
      await token.allowance(
        owner.address,
        user.address
      );

    expect(allowance).to.equal(
      ethers.parseEther("50")
    );
  });

  describe("ERC20Votes integration", function () {
    it("uses timestamp-based clock (mode=timestamp), not the block-number default", async function () {
      expect(await token.CLOCK_MODE()).to.equal("mode=timestamp");

      const latestBlock = await ethers.provider.getBlock("latest");
      expect(await token.clock()).to.equal(BigInt(latestBlock!.timestamp));
    });

    it("does NOT auto-delegate on mint: the initial supply carries zero voting power until delegated", async function () {
      expect(await token.balanceOf(owner.address)).to.be.gt(0n);
      expect(await token.delegates(owner.address)).to.equal(
        ethers.ZeroAddress
      );
      expect(await token.getVotes(owner.address)).to.equal(0n);
    });

    it("self-delegation activates voting power equal to the current balance", async function () {
      await token.transfer(user.address, ethers.parseEther("100"));

      expect(await token.getVotes(user.address)).to.equal(0n);

      await token.connect(user).delegate(user.address);

      expect(await token.delegates(user.address)).to.equal(user.address);
      expect(await token.getVotes(user.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("getPastVotes reflects the checkpoint as of a past timestamp, not the current balance", async function () {
      await token.transfer(user.address, ethers.parseEther("100"));
      await token.connect(user).delegate(user.address);

      const afterDelegateBlock = await ethers.provider.getBlock("latest");
      const snapshot = BigInt(afterDelegateBlock!.timestamp);

      // Move to a strictly later timestamp so the snapshot is queryable.
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);

      // Balance changes after the snapshot must not affect the past value.
      await token.transfer(user.address, ethers.parseEther("900"));

      expect(await token.balanceOf(user.address)).to.equal(
        ethers.parseEther("1000")
      );
      expect(await token.getPastVotes(user.address, snapshot)).to.equal(
        ethers.parseEther("100")
      );
      expect(await token.getVotes(user.address)).to.equal(
        ethers.parseEther("1000")
      );
    });

    it("getPastVotes reverts for a timepoint that is not strictly in the past", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");

      await expect(
        token.getPastVotes(owner.address, latestBlock!.timestamp)
      ).to.be.rejected;
    });

    it("transferring tokens moves voting power only between delegated accounts, not raw holders", async function () {
      await token.transfer(user.address, ethers.parseEther("100"));
      // user never delegates.
      await token.connect(user).delegate(user.address);
      await token.connect(user).transfer(owner.address, ethers.parseEther("100"));

      expect(await token.getVotes(user.address)).to.equal(0n);
    });
  });
});