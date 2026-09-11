import type { ReactNode } from "react";

type Tone = "orange" | "yellow" | "neutral";

type Props = {
  tone: Tone;
  /** Text label, not just a color — meaning must survive without color. */
  label: string;
  children: ReactNode;
};

const TONE_STYLES: Record<Tone, string> = {
  orange: "border-sv-border-orange/40 bg-sv-orange-500/5",
  yellow: "border-sv-border-yellow/40 bg-sv-yellow-400/5",
  neutral: "border-sv-border-strong bg-sv-black-850",
};

const TONE_LABEL_STYLES: Record<Tone, string> = {
  orange: "text-sv-orange-400",
  yellow: "text-sv-yellow-300",
  neutral: "text-sv-text-secondary",
};

// A single glyph per tone so the distinction never rests on color alone.
const TONE_GLYPH: Record<Tone, string> = {
  orange: "▣", // invariant / enforced property
  yellow: "▲", // signal / important distinction
  neutral: "□", // note
};

export default function Callout({ tone, label, children }: Props) {
  return (
    <div className={`rounded-sv-md border p-5 ${TONE_STYLES[tone]}`}>
      <p className={`sv-text-label flex items-center gap-2 ${TONE_LABEL_STYLES[tone]}`}>
        <span aria-hidden="true">{TONE_GLYPH[tone]}</span>
        {label}
      </p>
      <div className="sv-text-body mt-2 text-sv-text-primary/90">{children}</div>
    </div>
  );
}
