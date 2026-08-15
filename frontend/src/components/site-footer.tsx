import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-hairline">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-sm font-semibold">
            orbit<span className="text-accent">Wx</span>
          </p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-faint">
            Historical weather probabilities from NASA Earth observation data.
            Climatology, not a forecast.
          </p>
        </div>

        <div className="text-xs text-ink-faint">
          <p className="mb-2 font-medium text-ink-muted">Data</p>
          <p className="leading-relaxed">
            Data obtained from the NASA Langley Research Center (LaRC){" "}
            <a
              href="https://power.larc.nasa.gov/"
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              POWER Project
            </a>
            , funded through the NASA Earth Science/Applied Science Program.
          </p>
        </div>

        <div className="text-xs text-ink-faint">
          <p className="mb-2 font-medium text-ink-muted">Built by</p>
          <p className="leading-relaxed">
            Team Coders — Het Patel for the{" "}
            <a
              href="https://www.spaceappschallenge.org/2025/challenges/will-it-rain-on-my-parade/"
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              NASA Space Apps Challenge 2025
            </a>
            .
          </p>
          <div className="mt-3 flex gap-4">
            <a
              href="https://buildbyhet.me"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              buildbyhet.me
            </a>
            <a
              href="https://github.com/Het161"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              GitHub
            </a>
            <Link href="/methodology" className="hover:text-accent">
              Methodology
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
