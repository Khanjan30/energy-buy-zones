"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import ThemeToggle from "./ThemeToggle";
import { useHoldings, useWatchlist } from "@/lib/store";
import { money } from "@/lib/format";

const NAV = [
  ["Research", [["/", "Overview", "overview"], ["/screener/", "Screener", "screener"], ["/compare/", "Compare", "compare"]]],
  ["Yours", [["/portfolio/", "Portfolio", "portfolio"], ["/watchlist/", "Watchlist", "watch"]]],
  ["The model", [["/events/", "Event log", "events"], ["/backtest/", "Backtest", "backtest"], ["/method/", "How it works", "method"]]],
];

function Palette({ stocks, onClose }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  const pages = NAV.flatMap(([, items]) => items).map(([href, label]) => ({ kind: "page", href, label }));
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const st = stocks
      .filter((s) => !n || s.ticker.toLowerCase().startsWith(n) || s.name.toLowerCase().includes(n))
      .sort((a, b) => (a.ticker.toLowerCase() === n ? -1 : b.ticker.toLowerCase() === n ? 1 : 0))
      .slice(0, 8)
      .map((s) => ({ kind: "stock", href: `/stock/${s.ticker}/`, ...s }));
    const pg = pages.filter((p) => n && p.label.toLowerCase().includes(n));
    return [...st, ...pg];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, stocks]);

  function go(r) {
    if (!r) return;
    onClose();
    router.push(r.href);
  }
  function key(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter") go(results[sel]);
    if (e.key === "Escape") onClose();
  }
  return (
    <div className="cp-back" onMouseDown={onClose}>
      <div className="cp" role="dialog" aria-label="Search stocks and pages" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={key} placeholder="Search a ticker, company or page" aria-label="Search" />
        <div className="cp-list">
          {results.length === 0 && <div className="empty small">No match. Try a ticker like VST or a name like Cameco.</div>}
          {results.map((r, i) => (
            <button key={r.href} className={`cp-item ${i === sel ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
              {r.kind === "stock" ? (
                <>
                  <span className="ticker">{r.ticker}</span>
                  <span className="name" style={{ maxWidth: "none" }}>{r.name}</span>
                  <span className="small muted num">{money(r.price)}</span>
                </>
              ) : (
                <>
                  <span className="faint small">Page</span>
                  <span>{r.label}</span>
                  <span />
                </>
              )}
            </button>
          ))}
        </div>
        <div className="cp-hint">Use the arrow keys to move, Enter to open, Esc to close.</div>
      </div>
    </div>
  );
}

export default function Shell({ stocks, asof, children }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  const watch = useWatchlist();
  const holdings = useHoldings();

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) { e.preventDefault(); setOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = { "/watchlist/": watch.ready ? watch.list.length : null, "/portfolio/": holdings.ready ? holdings.list.length : null };
  const isOn = (href) => (href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(href));

  return (
    <div className="app">
      <aside className="rail">
        <Link href="/" className="rail-brand"><span className="rail-mark" aria-hidden>{Icon.bolt}</span><span>Energy Buy Zones</span></Link>
        {NAV.map(([title, items]) => (
          <nav className="rail-group" key={title} aria-label={title}>
            <div className="rail-title">{title}</div>
            {items.map(([href, label, icon]) => (
              <Link key={href} href={href} className={`rail-link ${isOn(href) ? "on" : ""}`}>
                {Icon[icon]}
                {label}
                {counts[href] ? <span className="rail-count">{counts[href]}</span> : null}
              </Link>
            ))}
          </nav>
        ))}
        <div className="rail-foot">
          {asof ? <><span className="fresh" aria-hidden />Prices from {asof}. Rescored every weekday after the market closes.</> : "Waiting for the first data run."}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="search-btn" onClick={() => setOpen(true)} aria-label="Search stocks">
            {Icon.search}
            <span>Search stocks and pages</span>
            <span className="kbd">{mac ? "⌘ K" : "Ctrl K"}</span>
          </button>
          <div className="topbar-right"><ThemeToggle /></div>
        </header>
        <div className="content">{children}</div>
      </div>
      {open && <Palette stocks={stocks} onClose={() => setOpen(false)} />}
    </div>
  );
}
