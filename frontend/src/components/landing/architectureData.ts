// Typed model of StakeVerse's real contract relationships, shared by the
// desktop graph and the mobile relationship list (ArchitectureDiagram.tsx) so
// the two presentations can never drift apart or contradict each other.
//
// Every relationship here is backed directly by contract source and the
// verified deployment record (see audit/SECURITY_AUDIT.md, "Architecture (as
// actually implemented)" and "Deployment / Ownership Status") — nothing is
// inferred or aspirational.

export type NodeId = "dao" | "token" | "staking" | "nft" | "oracle";

export interface ArchitectureNode {
  id: NodeId;
  name: string;
  contract: string;
  role: string;
  detail: string;
  /** "core" participates in the staking/governance execution path.
   * "independent" does not — drawn detached, matching the real
   * implementation (see PriceOracleConsumer / StakeVerseNFT). */
  group: "core" | "independent";
  /** Position in the shared 960×480 coordinate space the SVG and the HTML
   * node buttons both read from. */
  x: number;
  y: number;
}

export type EdgeKind = "ownership" | "governance" | "asset";

export interface ArchitectureEdge {
  from: NodeId;
  to: NodeId;
  kind: EdgeKind;
  label: string;
}

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: "dao",
    name: "StakeVerseDAO",
    contract: "StakeVerseDAO.sol",
    role: "Governance & authority",
    detail:
      "Owns StakeVerseToken, StakeVerseStaking and StakeVerseNFT — and owns itself. Proposal creation and voting are permissionless, gated only by historical voting power; executing a Succeeded proposal is permissionless too.",
    group: "core",
    x: 480,
    y: 235,
  },
  {
    id: "token",
    name: "StakeVerseToken",
    contract: "StakeVerseToken.sol",
    role: "ERC20Votes governance token (SVT)",
    detail:
      "Minting is DAO-only. Holding SVT grants zero voting power until the holder explicitly calls delegate() — voting power is never inferred from balance.",
    group: "core",
    x: 170,
    y: 100,
  },
  {
    id: "staking",
    name: "StakeVerseStaking",
    contract: "StakeVerseStaking.sol",
    role: "Staking & reward accounting",
    detail:
      "Accepts SVT as principal and accrues rewards against a reserve funded explicitly via fundRewards(). Claims are paid only out of that reserve — never out of staked principal.",
    group: "core",
    x: 790,
    y: 100,
  },
  {
    id: "nft",
    name: "StakeVerseNFT",
    contract: "StakeVerseNFT.sol",
    role: "Membership badge",
    detail:
      "An ERC721 minted by the DAO. It does not gate staking or governance — nothing else in the protocol reads NFT ownership or balance.",
    group: "independent",
    x: 170,
    y: 400,
  },
  {
    id: "oracle",
    name: "PriceOracleConsumer",
    contract: "PriceOracleConsumer.sol",
    role: "Chainlink ETH/USD reader",
    detail:
      "A standalone, unowned contract that validates and returns a price. It is not consumed by Staking or the DAO — no execution path in this protocol currently depends on it.",
    group: "independent",
    x: 790,
    y: 400,
  },
];

export const ARCHITECTURE_EDGES: ArchitectureEdge[] = [
  {
    from: "dao",
    to: "token",
    kind: "ownership",
    label: "owns — mint() is onlyOwner",
  },
  {
    from: "dao",
    to: "staking",
    kind: "ownership",
    label: "owns — fundRewards() / setRewardRate() / pause() are onlyOwner",
  },
  {
    from: "dao",
    to: "nft",
    kind: "ownership",
    label: "owns — mint() is onlyOwner",
  },
  {
    from: "token",
    to: "dao",
    kind: "governance",
    label: "delegated voting power (ERC20Votes, historical)",
  },
  {
    from: "token",
    to: "staking",
    kind: "asset",
    label: "SVT is the staking asset",
  },
];

export const EDGE_LEGEND: Array<{ kind: EdgeKind; label: string; dash?: string }> = [
  { kind: "ownership", label: "DAO administrative ownership (onlyOwner)" },
  { kind: "governance", label: "Delegated voting power (governance input)", dash: "1 5" },
  { kind: "asset", label: "Token used as an asset", dash: "2 5" },
];
