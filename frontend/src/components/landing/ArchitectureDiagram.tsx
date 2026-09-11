import { useId, useState } from "react";

import { useInView } from "../../hooks/useInView";
import {
  ARCHITECTURE_EDGES,
  ARCHITECTURE_NODES,
  EDGE_LEGEND,
  type ArchitectureEdge,
  type EdgeKind,
  type NodeId,
} from "./architectureData";

const VIEW_W = 960;
const VIEW_H = 480;

// Bounding frame around the DAO/Token/Staking trio — the actual
// staking+governance execution path — so "this is the core system" reads
// at a glance instead of only being implied by node position. Computed by
// hand from the three nodes' coordinates in architectureData.ts plus a
// margin; NFT/Oracle (at y=400) sit outside it, matching their real,
// independent status.
const CORE_FRAME = { x: 70, y: 35, width: 820, height: 300 };

function nodeById(id: NodeId) {
  return ARCHITECTURE_NODES.find((n) => n.id === id)!;
}

function edgeDash(edge: ArchitectureEdge): string | undefined {
  return EDGE_LEGEND.find((l) => l.kind === edge.kind)?.dash;
}

function edgePath(edge: ArchitectureEdge): string {
  const a = nodeById(edge.from);
  const b = nodeById(edge.to);

  // Ownership edges are drawn straight. The governance edge (token → dao)
  // shares its two endpoints with the dao → token ownership edge, so it is
  // curved away from the straight line — otherwise the two directions would
  // draw exactly on top of each other and the direction would be
  // unreadable.
  if (edge.kind === "governance") {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 46;
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  }

  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

// Persistent (non-hover) styling per relationship kind — the ownership vs.
// delegation vs. asset distinction has to read before anyone interacts
// with the diagram, not only after. Orange = authority (ownership),
// yellow = signal (the governance/voting input), neutral = a plain
// structural fact (the asset relationship).
const RESTING_STROKE: Record<EdgeKind, string> = {
  ownership: "stroke-sv-orange-600",
  governance: "stroke-sv-yellow-500",
  asset: "stroke-sv-text-muted",
};

const RESTING_OPACITY: Record<EdgeKind, string> = {
  ownership: "opacity-70",
  governance: "opacity-60",
  asset: "opacity-60",
};

const ACTIVE_STROKE: Record<EdgeKind, string> = {
  ownership: "stroke-sv-orange-400",
  governance: "stroke-sv-yellow-300",
  asset: "stroke-sv-orange-300",
};

const MARKER_BY_KIND_STATE: Record<string, string> = {
  "ownership-rest": "sv-arrow-ownership-rest",
  "ownership-active": "sv-arrow-ownership-active",
  "governance-rest": "sv-arrow-governance-rest",
  "governance-active": "sv-arrow-governance-active",
};

export default function ArchitectureDiagram() {
  const [active, setActive] = useState<NodeId | null>(null);
  const [wrapperRef, inView] = useInView<HTMLDivElement>(0.2);
  const descriptionId = useId();

  const activeNode = active ? nodeById(active) : null;

  function isEdgeHighlighted(edge: ArchitectureEdge) {
    return active !== null && (edge.from === active || edge.to === active);
  }

  return (
    <div ref={wrapperRef}>
      {/* Desktop / tablet: the actual relationship graph. */}
      <div className="hidden md:block">
        <div className="relative aspect-[2/1] w-full">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              {(
                [
                  ["sv-arrow-ownership-rest", "fill-sv-orange-600"],
                  ["sv-arrow-ownership-active", "fill-sv-orange-400"],
                  ["sv-arrow-governance-rest", "fill-sv-yellow-500"],
                  ["sv-arrow-governance-active", "fill-sv-yellow-300"],
                ] as const
              ).map(([id, fillClass]) => (
                <marker
                  key={id}
                  id={id}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  {/* One marker per relationship kind × state, so the
                      arrowhead always matches its edge's own resting or
                      highlighted color instead of a single fixed color. */}
                  <path d="M0,0 L10,5 L0,10 z" className={fillClass} />
                </marker>
              ))}
            </defs>

            {/* Core-system boundary: DAO + Token + Staking are the actual
                execution path; drawing this first keeps it behind every
                edge/node. */}
            <rect
              x={CORE_FRAME.x}
              y={CORE_FRAME.y}
              width={CORE_FRAME.width}
              height={CORE_FRAME.height}
              rx={20}
              fill="none"
              strokeWidth={1}
              strokeDasharray="3 6"
              className={`stroke-sv-border-strong transition-opacity duration-[var(--sv-duration-slow)] ease-[var(--sv-ease)] ${
                inView ? "opacity-60" : "opacity-0"
              }`}
            />

            {ARCHITECTURE_EDGES.map((edge, i) => {
              const highlighted = isEdgeHighlighted(edge);
              const dash = edgeDash(edge);
              const markerKey = `${edge.kind}-${highlighted ? "active" : "rest"}`;
              const marker = MARKER_BY_KIND_STATE[markerKey];

              // Exactly one opacity utility, chosen in priority order:
              // not yet revealed (0) > highlighted (full) > resting (its
              // own per-kind opacity). Never combine two opacity-* classes
              // on the same element — Tailwind won't merge them.
              const opacityClass = !inView
                ? "opacity-0"
                : highlighted
                  ? "opacity-100"
                  : RESTING_OPACITY[edge.kind];

              return (
                <path
                  key={`${edge.from}-${edge.to}-${edge.kind}`}
                  d={edgePath(edge)}
                  fill="none"
                  strokeWidth={highlighted ? 3 : edge.kind === "asset" ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  markerEnd={
                    edge.kind !== "asset" && marker ? `url(#${marker})` : undefined
                  }
                  style={{ transitionDelay: inView ? `${i * 70}ms` : "0ms" }}
                  className={`transition-all duration-[var(--sv-duration-slow)] ease-[var(--sv-ease)] ${opacityClass} ${
                    highlighted ? ACTIVE_STROKE[edge.kind] : RESTING_STROKE[edge.kind]
                  }`}
                />
              );
            })}
          </svg>

          {/* Core-system label, sitting on the frame's top edge. */}
          <span
            aria-hidden="true"
            className={`sv-text-label absolute text-sv-text-muted transition-opacity duration-[var(--sv-duration-slow)] ease-[var(--sv-ease)] ${
              inView ? "opacity-100" : "opacity-0"
            }`}
            style={{
              left: `${(CORE_FRAME.x / VIEW_W) * 100}%`,
              top: `${(CORE_FRAME.y / VIEW_H) * 100}%`,
              transform: "translateY(-140%)",
            }}
          >
            Core execution path
          </span>

          {ARCHITECTURE_NODES.map((node) => {
            const isActive = active === node.id;
            const dimmed = active !== null && !isActive;
            const isDao = node.id === "dao";

            return (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setActive(node.id)}
                onFocus={() => setActive(node.id)}
                onMouseLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((cur) => (cur === node.id ? null : node.id))}
                aria-describedby={descriptionId}
                aria-pressed={isActive}
                style={{
                  left: `${(node.x / VIEW_W) * 100}%`,
                  top: `${(node.y / VIEW_H) * 100}%`,
                }}
                className={`absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-sv-md border px-4 py-3 text-left transition-all duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] focus-visible:outline-2 focus-visible:outline-sv-orange-500 ${
                  isDao && inView ? "sv-signal-once" : ""
                } ${
                  node.group === "independent"
                    ? "border-dashed border-sv-border-strong bg-sv-black-900/80"
                    : isDao
                      ? "border-sv-border-orange/50 bg-sv-orange-500/10"
                      : "border-sv-border-strong bg-sv-black-900"
                } ${
                  isActive
                    ? "border-sv-orange-500 bg-sv-orange-500/15"
                    : dimmed
                      ? "opacity-50"
                      : "opacity-100"
                }`}
              >
                <p className={`sv-text-h3 text-sm ${isDao ? "text-sv-orange-300" : ""}`}>
                  {node.name}
                </p>
                <p className="sv-text-metadata mt-0.5">{node.role}</p>
                {node.group === "independent" && (
                  <p className="sv-text-label mt-1.5 text-sv-text-muted">Independent</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend: line style carries the meaning, not just color. */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {EDGE_LEGEND.map((item) => (
            <div key={item.kind} className="flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  strokeWidth="2.5"
                  strokeDasharray={item.dash}
                  className={`${RESTING_STROKE[item.kind]} opacity-90`}
                />
              </svg>
              <span className="sv-text-metadata">{item.label}</span>
            </div>
          ))}
        </div>

        <p
          id={descriptionId}
          aria-live="polite"
          className="sv-text-body mt-6 min-h-[3.5rem] max-w-2xl rounded-sv-md border border-sv-border bg-sv-black-950 p-4 text-sm"
        >
          {activeNode ? (
            <>
              <span className="sv-text-identifier text-sv-orange-400">
                {activeNode.contract}
              </span>
              {" — "}
              {activeNode.detail}
            </>
          ) : (
            "Hover or focus a component to see its role and its real relationships."
          )}
        </p>
      </div>

      {/* Mobile: the same typed relationships, as a structured vertical
          sequence rather than a scaled-down graph. */}
      <div className="space-y-3 md:hidden">
        <p className="sv-text-label text-sv-text-muted">Core execution path</p>

        {ARCHITECTURE_NODES.filter((n) => n.group === "core").map((node) => (
          <div
            key={node.id}
            className={`rounded-sv-md border p-4 ${
              node.id === "dao"
                ? "border-sv-border-orange/50 bg-sv-orange-500/10"
                : "border-sv-border bg-sv-black-900"
            }`}
          >
            <p className={`sv-text-h3 text-sm ${node.id === "dao" ? "text-sv-orange-300" : ""}`}>
              {node.name}
            </p>
            <p className="sv-text-metadata mt-0.5">{node.role}</p>
            <p className="sv-text-body mt-2 text-sm">{node.detail}</p>
          </div>
        ))}

        <p className="sv-text-label mt-6 text-sv-text-muted">
          Independent components — no execution-path dependency
        </p>

        {ARCHITECTURE_NODES.filter((n) => n.group === "independent").map((node) => (
          <div
            key={node.id}
            className="rounded-sv-md border border-dashed border-sv-border-strong bg-sv-black-900/80 p-4"
          >
            <p className="sv-text-h3 text-sm">{node.name}</p>
            <p className="sv-text-metadata mt-0.5">{node.role}</p>
            <p className="sv-text-body mt-2 text-sm">{node.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
