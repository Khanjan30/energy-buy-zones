"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import ActionTag from "./ActionTag";
import { Icon } from "./Icons";
import { useHoldings } from "@/lib/store";
import { ACTION_GROUP, money, num, pct } from "@/lib/format";
import { ACTION_PLAIN, goodRange, priceCheck } from "@/lib/plain";

// Sector colors follow the sector, in a fixed order, never by rank.
const SECTOR_COLOR = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

function parseList(text) {
  // Accepts lines like "VST, 10, 120.50" or "VST 10 120.50".
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [t, sh, c] = l.split(/[\s,;\t]+/);
    return { ticker: (t || "").toUpperCase(), shares: Number(sh), cost: Number(c) };
  }).filter((h) => h.ticker && h.shares > 0 && h.cost >= 0);
}

export default function Portfolio({ stocks, subsectors }) {
  const { list, upsert, remove, replace, ready } = useHoldings();
  const [form, setForm] = useState({ ticker: "", shares: "", cost: "" });
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const by = useMemo(() => Object.fromEntries(stocks.map((s) => [s.ticker, s])), [stocks]);
  const keys = Object.keys(subsectors);

  const rows = list.map((h) => {
    const s = by[h.ticker];
    const price = s?.tech?.price ?? null;
    const value = price != null ? price * h.shares : null;
    const costBasis = h.cost * h.shares;
    const dayMove = s?.tech?.change_pct != null && value != null ? value - value / (1 + s.tech.change_pct / 100) : null;
    return { ...h, s, price, value, costBasis, gain: value != null ? value - costBasis : null, dayMove };
  });
  const known = rows.filter((r) => r.value != null);
  const total = known.reduce((a, r) => a + r.value, 0);
  const basis = known.reduce((a, r) => a + r.costBasis, 0);
  const day = known.reduce((a, r) => a + (r.dayMove || 0), 0);
  const scored = known.filter((r) => r.s?.score != null);
  const wq = scored.length ? scored.reduce((a, r) => a + r.s.score * r.value, 0) / scored.reduce((a, r) => a + r.value, 0) : null;
  const bySector = [
    ...keys.map((k, i) => ({ k, label: subsectors[k], color: SECTOR_COLOR[i % 8], value: known.filter((r) => r.s.subsector === k).reduce((a, r) => a + r.value, 0) })),
    { k: "_tracked", label: "Tracked, not scored", color: "var(--ink-3)", value: known.filter((r) => r.s.tracked).reduce((a, r) => a + r.value, 0) },
  ].filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const review = rows.filter((r) => ["trim", "sell"].includes(ACTION_GROUP[r.s?.action]));
  const addMore = rows.filter((r) => ACTION_GROUP[r.s?.action] === "buy" && ["in", "below"].includes(priceCheck(r.price, r.s && goodRange(r.s))?.where));
  const top = known.length ? [...known].sort((a, b) => b.value - a.value)[0] : null;

  function add(e) {
    e.preventDefault();
    const t = form.ticker.trim().toUpperCase();
    const shares = Number(form.shares), cost = Number(form.cost);
    if (!t || !(shares > 0) || !(cost >= 0)) { setMsg("Enter a ticker, a number of shares above zero, and the average price you paid."); return; }
    upsert({ ticker: t, shares, cost });
    setMsg(by[t] ? `Saved ${t}.` : `Saved ${t}. It is outside the energy model, so it has no price or score here.`);
    setForm({ ticker: "", shares: "", cost: "" });
  }
  function importList() {
    const items = parseList(paste);
    if (!items.length) { setMsg("Nothing to import. Put one holding per line: ticker, shares, average price."); return; }
    const merged = Object.values(Object.fromEntries([...list, ...items].map((h) => [h.ticker, h])));
    replace(merged.sort((a, b) => a.ticker.localeCompare(b.ticker)));
    setPaste("");
    setMsg(`Imported ${items.length} ${items.length === 1 ? "holding" : "holdings"}.`);
  }

  if (!ready) return <div className="panel"><p className="muted">Loading your portfolio...</p></div>;

  return (
    <div className="stack">
      {list.length > 0 && (
        <div className="pulse">
          <div><div className="pulse-k">Value</div><div className="pulse-v">{money(total, 0)}</div><div className="pulse-s">{known.length} of {list.length} holdings priced</div></div>
          <div><div className="pulse-k">Gain since you bought</div><div className={`pulse-v ${total - basis >= 0 ? "up" : "down"}`}>{money(total - basis, 0)}</div><div className="pulse-s">{basis ? pct((total - basis) / basis, 1, true) : ""} on {money(basis, 0)} invested</div></div>
          <div><div className="pulse-k">Today</div><div className={`pulse-v ${day >= 0 ? "up" : "down"}`}>{money(day, 0)}</div><div className="pulse-s">{total ? pct(day / (total - day), 2, true) : ""}</div></div>
          <div><div className="pulse-k">Average quality</div><div className="pulse-v">{wq != null ? Math.round(wq) : "n/a"}<span className="muted" style={{ fontSize: 14 }}> / 100</span></div><div className="pulse-s">Weighted by how much you hold</div></div>
        </div>
      )}

      {list.length > 0 && (
        <div className="cols-even">
          <div className="panel">
            <div className="panel-head"><h2>What the model would do</h2></div>
            {review.length === 0 && addMore.length === 0 && <p className="muted small">No changes suggested. Every holding is a hold or a buy above its good range.</p>}
            {review.map((r) => (
              <div className="feed-item" key={r.ticker} style={{ gridTemplateColumns: "60px 1fr auto" }}>
                <Link href={`/stock/${r.ticker}/`} className="ticker">{r.ticker}</Link>
                <span className="small muted">{ACTION_PLAIN[r.s.action]}</span>
                <ActionTag action={r.s.action} />
              </div>
            ))}
            {addMore.map((r) => (
              <div className="feed-item" key={r.ticker} style={{ gridTemplateColumns: "60px 1fr auto" }}>
                <Link href={`/stock/${r.ticker}/`} className="ticker">{r.ticker}</Link>
                <span className="small muted">Priced inside or under its good range. A chance to add, if you want more.</span>
                <ActionTag action={r.s.action} />
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Where your money is</h2>{top && total > 0 && <span className="small faint">Largest: {top.ticker}, {pct(top.value / total, 0)}</span>}</div>
            <div className="alloc" role="img" aria-label="Portfolio split by sector">
              {bySector.map((x) => <span key={x.k} style={{ width: `${(x.value / total) * 100}%`, background: x.color }} title={`${x.label} ${pct(x.value / total, 0)}`} />)}
            </div>
            <div className="stack" style={{ gap: 6, marginTop: 12 }}>
              {bySector.map((x) => (
                <div key={x.k} className="row small" style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 8 }}><i className="swatch" style={{ background: x.color }} />{x.label}</span>
                  <span className="num">{money(x.value, 0)} <span className="faint">{pct(x.value / total, 0)}</span></span>
                </div>
              ))}
            </div>
            {top && total > 0 && top.value / total > 0.25 && <p className="small" style={{ marginTop: 10, color: "var(--warning-ink)" }}>{top.ticker} is more than a quarter of your portfolio. One bad quarter there would hurt the whole thing.</p>}
          </div>
        </div>
      )}

      <div className="panel flush">
        <div className="panel-head" style={{ padding: "14px 16px 0" }}>
          <h2>Holdings</h2>
          {list.length > 0 && <button className="btn sm" onClick={() => { if (confirm("Remove every holding from this browser?")) replace([]); }}>Remove all</button>}
        </div>
        {list.length === 0 ? (
          <div className="empty">
            <h3>Add what you own to see it through the model</h3>
            You get its value, your gain, an average quality score, and which holdings the model would trim, sell or add to. Everything stays in this browser.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Stock</th><th className="r">Shares</th><th className="r">Paid</th><th className="r">Price</th><th className="r">Value</th><th className="r">Gain</th><th className="r">Share of total</th><th className="r">Quality</th><th>Suggestion</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticker}>
                    <td>{r.s && !r.s.tracked ? <Link href={`/stock/${r.ticker}/`} className="ticker">{r.ticker}</Link> : <span className="ticker">{r.ticker}</span>}<div className="name">{r.s?.name || "Outside the energy model, no price"}</div></td>
                    <td className="r num">{num(r.shares, r.shares % 1 ? 3 : 0)}</td>
                    <td className="r num">{money(r.cost)}</td>
                    <td className="r num">{money(r.price)}</td>
                    <td className="r num">{money(r.value, 0)}</td>
                    <td className={`r num ${r.gain >= 0 ? "up" : "down"}`}>{r.gain != null ? <>{money(r.gain, 0)}<div className="tiny">{pct(r.gain / r.costBasis, 1, true)}</div></> : "n/a"}</td>
                    <td className="r num">{r.value != null && total ? pct(r.value / total, 1) : "n/a"}</td>
                    <td className="r num">{r.s?.score != null ? Math.round(r.s.score) : "n/a"}</td>
                    <td>{r.s?.tracked ? <span className="small muted">{r.s.status === "deal_pending" ? "Takeover pending" : "Not scored"}</span> : r.s ? <ActionTag action={r.s.action} /> : <span className="faint small">n/a</span>}</td>
                    <td><button className="btn sm" onClick={() => remove(r.ticker)} aria-label={`Remove ${r.ticker}`}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cols-even">
        <form className="panel" onSubmit={add}>
          <div className="panel-head"><h2>Add a holding</h2><span className="small faint">Adding a ticker again replaces it</span></div>
          <div className="form-row">
            <label className="field">Ticker
              <input className="input" list="tickers" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="VST" autoCapitalize="characters" />
            </label>
            <label className="field">Shares
              <input className="input" type="number" step="any" min="0" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} placeholder="10" />
            </label>
            <label className="field">Average price paid
              <input className="input" type="number" step="any" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="120.50" />
            </label>
            <button className="btn primary" type="submit">{Icon.plus} Add holding</button>
          </div>
          <datalist id="tickers">{stocks.map((s) => <option key={s.ticker} value={s.ticker}>{s.name}</option>)}</datalist>
          {msg && <p className="small muted" style={{ marginTop: 10 }} role="status">{msg}</p>}
        </form>
        <div className="panel">
          <div className="panel-head"><h2>Paste a list</h2><span className="small faint">From a spreadsheet or your broker</span></div>
          <textarea className="input" style={{ width: "100%", height: 92, padding: 10, resize: "vertical" }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"One per line: ticker, shares, average price\nVST, 10, 120.50\nCCJ, 25, 48"} />
          <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <span className="small faint">Saved only in this browser. Nothing is sent anywhere.</span>
            <button className="btn" onClick={importList}>Import holdings</button>
          </div>
        </div>
      </div>
    </div>
  );
}
