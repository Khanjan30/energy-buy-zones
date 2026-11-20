"use client";
import Link from "next/link";
import { useState } from "react";
import WatchStar from "./WatchStar";
import { Icon } from "./Icons";
import { useHoldings } from "@/lib/store";
import { money } from "@/lib/format";

export default function StockActions({ ticker, price, peers }) {
  const h = useHoldings();
  const own = h.ready ? h.list.find((x) => x.ticker === ticker) : null;
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState(price ? String(price) : "");
  const [done, setDone] = useState("");

  function save(e) {
    e.preventDefault();
    const s = Number(shares), c = Number(cost);
    if (!(s > 0) || !(c >= 0)) return;
    h.upsert({ ticker, shares: s, cost: c });
    setOpen(false);
    setDone(`Saved ${s} shares of ${ticker} to your portfolio.`);
  }
  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ gap: 8 }}>
        <WatchStar ticker={ticker} withLabel />
        <button className={`btn ${own ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {Icon.portfolio}{own ? `You own ${own.shares}` : "Add to portfolio"}
        </button>
        <Link className="btn" href={`/compare/?t=${[ticker, ...peers].slice(0, 4).join(",")}`}>{Icon.compare}Compare with peers</Link>
      </div>
      {open && (
        <form onSubmit={save} className="panel" style={{ position: "absolute", right: 0, top: 44, zIndex: 10, width: 300, boxShadow: "0 12px 32px rgba(14,42,59,.18)" }}>
          <div className="stack" style={{ gap: 10 }}>
            <label className="field">Shares<input className="input" type="number" step="any" min="0" value={shares} onChange={(e) => setShares(e.target.value)} autoFocus /></label>
            <label className="field">Average price paid<input className="input" type="number" step="any" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="tiny faint">Today {money(price)}</span>
              <button className="btn primary sm" type="submit">Save holding</button>
            </div>
          </div>
        </form>
      )}
      {done && <p className="small muted" role="status" style={{ marginTop: 6, textAlign: "right" }}>{done} <Link href="/portfolio/">Open portfolio</Link></p>}
    </div>
  );
}
