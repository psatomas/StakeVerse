import { useEffect, useRef, useState } from "react";

/**
 * Reveals an element once when it first scrolls into the viewport, then
 * stops observing. Drives the landing page's scroll-entrance motion
 * (SectionShell, FlowSequence, ArchitectureDiagram) so sections animate in
 * as a visitor scrolls to them, instead of every element fading in
 * simultaneously at page-mount time regardless of scroll position.
 *
 * Not used by the Dashboard: that page is short enough that a mount-time
 * reveal (the existing `sv-enter` primitive) is already the right fit and
 * is left untouched.
 */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver support: reveal immediately rather than
    // silently hiding content forever. Same codebase-wide
    // react-hooks/set-state-in-effect gap noted in useDashboard.ts et al.
    // — a deliberate synchronous fallback, not an oversight.
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}
