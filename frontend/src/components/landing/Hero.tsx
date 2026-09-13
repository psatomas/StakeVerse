import { ARCHITECTURE_EDGES, ARCHITECTURE_NODES } from "./architectureData";

// A minimal, decorative foreshadowing of the real architecture diagram
// below — same node/edge geometry at low fidelity, not a duplicate
// interactive component and not generic cryptocurrency imagery.
function HeroGlyph() {
  return (
    <svg
      viewBox="0 0 960 480"
      aria-hidden="true"
      className="h-full w-full opacity-80"
    >
      {ARCHITECTURE_EDGES.map((edge) => {
        const a = ARCHITECTURE_NODES.find((n) => n.id === edge.from)!;
        const b = ARCHITECTURE_NODES.find((n) => n.id === edge.to)!;
        // Same kind-based tinting as the real diagram below, at low
        // fidelity: ownership reads warm/orange, the governance
        // (delegated voting) line reads yellow, the asset line stays
        // neutral — a quiet preview of the same distinction, not a
        // separate color scheme.
        const strokeClass =
          edge.kind === "ownership"
            ? "stroke-sv-orange-600"
            : edge.kind === "governance"
              ? "stroke-sv-yellow-500"
              : "stroke-sv-text-muted";
        return (
          <line
            key={`${edge.from}-${edge.to}-${edge.kind}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeWidth="1.5"
            className={`${strokeClass} opacity-70`}
          />
        );
      })}
      {ARCHITECTURE_NODES.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={node.id === "dao" ? 14 : 9}
          className={
            node.id === "dao"
              ? "fill-sv-orange-500"
              : node.group === "independent"
                ? "fill-sv-black-900 stroke-sv-border-strong"
                : "fill-sv-black-900 stroke-sv-orange-500/60"
          }
          strokeWidth={node.id === "dao" ? 0 : 1.5}
        />
      ))}
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="identity" className="scroll-mt-24 pt-6 sm:pt-10">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          <p className="sv-text-label text-sv-orange-400">StakeVerse</p>

          <h1 className="sv-text-display mt-4 text-4xl sm:text-5xl lg:text-6xl">
            Security-Hardened Governance
            <br />&amp; Staking Protocol
          </h1>

          <p className="sv-text-body mt-6 max-w-xl text-base sm:text-lg">
            StakeVerse is a DAO-governed staking and governance system on
            Ethereum: SVT holders delegate ERC20Votes voting power to govern a
            staking pool whose reward payouts are bounded by an explicitly
            funded reserve — deployed and independently ownership-verified on
            Sepolia.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#system"
              className="rounded-sv-md border border-sv-border-strong px-5 py-2.5 text-sm font-medium text-sv-text-primary transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:border-sv-orange-500 hover:text-sv-orange-400"
            >
              Explore the system ↓
            </a>
          </div>
        </div>

        <div className="mx-auto aspect-[2/1] w-full max-w-md lg:max-w-none">
          <HeroGlyph />
        </div>
      </div>
    </section>
  );
}
