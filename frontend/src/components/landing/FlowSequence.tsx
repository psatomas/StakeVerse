import { useLayoutEffect, useRef } from "react";

import { useInView } from "../../hooks/useInView";

export interface FlowStepData {
  id: string;
  title: string;
  description: string;
  /** A short, real code/parameter fragment rendered as a compact monospace
   * annotation — subordinate to the prose, never a second paragraph. */
  technical?: string;
  /** Governance only: marks a state-transition moment (the system's
   * recorded state actually changes here) rather than a plain user action.
   * Rendered with a filled node marker instead of an outline one. */
  checkpoint?: boolean;
  /** Governance only: the one meaningful "signal" step — gets the
   * persistent yellow accent. At most one step should set this. */
  signal?: boolean;
}

type Props = {
  steps: FlowStepData[];
  /** "value" reads as a continuous pipeline (financial/accounting state,
   * orange = flow) and stays a single row down to the desktop breakpoint.
   * "governance" reads as a state machine — a wider grid of checkpoint
   * nodes that wraps onto more than one row once it has the room, rather
   * than squeezing six steps into one cramped line. Same card language,
   * deliberately different composition. */
  variant: "value" | "governance";
};

// Every card in a section shares the same border/radius/padding and an
// internal flex-column layout: number/title and body sit at their natural
// height, and the technical reference (when present) is pushed to the
// bottom via margin-top:auto — so short and long steps still line up
// title-to-title and reference-to-reference once useEqualCardHeight below
// gives them a common height.
const CARD_BASE = "flex h-full min-w-0 flex-col rounded-sv-lg border p-4 sm:p-5";

/**
 * Measures the natural (unconstrained) height of every registered card and
 * applies the tallest one as a shared min-height to all of them, so every
 * step within one FlowSequence reads as the same box geometry — driven by
 * whatever the longest real content actually needs, never a fixed or
 * arbitrary value, and never something that could clip. Re-measures on
 * resize (a breakpoint change reflows text, which can change which card is
 * tallest) and once webfonts finish loading.
 *
 * Scoped per FlowSequence instance: ValueFlow and GovernanceFlow each call
 * this separately, so the two sections are never forced to match each
 * other — only the steps within one section are.
 */
function useEqualCardHeight(count: number) {
  const nodesRef = useRef<Array<HTMLDivElement | null>>([]);

  useLayoutEffect(() => {
    function measure() {
      const nodes = nodesRef.current.filter((n): n is HTMLDivElement => n !== null);
      if (nodes.length < 2) return;

      // Clear first so a stale, too-tall value from a wider viewport never
      // locks in and silently overflows at a narrower one.
      nodes.forEach((n) => {
        n.style.minHeight = "0px";
      });
      const max = Math.max(...nodes.map((n) => n.getBoundingClientRect().height));
      nodes.forEach((n) => {
        n.style.minHeight = `${max}px`;
      });
    }

    measure();

    let raf = 0;
    function onResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }

    window.addEventListener("resize", onResize);
    if (document.fonts) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [count]);

  return nodesRef;
}

function TechnicalLine({ text, signal }: { text: string; signal?: boolean }) {
  return (
    <p className="mt-auto pt-3">
      <code
        className={`font-mono text-[0.75rem] opacity-80 ${
          signal ? "text-sv-yellow-300" : "text-sv-orange-400"
        }`}
      >
        {text}
      </code>
    </p>
  );
}

function ValueCard({
  step,
  index,
  isLast,
  cardRef,
}: {
  step: FlowStepData;
  index: number;
  isLast: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      className={`${CARD_BASE} ${
        isLast ? "border-sv-border-orange/40 bg-sv-orange-500/5" : "border-sv-border bg-sv-black-900"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="sv-text-label text-sv-text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="sv-text-h3">{step.title}</h3>
      </div>
      <p className="sv-text-body mt-2 text-sm leading-relaxed">{step.description}</p>
      {step.technical && <TechnicalLine text={step.technical} />}
    </div>
  );
}

function GovernanceCard({
  step,
  index,
  cardRef,
}: {
  step: FlowStepData;
  index: number;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="relative flex h-full flex-col pt-3">
      {/* A state-machine node marker overlapping the card's top edge:
          outline for a plain action, filled orange for a checkpoint (the
          recorded state actually changes here), filled yellow for the
          signal step (Execute). This is the step's one deliberate number —
          nothing else in the card repeats it. */}
      <span
        aria-hidden="true"
        className={`absolute left-5 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[0.6875rem] ${
          step.signal
            ? "border-sv-yellow-400 bg-sv-yellow-400 text-sv-black-950"
            : step.checkpoint
              ? "border-sv-orange-500 bg-sv-orange-500 text-sv-black-950"
              : "border-sv-border-strong bg-sv-black-900 text-sv-text-muted"
        }`}
      >
        {index + 1}
      </span>

      <div
        ref={cardRef}
        className={`${CARD_BASE} ${
          step.signal ? "border-sv-border-yellow/50 bg-sv-yellow-400/5" : "border-sv-border bg-sv-black-900"
        }`}
      >
        <h3 className="sv-text-h3">{step.title}</h3>
        <p className="sv-text-body mt-2 text-sm leading-relaxed">{step.description}</p>
        {step.technical && <TechnicalLine text={step.technical} signal={step.signal} />}
      </div>
    </div>
  );
}

export default function FlowSequence({ steps, variant }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const cardNodes = useEqualCardHeight(steps.length);
  const isGovernance = variant === "governance";

  if (isGovernance) {
    return (
      <div ref={ref} className={`sv-reveal ${inView ? "sv-revealed" : ""}`}>
        {/* A grid, not a single cramped row: six state-machine nodes get
            real width to breathe, wrapping 3-then-3 once there's room
            instead of forcing every step into an identical, too-narrow
            column. Sequence is carried by the numbered node markers and
            checkpoint/signal coloring — not by an arrow between every
            cell, which would be spatially meaningless across a row wrap. */}
        <ol className="grid list-none grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
          {steps.map((step, i) => {
            const nextIsSignal = steps[i + 1]?.signal === true;
            return (
              <li key={step.id} className="flex flex-col">
                <GovernanceCard
                  step={step}
                  index={i}
                  cardRef={(el) => {
                    cardNodes.current[i] = el;
                  }}
                />
                {/* Only meaningful on true single-column mobile, where
                    "next step" is unambiguous — a grid wrap has no single
                    correct arrow direction, so none is drawn there. */}
                {i < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`flex items-center justify-center py-2 sm:hidden ${
                      nextIsSignal ? "text-sv-yellow-300" : "text-sv-text-muted"
                    }`}
                  >
                    ↓
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div ref={ref} className={`sv-reveal ${inView ? "sv-revealed" : ""}`}>
      {/* Value flow: one continuous rail above the row. The orange fill
          sweeping left-to-right on reveal is the "value moving through
          the system" visual — a single motion for the whole sequence, not
          five independent ones. */}
      <div aria-hidden="true" className="relative mb-6 h-px bg-sv-border xl:-mx-8">
        <div
          className={`absolute inset-y-0 left-0 w-full origin-left bg-sv-orange-500 transition-transform duration-[var(--sv-duration-slow)] ease-[var(--sv-ease)] ${
            inView ? "scale-x-100" : "scale-x-0"
          }`}
        />
      </div>

      <ol className="flex list-none flex-col gap-6 xl:-mx-8 xl:flex-row xl:items-stretch xl:gap-0">
        {steps.map((step, i) => (
          <li key={step.id} className="flex min-w-0 flex-1 flex-col xl:flex-row xl:items-stretch">
            <ValueCard
              step={step}
              index={i}
              isLast={i === steps.length - 1}
              cardRef={(el) => {
                cardNodes.current[i] = el;
              }}
            />

            {i < steps.length - 1 && (
              <div
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center py-1 text-sv-orange-500/70 xl:px-2 xl:py-0"
              >
                <span className="xl:hidden">↓</span>
                <span className="hidden xl:inline">→</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
