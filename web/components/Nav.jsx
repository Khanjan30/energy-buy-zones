"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  ["/", "Dashboard"],
  ["/events/", "Events"],
  ["/backtest/", "Backtest"],
  ["/method/", "Method"],
];

export default function Nav() {
  const path = usePathname() || "/";
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>⚡</span>
          Energy Buy Zones
        </Link>
        <nav className="nav">
          {LINKS.map(([href, label]) => {
            const on = href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(href);
            return (
              <Link key={href} href={href} className={on ? "active" : ""}>
                {label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
