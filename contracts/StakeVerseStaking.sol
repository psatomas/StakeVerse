// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Emergency-pause scope (Step 6): ONLY new deposits (stake()) are
/// pausable. unstake(), claimRewards(), fundRewards(), and setRewardRate()
/// are deliberately left unaffected by pause state:
///   - unstake() returns a user's own principal — blocking it would trap
///     funds, which is worse than whatever incident the pause responds to.
///   - claimRewards() pays an already-owed, already-bounded liability
///     (pendingRewards, capped by rewardReserve) — blocking it only delays
///     a debt the protocol already owes, it does not reduce risk.
///   - fundRewards() is strictly additive to solvency; there is no
///     scenario where blocking it protects anyone.
///   - setRewardRate() moves no funds and is already onlyOwner (== the DAO
///     post-Step-4); gating it behind pause would stop the DAO from using
///     its own parameter as part of incident response.
/// pause()/unpause() are onlyOwner, which — because Staking's ownership is
/// already finalized to the DAO (Step 4) — makes this a DAO-governed pause
/// with no new authority concept introduced. See the Step 6 report for the
/// full authority-model and lockout analysis.
contract StakeVerseStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;

    uint256 public rewardRate = 5; // 5% APR

    // Sum of all users' staked principal currently held by this contract.
    // Tracked explicitly (mappings can't be summed) so principal can be
    // reasoned about, and tested, independently of reward accounting.
    uint256 public totalStaked;

    // Reward liquidity explicitly funded via fundRewards(). This is the ONLY
    // balance claimRewards() is allowed to pay out of. It is never inferred
    // from stakingToken.balanceOf(address(this)): an unsolicited/accidental
    // ERC20 transfer straight to this contract's address does not touch
    // rewardReserve and can never become claimable as a reward.
    uint256 public rewardReserve;

    mapping(address => uint256) public stakedBalance;

    // Timestamp of the user's last reward checkpoint (see _checkpoint).
    mapping(address => uint256) public stakingTimestamp;

    // Rewards accrued and checkpointed but not yet claimed, per user. This is
    // a liability against rewardReserve — distinct from stakedBalance
    // (principal) and distinct from rewardReserve (funded liquidity).
    mapping(address => uint256) public pendingRewards;

    event RewardsFunded(address indexed funder, uint256 amount);

    constructor(address tokenAddress, address initialOwner)
        Ownable(initialOwner)
    {
        stakingToken = IERC20(tokenAddress);
    }

    /// @notice Adds reward liquidity that claimRewards() can pay out of.
    /// This is the only function that increases rewardReserve; principal
    /// deposited via stake() never does, and tokens sent directly to this
    /// contract via a bare ERC20 transfer (bypassing this function) never do
    /// either — they are not recognized as available rewards.
    function fundRewards(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Invalid amount");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        rewardReserve += amount;

        emit RewardsFunded(msg.sender, amount);
    }

    function stake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Invalid amount");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Realize rewards accrued on the PRE-TOP-UP balance/timestamp before
        // the new deposit changes them, so the newly staked amount is never
        // back-dated to an earlier stake time (it starts accruing from now).
        _checkpoint(msg.sender);

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(stakedBalance[msg.sender] >= amount, "Insufficient balance");

        // Realize rewards accrued on the balance being reduced BEFORE
        // reducing it, so a partial withdrawal never discards rewards
        // already earned on the withdrawn portion.
        _checkpoint(msg.sender);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        if (stakedBalance[msg.sender] == 0) {
            stakingTimestamp[msg.sender] = 0;
        }

        stakingToken.safeTransfer(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        _checkpoint(msg.sender);

        uint256 reward = pendingRewards[msg.sender];

        require(reward > 0, "No rewards");
        // Rewards are paid exclusively from rewardReserve. Principal
        // (totalStaked / stakedBalance) is never touched here — if the
        // reserve can't cover what's owed, this reverts rather than paying
        // out of tokens that belong to stakers as principal.
        require(reward <= rewardReserve, "Insufficient reward reserve");

        pendingRewards[msg.sender] = 0;
        rewardReserve -= reward;

        stakingToken.safeTransfer(msg.sender, reward);
    }

    /// @notice Total rewards `user` could claim right now: previously
    /// checkpointed pendingRewards plus what has accrued since the last
    /// checkpoint. This reflects what is OWED, not what is payable — it does
    /// not check rewardReserve. claimRewards() enforces that check.
    function calculateRewards(address user) public view returns (uint256) {
        return pendingRewards[user] + _accruedSinceCheckpoint(user);
    }

    function setRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 100, "Too high");
        rewardRate = newRate;
    }

    /// @notice Blocks new deposits (stake()) only. unstake(), claimRewards(),
    /// fundRewards(), and setRewardRate() remain callable regardless of
    /// pause state — see the contract-level note above for why each one is
    /// deliberately excluded from this gate.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Reward accrued on `user`'s current stakedBalance since their last
    /// checkpoint. Uses only state that is still pre-mutation at every call
    /// site (see stake/unstake/claimRewards, which all call _checkpoint
    /// before touching stakedBalance or stakingTimestamp).
    function _accruedSinceCheckpoint(address user) internal view returns (uint256) {
        if (stakedBalance[user] == 0 || stakingTimestamp[user] == 0) {
            return 0;
        }

        uint256 stakingDuration = block.timestamp - stakingTimestamp[user];

        return (stakedBalance[user] * rewardRate * stakingDuration) / (365 days * 100);
    }

    /// @dev Banks reward accrued since the last checkpoint into
    /// pendingRewards, then resets the checkpoint clock to now. Must be
    /// called before any mutation of stakedBalance so it always reads the
    /// pre-mutation balance/timestamp pair.
    function _checkpoint(address user) internal {
        pendingRewards[user] += _accruedSinceCheckpoint(user);
        stakingTimestamp[user] = block.timestamp;
    }
}
