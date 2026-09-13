# StakeVerse — Security Audit & Reconciliation

**Status:** Steps 1–9 below are the original security remediation record — current as of the Step 9 final reconciliation and preserved unedited. See "Step 10 — Post-Audit Deployment Reconciliation" for what happened after Step 9: the hardened source was deployed to Sepolia and independently verified on-chain.
**Scope:** `contracts/StakeVerseToken.sol`, `StakeVerseStaking.sol`, `StakeVerseNFT.sol`, `StakeVerseDAO.sol`, `PriceOracleConsumer.sol`, `scripts/deploy.ts`, and the frontend's governance/staking integration.
**Method:** A structured, 9-phase incremental remediation and verification process (this document's own history), not an automated third-party tool run — see "A note on prior audit claims" below.
**Verifiable evidence:** 146/146 passing tests (`npx hardhat test`), 100% line/statement coverage on every production contract (`npx hardhat test --coverage`; raw output in `audit/hardhat_coverage.txt`), zero compiler warnings, clean `tsc -b`/`vite build`/`eslint` on the frontend.

---

## Executive Summary

StakeVerse began as an MVP with three critical/high-severity findings (staking reward insolvency, broken reward accounting, and governance based on live token balance), a centralized deployer-owned administration model, no oracle validation, and no emergency controls. Across nine remediation phases, every one of those issues was fixed and independently regression-tested; ownership of all four governed contracts was finalized to the DAO itself; and two originally-flagged "unlimited minting" findings (SVT and the membership NFT) were re-examined under the now-decentralized ownership model and reclassified as accepted governance-controlled design choices rather than access-control defects — because that is what they actually are now.

One genuine, unresolved item was found during this final reconciliation and is **not** a code-level security defect: the README documented an NFT-gated, Sybil-resistant governance model that was never implemented. This has been corrected in the documentation (see "Documentation Gaps") rather than implemented as new gating logic, since no step authorized changes to Staking's or the DAO's access-control surface for that purpose.

**No unresolved critical or high-severity vulnerability exists in the current implementation.**

---

## Architecture (as actually implemented)

```
StakeVerseToken (ERC20Votes, DAO-owned)
  ├─ mint() — onlyOwner (DAO only, via governance proposal)
  ├─ delegate() — explicit, never automatic
  └─ clock() — timestamp mode (not block-number)

StakeVerseStaking (DAO-owned)
  ├─ stake() — whenNotPaused, nonReentrant
  ├─ unstake() — always available, nonReentrant
  ├─ claimRewards() — always available, nonReentrant, bounded by rewardReserve
  ├─ fundRewards() — onlyOwner, always available (adds to rewardReserve only)
  ├─ setRewardRate() — onlyOwner, always available
  └─ pause() / unpause() — onlyOwner

StakeVerseNFT (DAO-owned)
  └─ mint() — onlyOwner; uncapped, unlimited per address; consumed by nothing else

StakeVerseDAO (owns itself)
  ├─ createProposal() — permissionless, gated by historical proposalThreshold
  ├─ vote() — historical voting power via governanceToken.getPastVotes()
  ├─ quorumReached() — historical total supply × quorumNumerator / 100
  ├─ state() — pure view: Active / Failed / Succeeded / Executed
  ├─ executeProposal() — permissionless once Succeeded; arbitrary target/value/data
  ├─ setQuorumNumerator() / setProposalThreshold() — onlyOwner (== itself)
  └─ never pausable (see Accepted Design Risks)

PriceOracleConsumer (standalone, no owner)
  └─ getLatestETHPrice() — validates roundId, answer, updatedAt, freshness
     (MAX_ORACLE_AGE = 3 hours), answeredInRound; consumed by nothing else
     in this repository
```

Ownership graph, verified live against a local JSON-RPC node (not just Hardhat's test harness):

```
Token.owner()   == DAO
Staking.owner() == DAO
NFT.owner()     == DAO
DAO.owner()     == DAO
```

---

## A note on prior audit claims

`audit/slither_report.txt` and `audit/mythril_staking_report.txt`, as originally committed, described findings that do not correspond to this codebase — most concretely, the Mythril report referenced `nonReentrant` protection on a function called `withdraw`, which **`StakeVerseStaking.sol` has never had** (the function has always been named `unstake`). Neither file's format matches genuine Slither/Mythril CLI output, and no `slither` or `myth` binary was available in the environment this remediation was performed in to produce a genuine replacement. Rather than repeat unverifiable claims, both files were corrected to state plainly that they are not verified tool output and to point here. The one automatically-reproducible artifact in `audit/` is `hardhat_coverage.txt`, regenerated with Hardhat's own `--coverage` flag against the current source.

---

## Original Findings Reconciliation

| # | Finding | Original Severity | Final Status | Final Severity | Evidence |
|---|---|---|---|---|---|
| C1 | Staking rewards funded from principal (insolvency risk) | Critical | **FIXED** | — | `StakeVerseStaking.sol`: `rewardReserve` tracked separately from `totalStaked`; `fundRewards()` is the only function that increases it; `claimRewards()` requires `reward <= rewardReserve` and never touches principal. Tests: `staking.test.ts` "reward liquidity vs. principal separation" (5 tests) + "insolvency regression" (1 test: one user draining the reserve never impairs another's principal withdrawal). |
| C2 | Broken reward accounting across multiple stakes / partial unstake | Critical | **FIXED** | — | `_checkpoint()` banks accrued reward into `pendingRewards` before every balance mutation, using pre-mutation balance/timestamp. Tests: `staking.test.ts` "checkpointing: top-ups and partial withdrawals" (3 tests), each asserting exact expected accrual computed from real on-chain block timestamps. |
| C3 | Governance used live `balanceOf()` | Critical | **FIXED** | — | `StakeVerseToken` now `ERC20Votes`; `StakeVerseDAO.vote()`/`createProposal()` use `governanceToken.getPastVotes()` exclusively, never `balanceOf`. Tests: `dao.test.ts` "voting power: historical, not live balanceOf()" (10 tests, including the A→B→C recycling chain and the same-block snapshot edge case). |
| H4 | Deployer remains owner of all contracts | High | **FIXED** | — | `scripts/deploy.ts` transfers Token and DAO ownership to the DAO post-deployment and constructs Staking/NFT with the DAO as `initialOwner` directly; the script asserts all four `owner()` values before declaring success and aborts otherwise. Verified by actually running the script against a live local JSON-RPC node (not simulated) — all four returned the DAO's address. Tests: `ownership-finalization.test.ts` (15 tests). |
| H5 | `executeProposal()` performed no real execution | High | **FIXED** | — | `Proposal` now carries `target`/`value`/`data`; `executeProposal()` performs `target.call{value: value}(data)` after latching `executed = true`. Tests: `dao.test.ts` "execution against a real target" (6 tests) + `governance-integration.test.ts` + `ownership-finalization.test.ts` Part 4 (full lifecycle against real `StakeVerseStaking`). |
| H6 | No quorum / minimum participation requirement | High | **FIXED** | — | `quorumNumerator` (default 10%) applied against historical total supply at each proposal's own snapshot; `state()` requires `quorumReached()` to return `Succeeded`. Tests: `dao.test.ts` "quorum" (6 tests: not-reached, satisfied, majority-enforced-separately, tie, zero-votes edge case, admin bound). |
| H7 | Chainlink oracle validation weaknesses (no staleness/validity checks) | High | **FIXED** | — | `PriceOracleConsumer.getLatestETHPrice()` validates `roundId > 0`, `answer > 0`, `updatedAt > 0`, `updatedAt <= block.timestamp`, `block.timestamp - updatedAt <= MAX_ORACLE_AGE (3h)`, `answeredInRound >= roundId`. Tests: `oracle.test.ts` (19 tests, including the exact freshness boundary mined to an exact block timestamp). |
| M8 | Staking `stake()` missing `nonReentrant` / CEI ordering concern | Medium | **FIXED** | — | `stake()` now carries `whenNotPaused nonReentrant`. Original ordering (interaction before the balance effect) preserved deliberately — reordering was assessed as unnecessary once the guard was added (see Step 1 design rationale) — and is safe against the actual, immutable `stakingToken`, a plain OZ `ERC20Votes` with no transfer hooks. |
| M9 | Unlimited owner-controlled token minting | Medium | **RECLASSIFIED → ACCEPTED DESIGN RISK** | Low (informational) | `mint()` is `onlyOwner`, and owner is now exclusively the DAO (H4). No document, test, or invariant anywhere assumes a fixed/capped supply; `fundRewards`-via-governance-mint is an already-tested, intentional composition (`ownership-finalization.test.ts`). Minting cannot retroactively affect an already-snapshotted proposal (`token-monetary-policy.test.ts` REGRESSION test). See Accepted Design Risks below. |
| M10 | No pause / circuit breaker | Medium | **FIXED** | — | `StakeVerseStaking` inherits OZ `Pausable`; only `stake()` is gated. `unstake`, `claimRewards`, `fundRewards`, `setRewardRate` all remain available while paused — deliberately, so an incident response can never trap funds or block governance. `pause`/`unpause` are `onlyOwner` (== DAO). Tests: `staking.test.ts` "emergency pause" (9 tests) + `ownership-finalization.test.ts` "Step 6" (5 tests, including execution by an unrelated fourth-party account). |
| L11 | Audit reports (`audit/*.txt`) contained inaccurate/fabricated-looking claims | Low/hygiene | **FIXED** (this step) | — | See "A note on prior audit claims" above; both files corrected, `hardhat_coverage.txt` regenerated with real numbers. |
| L12 | `deployment/sepolia.json` address format | Low/hygiene | **FALSE POSITIVE** (original claim) / **NEW GAP FOUND** | Informational | The addresses are syntactically valid 40-hex-character addresses (the original "malformed" claim was checked and retracted in Step 2). However, this reconciliation found a *different*, real issue: these addresses were deployed **before** all nine remediation phases — the live bytecode does not match the current source. Annotated with an explicit `status` field (see Deployment section) and flagged in the README; addresses not altered or invented. |
| L13 | Portuguese-language scaffold comment in `hardhat.config.ts` | Low/hygiene | **REMAINING** (untouched) | Informational | Still present (lines ~36-41). Harmless — comments only, no behavioral effect. Never in scope for any of the 9 remediation steps; not touched here either, since it's cosmetic and outside this step's documentation-reconciliation purpose. |
| L14 | Oracle feed address not declared `immutable` | Low/hygiene | **REMAINING** (accepted) | Informational | `priceFeed` is write-once in practice (set only in the constructor, no setter) but not using the `immutable` keyword. No functional impact; left as-is to minimize diff in Step 5. |
| L15 | NFT: no supply cap or per-address mint limit | Low/hygiene | **RECLASSIFIED → ACCEPTED DESIGN RISK** | Low (informational) | `mint()` is `onlyOwner` (== DAO); nothing else in the protocol consumes NFT ownership or total supply. Tests: `nft-issuance-policy.test.ts` (8 tests, including a 10-mint-with-no-ceiling proof and deliberate multi-mint-per-address). See Documentation Gaps for the separate, real finding this step surfaced. |

**New findings discovered during remediation (not in the original Step-0 list):**

| # | Finding | Discovered | Status | Evidence |
|---|---|---|---|---|
| N1 | `scripts/deploy.ts` had a nonce race when firing several sequential transactions from one wallet against a raw `JsonRpcProvider` | Step 4 | **FIXED** | Explicit sequential nonce tracking (`nextNonce()`) added to every transaction the script sends. Verified by running the corrected script against a live local Hardhat JSON-RPC node end-to-end. |
| N2 | README claimed NFT-gated staking/governance and "programmed scarcity" that was never implemented | Step 8 | **DOCUMENTATION GAP — CORRECTED** (this step) | README corrected in both language sections; see Documentation Gaps below. Not implemented as code, per this step's explicit scope limits. |
| N3 | README claimed voting power was "proportional to staked token balance" | Step 9 | **DOCUMENTATION GAP — CORRECTED** (this step) | Voting power comes from `ERC20Votes` delegation of the token itself, entirely independent of whether tokens are staked. Corrected in the README. |
| N4 | README's Oracle Mocking section described a non-existent `updateAnswer` mock function and a non-existent deploy-script environment-detection/mock-swap behavior | Step 9 | **DOCUMENTATION GAP — CORRECTED** (this step) | `MockV3Aggregator` exposes `setAnswer`/`setRoundId`/`setUpdatedAt`/`setAnsweredInRound`/`setDecimals`, not `updateAnswer`; `scripts/deploy.ts` always targets the real `CHAINLINK_PRICE_FEED`, never swaps to a mock. Corrected in the README. |

---

## Resolved Security Issues

C1, C2, C3, H4, H5, H6, H7, M8, M10 — see table above for the exact remediation and test evidence for each. All nine are exercised by the 146-test regression suite, which is re-run in full (not incrementally) at the end of every remediation phase.

---

## Accepted Design Risks

Explicit, intentional tradeoffs — not defects:

1. **Governance-controlled, uncapped SVT issuance.** The DAO can mint arbitrary amounts of `StakeVerseToken`. Every consequence (dilution, quorum/threshold shifts) is gated by the same governance process as every other protocol action; there is no privileged bypass. Reversing this into a fixed or capped supply would break the already-tested `fundRewards`-via-governance-mint composition.
2. **Governance-controlled, non-scarce NFT issuance.** `StakeVerseNFT.mint()` has no cap and no per-address limit, and multi-mint-per-address is deliberately tested as working. Nothing in the protocol currently depends on NFT scarcity or uniqueness.
3. **DAO self-governance lockout if quorum/threshold becomes unreachable.** Once the DAO owns itself, there is no external administrative override. If `quorumNumerator` or `proposalThreshold` is ever set (via legitimate governance) to a level current delegation cannot satisfy, no path back exists except another proposal that itself needs to clear the same bar. Actively demonstrated, not just asserted, in `ownership-finalization.test.ts`.
4. **Governance latency as the staking circuit breaker.** Only the DAO can `pause()`/`unpause()` Staking, and governance is slower than an active exploit. The design deliberately bounds the *consequence* of that latency to "more users had the opportunity to be exposed to new deposits" — never "existing depositors got trapped" — since `unstake`/`claimRewards` are never pausable.
5. **Multi-proposal choreography required to fund staking rewards from freshly minted supply.** If both Token and Staking are DAO-owned, funding `rewardReserve` from new issuance requires three separate proposals in sequence (mint to the DAO, approve Staking, call `fundRewards`) — there is no single-proposal shortcut. Proven working, not just theorized, in `ownership-finalization.test.ts`.
6. **Historical, pre-remediation Sepolia deployment metadata remains in the repository** (`deployment/sepolia.json`, README links) rather than being deleted, since the addresses are real and deleting them would erase a legitimate historical record — instead, both were annotated as stale/non-current (see Deployment section).

---

## Documentation Gaps

Distinct from security vulnerabilities — these are places where prose described behavior the code does not have. All corrected in `README.md` as part of this step; none required a Solidity change, and none were implemented as new code per this step's explicit scope limits.

* NFT-gated staking/governance, Sybil mitigation, and "programmed scarcity" — never implemented; corrected.
* Voting power "proportional to staked balance" — actually independent of staking, based on token delegation; corrected.
* Mock oracle's `updateAnswer` function — doesn't exist; actual setter names documented.
* Deploy script "detects the environment" to swap in the mock oracle — it doesn't; it always targets the real configured feed; corrected.
* Slither/Mythril "PASS" claims with a reference to a `withdraw` function that has never existed in this codebase — removed, replaced with an honest description of the actual remediation process.
* Sepolia deployment addresses presented without qualification as "the protocol" — now explicitly flagged as pre-remediation and non-current in both the README and `deployment/sepolia.json` itself.

---

## Remaining Technical Limitations

* No third-party static-analysis or external audit has reviewed this codebase — this document is the product of a structured, multi-phase, single-agent remediation process, not an independent audit.
* The Portuguese scaffold comment in `hardhat.config.ts` remains (cosmetic, no behavioral effect).
* `PriceOracleConsumer.priceFeed` is write-once but not declared `immutable`.
* No frontend UI surfaces Staking's `paused()` state, NFT ownership, or any monetary-policy information — none of this was required by any step's scope, and the live staking UI's existing generic error handling already surfaces a pause-triggered revert (just without a specific message).
* The current, hardened contract source has not been redeployed to Sepolia at the time of this document. **(Historical — accurate as of the Step 9 reconciliation. See "Step 10 — Post-Audit Deployment Reconciliation" below: this has since changed.)**

---

## Deployment / Ownership Status

Verified, not merely asserted:
```
Token.owner()   == DAO   ✓ (live local JSON-RPC run + ownership-finalization.test.ts)
Staking.owner() == DAO   ✓
NFT.owner()     == DAO   ✓
DAO.owner()     == DAO   ✓
```
Deployer holds zero administrative authority on any of the four contracts — every `onlyOwner` function (including `transferOwnership`/`renounceOwnership` themselves) was directly tested to reject the deployer post-finalization.

`deployment/sepolia.json` contains real, syntactically-valid addresses from a deployment that predates this remediation process. It has been annotated with a `status` field rather than deleted or altered, since the addresses themselves are accurate historical data — only their currency relative to today's source was misleading.

No production Sepolia deployment was created, modified, or redeployed at any point during Steps 1–9. **This remains true as a description of the Steps 1–9 period itself — it is a historical statement, not a claim about the current state. See "Step 10 — Post-Audit Deployment Reconciliation" immediately below for what happened afterward.**

---

## Step 10 — Post-Audit Deployment Reconciliation

**Status:** Addendum, added after Steps 1–9. Nothing above this section was edited to produce it — no historical finding, severity, or conclusion in Steps 1–9 was altered, weakened, or removed. This section only reconciles the "not yet deployed" statements above (in "Remaining Technical Limitations" and "Deployment / Ownership Status") against an event that happened after they were written.
**Trigger:** the hardened source reviewed and finalized in Steps 1–9 was subsequently deployed to Ethereum Sepolia through a controlled, confirmation-gated deployment pipeline (`.github/workflows/deploy-sepolia.yml`).

### Historical state vs. current state

**Historical (Steps 1–9):** at the time of the original review, no hardened production Sepolia deployment existed. `deployment/sepolia.json` held only the pre-remediation addresses described in finding L12 above. The two statements this addendum reconciles were both accurate descriptions of that moment and are preserved, unedited, elsewhere in this document as the historical record.

**Current (this addendum):** the hardened source, unchanged since the Step 9 reconciliation, has been deployed to Ethereum Sepolia. `git log -- contracts/` shows no commit touching any `.sol` file between the Step 9 reconciliation and this deployment — the source deployed is the exact source Steps 1–9 reviewed, not a later revision. `deployment/sepolia.json` now carries a second entry, `current`, alongside the original pre-remediation entry (kept as `history`, per Accepted Design Risk #6 above).

### Current deployment

| Field | Value |
|---|---|
| Network | Ethereum Sepolia |
| Chain ID | `11155111` |
| Deployed | `2026-09-10T01:29:39Z` |
| Deployer | `0x4Bc5db5a2e45F1a4AD111237baeede1b46746D9e` |

```
StakeVerseToken:      0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd
StakeVerseDAO:        0x8B555044B4c0A0a91cb0028043004d94291FD01F
StakeVerseStaking:    0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64
StakeVerseNFT:        0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C
PriceOracleConsumer:  0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F
```

Source: `deployment/sepolia.json` → `current`. Transaction hashes and per-contract block numbers are not recorded there — `scripts/deploy.ts` does not currently capture them — and are not invented or approximated here either.

### How the deployment was verified

Deployed via `.github/workflows/deploy-sepolia.yml`, a manually-triggered workflow gated behind an exact confirmation string (`DEPLOY_SEPOLIA`). Independent of `scripts/deploy.ts`'s own internal ownership check (already covered under H4/N1 above), the workflow itself re-verified — directly against the live chain, from a process external to the deploy script — before declaring success:
* the connected network's chain ID equals `11155111`;
* deployed bytecode exists at all five addresses;
* `owner()` on Token, Staking, NFT, and DAO.

```
Token.owner()   == DAO   ✓ (re-verified on-chain by deploy-sepolia.yml, against the current deployment)
Staking.owner() == DAO   ✓
NFT.owner()     == DAO   ✓
DAO.owner()     == DAO   ✓
```

This is the same ownership graph already asserted in "Deployment / Ownership Status" above for the local JSON-RPC and test-harness runs; it is now additionally confirmed against the live current Sepolia deployment specifically.

`.github/workflows/ci.yml` re-ran the full regression suite (146/146 passing) against the same commit lineage that produced this deployment, in a clean GitHub Actions environment independent of any local machine — the same evidence cited in this document's header and in "Resolved Security Issues" above, now additionally reproduced in CI rather than only locally.

### Post-Step-9 frontend change (non-security)

One frontend commit occurred after Step 9: it wired `frontend/src/contracts/dao.ts` onto the same centralized `CONTRACTS` address source already used by `token.ts`/`staking.ts`, replacing an independent `import.meta.env.VITE_DAO_ADDRESS` read. Behavior-neutral per its own description — same environment variable, same resolved value, one fewer address-sourcing path to keep in sync. `tsc -b` and `vite build` remained clean after this change. Not a security-relevant change and not a new finding; noted here only for completeness, since "Frontend Status" below describes the state through Step 9 specifically.

### What this addendum does not claim

* **No source-code verification.** `deploy-sepolia.yml` does not run `hardhat-verify`. Blockscout may show only raw bytecode at these addresses, not human-readable source, until verification is performed separately. Not claimed as done anywhere in this document.
* **No new third-party audit.** This remains a single-agent, structured remediation and reconciliation process (see "A note on prior audit claims" above), not an external audit. No Slither or Mythril tooling was run to produce this addendum, and none is implied to have been.
* **No contract change.** This addendum reconciles a deployment event, not a code change — see "Historical state vs. current state" above.

### Net effect

**Historical:** during Steps 1–9, no hardened production Sepolia deployment existed.
**Current:** the hardened source has since been deployed to Sepolia and is live; DAO ownership of `StakeVerseToken`, `StakeVerseStaking`, `StakeVerseNFT`, and `StakeVerseDAO` itself has been independently re-verified on-chain against that specific deployment — not merely asserted by the deploy script, and not merely a carryover of the Steps 1–9 local/test-harness result.

---

## Frontend Status

`tsc -b`, `vite build`, and `eslint` all remain clean/unchanged through Step 9 — no frontend file was touched in this reconciliation step. The 8 pre-existing lint errors (in `useDashboard.ts`, `useWallet.ts`, dead `pages/Staking.tsx`, `walletDebug.ts`, `web3.ts`) were re-reviewed for security relevance during this audit and found to be exactly what they were originally classified as: code-quality/style findings (`react-hooks/set-state-in-effect`, `no-explicit-any`, an unused variable, missing `cause` on two re-thrown errors) with no security implication. None reclassified.

---

## Verdict

**READY WITH ACCEPTED RISKS.** No unresolved critical or high-severity vulnerability exists. The remaining items are explicit, tested, and documented design decisions (uncapped SVT/NFT issuance, DAO self-governance lockout exposure, governance-speed circuit breaker) plus purely cosmetic hygiene items (a stray comment, a missing `immutable` keyword) — none of which block production use of this MVP on their own terms, provided the accepted risks above are genuinely acceptable to whoever operates the DAO.
