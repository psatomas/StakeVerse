type Props = {
  address?: string;
  connect: () => void;
};

export default function Navbar({
  address,
  connect,
}: Props) {
  return (
    <header className="relative z-10 border-b border-sv-border bg-sv-black-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sv-sm border border-sv-border-orange bg-sv-orange-500/10 text-sm font-semibold text-sv-orange-400"
          >
            SV
          </span>

          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-3">
              <a
                href="#"
                className="sv-text-label inline-block text-sv-text-muted transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:text-sv-orange-400"
              >
                ← Overview
              </a>
              <a
                href="#protocol"
                className="sv-text-label inline-block text-sv-text-muted transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:text-sv-orange-400"
              >
                Protocol
              </a>
            </div>
            <h1 className="sv-text-h1 text-sv-text-primary">
              StakeVerse Protocol
            </h1>
            <p className="sv-text-metadata mt-0.5">
              Decentralized Staking &amp; Governance Infrastructure
            </p>
          </div>
        </div>

        {address ? (
          /* CONNECTED STATE DISPLAY: Replaces the button to avoid double-triggering actions */
          <div className="flex shrink-0 items-center gap-3 rounded-sv-md border border-sv-border bg-sv-black-900 px-4 py-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sv-success" />
            <span className="sv-text-identifier whitespace-nowrap">
              {`${address.slice(0, 6)}...${address.slice(-4)}`}
            </span>
          </div>
        ) : (
          /* DISCONNECTED STATE DISPLAY: Click handles connection safely */
          <button
            onClick={connect}
            type="button"
            className="shrink-0 whitespace-nowrap rounded-sv-md border border-sv-orange-500 bg-sv-orange-500/10 px-4 py-2 text-sm font-medium text-sv-orange-400 transition-colors duration-[var(--sv-duration-base)] ease-[var(--sv-ease)] hover:bg-sv-orange-500/20 active:bg-sv-orange-500/25 sm:px-5"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
