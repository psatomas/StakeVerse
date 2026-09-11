import type { ReactNode } from "react";

import { useInView } from "../../hooks/useInView";

type Props = {
  id: string;
  index: string;
  kicker: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

// Shared scaffold for every landing-page section: a numbered kicker, a
// heading, an optional lede, and a content slot. Keeps the "guided tour
// through a protocol" numbering consistent without repeating the same
// heading markup in every section component.
//
// Reveals itself once as it scrolls into view (see useInView) rather than
// animating at page-mount time — the whole section moves together as one
// unit; internal components (FlowSequence, ArchitectureDiagram) layer
// their own, more specific motion on top of this.
export default function SectionShell({
  id,
  index,
  kicker,
  title,
  description,
  children,
}: Props) {
  const [ref, inView] = useInView<HTMLElement>(0.1);

  return (
    <section
      ref={ref}
      id={id}
      className={`scroll-mt-24 border-t border-sv-border pt-14 sv-reveal ${inView ? "sv-revealed" : ""}`}
    >
      <div className="flex items-baseline gap-4">
        <span className="sv-text-identifier text-sv-text-muted">{index}</span>
        <p className="sv-text-label text-sv-orange-400">{kicker}</p>
      </div>

      <h2 className="sv-text-display mt-3 max-w-3xl text-3xl sm:text-4xl">{title}</h2>

      {description && (
        <p className="sv-text-body mt-4 max-w-2xl text-base">{description}</p>
      )}

      <div className="mt-10">{children}</div>
    </section>
  );
}
