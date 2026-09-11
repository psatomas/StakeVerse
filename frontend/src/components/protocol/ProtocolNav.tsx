const LINKS: Array<{ href: string; label: string }> = [
  { href: "#protocol-identity", label: "Identity" },
  { href: "#protocol-contracts", label: "Contracts" },
  { href: "#protocol-state", label: "Live State" },
  { href: "#protocol-proposals", label: "Proposals" },
  { href: "#protocol-authority", label: "Authority" },
  { href: "#protocol-security", label: "Security" },
  { href: "#protocol-evidence", label: "Evidence" },
];

// Same structure as LandingNav — a sticky bar with in-page section anchors
// — but Protocol sits between the other two screens, so it links back to
// both instead of only forward to one.
export default function ProtocolNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-sv-border bg-sv-black-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href="#protocol-identity" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sv-sm border border-sv-border-orange bg-sv-orange-500/10 text-xs font-semibold text-sv-orange-400"
          >
            SV
          </span>
          <span className="sv-text-h3 hidden text-sm sm:inline">Protocol</span>
        </a>

        <nav
          aria-label="Section navigation"
          className="flex min-w-0 flex-1 gap-x-5 overflow-x-auto whitespace-nowrap"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="sv-text-label shrink-0 py-1 text-sv-text-secondary transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:text-sv-orange-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <a
            href="#"
            className="sv-text-label whitespace-nowrap text-sv-text-muted transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:text-sv-orange-400"
          >
            ← Overview
          </a>
          <a
            href="#app"
            className="whitespace-nowrap rounded-sv-md border border-sv-orange-500 bg-sv-orange-500/10 px-4 py-1.5 text-sm font-medium text-sv-orange-400 transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:bg-sv-orange-500/20"
          >
            Launch App
          </a>
        </div>
      </div>
    </header>
  );
}
