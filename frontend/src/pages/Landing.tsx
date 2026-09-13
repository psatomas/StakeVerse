import { useEffect } from "react";
import LandingNav from "../components/landing/LandingNav";
import Hero from "../components/landing/Hero";
import ProtocolSystem from "../components/landing/ProtocolSystem";
import ValueFlow from "../components/landing/ValueFlow";
import GovernanceFlow from "../components/landing/GovernanceFlow";
import AuthorityModel from "../components/landing/AuthorityModel";
import SecurityInvariants from "../components/landing/SecurityInvariants";
import EngineeringEvidence from "../components/landing/EngineeringEvidence";
import TrustLimitations from "../components/landing/TrustLimitations";
import ExploreCTA from "../components/landing/ExploreCTA";

// The landing page explains the protocol; it never becomes a second
// dashboard. Every data point on it is either a static engineering fact
// (test counts, contract source, deployed addresses) or a description of
// contract behavior — nothing here reads live/wallet-gated state, so the
// page is fully legible without connecting a wallet.
export default function Landing() {
  // Bug fix: a direct load of e.g. "/#system" arrives before React has
  // rendered any element with that id, so the browser's own native
  // fragment-scroll (which only runs once, at parse time) has nothing to
  // scroll to and silently lands at the top instead. This performs that
  // same scroll manually, once, after the sections above exist — it does
  // not change the anchor/navigation model, just makes the existing one
  // work on first load the way it already works when clicked in-page.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#app") return;

    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <div className="sv-surface text-sv-text-primary">
      <LandingNav />

      <main className="relative z-10 mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
        <Hero />
        <ProtocolSystem />
        <ValueFlow />
        <GovernanceFlow />
        <AuthorityModel />
        <SecurityInvariants />
        <EngineeringEvidence />
        <TrustLimitations />
        <ExploreCTA />
      </main>

      <footer className="relative z-10 border-t border-sv-border">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="sv-text-metadata">
            StakeVerse — explanation, not a dashboard. See the{" "}
            <a href="#app" className="text-sv-orange-400 hover:text-sv-orange-300">
              application
            </a>{" "}
            to interact with it.
          </p>
        </div>
      </footer>
    </div>
  );
}
