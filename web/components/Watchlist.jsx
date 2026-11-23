"use client";
import Link from "next/link";
import { useState } from "react";
import ActionTag from "./ActionTag";
import MiniRange from "./MiniRange";
import Sparkline from "./Sparkline";
import WatchStar from "./WatchStar";
import { useWatchlist } from "@/lib/store";
import { money, num, pct } from "@/lib/format";
import { goodRange, priceCheck } from "@/lib/plain";

function PasteBox({ stocks, onAdd }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const known = new Set(stocks.map((s) => s.ticker));
  function add(e) {
    e.preventDefault();
    const ts = [...new Set(text.toUpperCase().split(/[^A-Z.]+/).filter(Boolean))];
    const ok = ts.filter((t) => known.has(t)), skip = ts.filter((t) => !known.has(t));
    onAdd(ok);
    setText("");
    setMsg(`Added ${ok.length} ${ok.length === 1 ? "stock" : "stocks"}.${skip.length ? ` Skipped ${skip.join(", ")}: not in the energy model.` : ""}`);
  }
  return (
    <form className="panel" onSubmit={add}>
      <div className="panel-head"><h2>Add several at once</h2><span className="small faint">Tickers separated by commas or spaces</span></div>
      <div className="row">
        <input className="input" style={{ flex: 1, minWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="FLNC, STDN, GEV, CEG, VST, NGG" aria-label="Tickers to add" />
        <button className="btn primary" type="submit">Add to watchlist</button>
      </div>
      {msg && <p className="small muted" style={{ marginTop: 8 }} role="status">{msg}</p>}
    </form>
  );
}

export default function Watchlist({ stocks }) {
  const w = useWatchlist();
  if (!w.ready) return <div className="panel"><p className="muted">Loading your watchlist...</p></div>;
  const by = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const rows = w.list.map((t) => by[t]).filter(Boolean).map((s) => {
    const r = goodRange(s);
    return { s, r, c: priceCheck(s.tech?.price, r) };
  });
  const ready = rows.filter((x) => x.c && ["in", "below", "far"].includes(x.c.where));

  if (!rows.length) {
    return (
      <div className="stack">
      <PasteBox stocks={stocks} onAdd={w.addMany} />
      <div className="panel">
        <div className="empty">
          <h3>Your watchlist is empty</h3>
          Star any stock, from the <Link href="/screener/">screener</Link> or a stock page, to follow how close it is to a good price to buy.
        </div>
      </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="banner">
        {ready.length
          ? <><strong>{ready.length} of {rows.length}</strong> on your watchlist {ready.length === 1 ? "is" : "are"} inside or under the good buying range right now: {ready.map((x) => x.s.ticker).join(", ")}.</>
          : <>None of your {rows.length} watched stocks are in their good buying range yet. The closest is {[...rows].filter((x) => x.c).sort((a, b) => a.c.pct - b.c.pct)[0]?.s.ticker}.</>}
      </div>
      <div className="panel flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th /><th>Stock</th><th className="r">Price</th><th>6 months</th><th>Good price to buy</th><th className="r">Distance</th><th className="r">Quality</th><th>Suggestion</th></tr></thead>
            <tbody>
              {rows.map(({ s, r, c }) => (
                <tr key={s.ticker}>
                  <td style={{ width: 30, paddingRight: 0 }}><WatchStar ticker={s.ticker} /></td>
                  <td>{s.tracked ? <span className="ticker">{s.ticker}</span> : <Link href={`/stock/${s.ticker}/`} className="ticker">{s.ticker}</Link>}<div className="name">{s.name}{s.tracked ? ", tracked, not scored" : ""}</div></td>
                  <td className="r num">{money(s.tech?.price)}{s.tech?.change_pct != null && <div className={`small ${s.tech.change_pct >= 0 ? "up" : "down"}`}>{pct(s.tech.change_pct / 100, 1, true)}</div>}</td>
                  <td><Sparkline values={s.spark} /></td>
                  <td>{r ? <div className="rangecell"><MiniRange price={s.tech?.price} range={r} /><span className="num small">{money(r.low)} to {money(r.high)}</span></div> : <span className="faint small">n/a</span>}</td>
                  <td className={`r small check ${c?.where || ""}`}>
                    {c?.where === "above" ? `Needs to fall ${money(s.tech.price - r.high)}` : c ? c.text.replace(/^./, (x) => x.toUpperCase()) : "n/a"}
                  </td>
                  <td className="r num">{s.score != null ? num(s.score, 0) : "n/a"}</td>
                  <td>{s.tracked ? <span className="small muted">Not scored</span> : <ActionTag action={s.action} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PasteBox stocks={stocks} onAdd={w.addMany} />
    </div>
  );
}
