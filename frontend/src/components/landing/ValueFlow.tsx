import SectionShell from "./SectionShell";
import FlowSequence, { type FlowStepData } from "./FlowSequence";
import Callout from "./Callout";

const STEPS: FlowStepData[] = [
  {
    id: "user",
    title: "User",
    description: "Holds SVT and approves StakeVerseStaking to move it.",
  },
  {
    id: "stake",
    title: "Stake",
    description:
      "stake() transfers principal into the pool and checkpoints any reward already accrued before the deposit changes the account's balance or timestamp.",
    technical: "stake(uint256 amount)",
  },
  {
    id: "state",
    title: "Protocol State",
    description:
      "stakedBalance / totalStaked track principal. rewardReserve — funded only via fundRewards() — tracks payable liquidity. The two are never the same balance.",
    technical: "rewardReserve ≠ totalStaked",
  },
  {
    id: "accrual",
    title: "Reward Accrual",
    description:
      "Rewards accrue continuously at the current rewardRate — a governance-adjustable parameter, 5% APR by default — and are checkpointed on every stake/unstake, so a partial withdrawal never discards rewards already earned.",
    technical: "rewardRate = 5% APR (default, DAO-adjustable)",
  },
  {
    id: "claim",
    title: "Claim",
    description:
      "claimRewards() pays out of rewardReserve only — never out of staked principal — and reverts if the reserve can't cover what's owed.",
    technical: "require(reward <= rewardReserve)",
  },
];

export default function ValueFlow() {
  return (
    <SectionShell
      id="value-flow"
      index="02"
      kicker="Value / State Flow"
      title="How staking actually accounts for value"
      description="Principal and reward liquidity are tracked as two separate balances — not a single pool that hopes to stay solvent."
    >
      <FlowSequence steps={STEPS} variant="value" />

      {/* A short connector stub ties the invariant visually to the Claim
          step above it — it's the constraint on THAT step, not a separate
          floating note. */}
      <div aria-hidden="true" className="hidden h-4 justify-end md:mr-[10%] md:flex">
        <div className="h-full w-px bg-sv-border-orange/40" />
      </div>
      <Callout tone="orange" label="Invariant">
        Reward claims are bounded by the available reward reserve. If
        <span className="sv-text-identifier mx-1">rewardReserve</span>
        can't cover what a user is owed, <span className="sv-text-identifier">claimRewards()</span> reverts rather than
        paying out of stakers' principal.
      </Callout>

      <p className="sv-text-metadata mt-4 max-w-2xl">
        5% APR is the contract's current configured default, not a guaranteed
        or fixed return — it is a governance-controlled parameter, adjustable
        by the DAO at any time via <span className="sv-text-identifier">setRewardRate()</span> (capped at 100%).
      </p>
    </SectionShell>
  );
}
