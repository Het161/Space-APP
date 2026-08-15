import Link from "next/link";

import { OrbitMark } from "@/components/orbit-mark";

const NAV = [
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="orbitWx home"
        >
          <OrbitMark className="size-7 text-accent" />
          <span className="font-display text-lg font-bold tracking-tight">
            orbit<span className="text-accent">Wx</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
