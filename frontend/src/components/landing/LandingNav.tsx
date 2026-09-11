const LINKS: Array<{ href: string; label: string }> = [
  { href: "#identity", label: "Identity" },
  { href: "#system", label: "System" },
  { href: "#value-flow", label: "Value Flow" },
  { href: "#governance", label: "Governance" },
  { href: "#authority", label: "Authority" },
  { href: "#invariants", label: "Security" },
  { href: "#evidence", label: "Evidence" },
  { href: "#trust", label: "Trust" },
  { href: "#explore", label: "Explore" },
];

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-sv-border bg-sv-black-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href="#identity" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sv-sm border border-sv-border-orange bg-sv-orange-500/10 text-xs font-semibold text-sv-orange-400"
          >
            SV
          </span>
          <span className="sv-text-h3 hidden text-sm sm:inline">StakeVerse</span>
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

        <a
          href="#protocol"
          className="shrink-0 whitespace-nowrap rounded-sv-md border border-sv-border-strong px-4 py-1.5 text-sm font-medium text-sv-text-primary transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:border-sv-orange-500 hover:text-sv-orange-400"
        >
          Protocol
        </a>

        <a
          href="#app"
          className="shrink-0 whitespace-nowrap rounded-sv-md border border-sv-orange-500 bg-sv-orange-500/10 px-4 py-1.5 text-sm font-medium text-sv-orange-400 transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:bg-sv-orange-500/20"
        >
          Launch App
        </a>
      </div>
    </header>
  );
}
