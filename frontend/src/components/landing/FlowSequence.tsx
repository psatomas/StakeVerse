import { useInView } from "../../hooks/useInView";

export interface FlowStepData {
  id: string;
  title: string;
  description: string;
  /** A short, real code/parameter fragment rendered in the technical/mono
   * treatment — never prose. */
  technical?: string;
  /** Governance only: marks a state-transition moment (the system's
   * recorded state actually changes here) rather than a plain user action.
   * Rendered with a filled node marker instead of an outline one. */
  checkpoint?: boolean;
  /** Governance only: the one meaningful "signal" step — gets the
   * persistent yellow accent and a one-shot activation pulse when the
   * sequence scrolls into view. At most one step should set this. */
  signal?: boolean;
}

type Props = {
  steps: FlowStepData[];
  /** "value" reads as a continuous pipeline (financial/accounting state,
   * orange = flow). "governance" reads as a state machine (checkpoints and
   * a signaled transition), not a value pipeline. Same underlying
   * component, deliberately different presentation. */
  variant: "value" | "governance";
};

export default function FlowSequence({ steps, variant }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const isGovernance = variant === "governance";

  return (
    <div ref={ref} className={`sv-reveal ${inView ? "sv-revealed" : ""}`}>
      {!isGovernance && (
        // Value flow: one continuous rail above the row. The orange fill
        // sweeping left-to-right on reveal is the "value moving through
        // the system" visual — a single motion for the whole sequence,
        // not five independent ones.
        <div aria-hidden="true" className="relative mb-6 h-px bg-sv-border">
          <div
            className={`absolute inset-y-0 left-0 origin-left bg-sv-orange-500 transition-transform duration-[var(--sv-duration-slow)] ease-[var(--sv-ease)] ${
              inView ? "scale-x-100" : "scale-x-0"
            }`}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <ol
        className={`flex flex-col md:flex-row md:items-stretch ${
          isGovernance ? "gap-0 pt-6 md:pt-8" : "gap-0"
        }`}
      >
        {steps.map((step, i) => {
          const nextIsSignal = steps[i + 1]?.signal === true;

          return (
            <li
              key={step.id}
              className="relative flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch"
            >
              {isGovernance && (
                // A state-machine node marker overlapping the card's top
                // edge: outline for a plain action, filled orange for a
                // checkpoint (the recorded state actually changes here),
                // filled yellow for the signal step (Execute).
                <span
                  aria-hidden="true"
                  className={`absolute -top-3 left-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[0.6875rem] md:-top-4 ${
                    step.signal
                      ? "border-sv-yellow-400 bg-sv-yellow-400 text-sv-black-950"
                      : step.checkpoint
                        ? "border-sv-orange-500 bg-sv-orange-500 text-sv-black-950"
                        : "border-sv-border-strong bg-sv-black-900 text-sv-text-muted"
                  }`}
                >
                  {i + 1}
                </span>
              )}

              <div
                className={`min-w-0 flex-1 rounded-sv-lg border p-5 ${
                  step.signal
                    ? "border-sv-border-yellow/50 bg-sv-yellow-400/5"
                    : isGovernance
                      ? "border-sv-border bg-sv-black-900"
                      : i === steps.length - 1
                        ? "border-sv-border-orange/40 bg-sv-orange-500/5"
                        : "border-sv-border bg-sv-black-900"
                }`}
              >
                {!isGovernance && (
                  <p className="sv-text-label text-sv-text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                )}
                <h3 className={`sv-text-h3 ${isGovernance ? "mt-1" : "mt-2"}`}>
                  {step.title}
                </h3>
                <p className="sv-text-body mt-2 text-sm">{step.description}</p>
                {step.technical && (
                  <p
                    className={`sv-text-identifier mt-3 ${
                      step.signal ? "text-sv-yellow-300" : "text-sv-orange-400"
                    }`}
                  >
                    {step.technical}
                  </p>
                )}
              </div>

              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`flex shrink-0 items-center justify-center px-1 py-2 md:px-3 md:py-0 ${
                    isGovernance && nextIsSignal
                      ? "text-sv-yellow-300"
                      : "text-sv-text-muted"
                  }`}
                >
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">
                    {isGovernance ? (nextIsSignal ? "⇒" : "–") : "→"}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
