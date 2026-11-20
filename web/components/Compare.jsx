"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionTag from "./ActionTag";
import Radar from "./Radar";
import { money, num, pct } from "@/lib/format";
import { goodRange, priceCheck } from "@/lib/plain";

const SLOTS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c7)"];
const MAX = 4;

function IndexedChart({ picks, histories }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 760, H = 280, P = { l: 44, r: 64, t: 12, b: 26 };
  const series = picks.map((p) => {
    const h = histories[p.ticker] || [];
    const base = h[0]?.[1];
    return { ...p, pts: base ? h.map(([d, c]) => [new Date(d + "T12:00:00Z").getTime(), (c / base) * 100]) : [] };
  }).filter((s) => s.pts.length > 1);
  if (!series.length) return <p className="muted">No price history to compare.</p>;
  const all = series.flatMap((s) => s.pts);
  const t0 = Math.min(...all.map((p) => p[0])), t1 = Math.max(...all.map((p) => p[0]));
  let lo = Math.min(...all.map((p) => p[1]), 100), hi = Math.max(...all.map((p) => p[1]), 100);
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (t) => P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const step = (hi - lo) > 120 ? 50 : (hi - lo) > 60 ? 25 : 10;
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const ends = series.map((s) => ({ s, v: s.pts[s.pts.length - 1][1] })).map((e) => ({ ...e, yy: y(e.v) })).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 13) ends[i].yy = ends[i - 1].yy + 13;
  function move(e) {
    const b = ref.current.getBoundingClientRect();
    setHover(t0 + (((e.clientX - b.left) / b.width) * W - P.l) / (W - P.l - P.r) * (t1 - t0));
  }
  const near = (s) => s.pts.reduce((best, p) => (Math.abs(p[0] - hover) < Math.abs(best[0] - hover) ? p : best), s.pts[0]);
  const hx = hover != null ? x(near(series[0])[0]) : null;
  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Price change over one year, each stock starting at 100">
        {ticks.map((v) => (
          <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke={v === 100 ? "var(--ink-3)" : "var(--grid)"} strokeDasharray={v === 100 ? "4 3" : undefined} /><text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{v}</text></g>
        ))}
        {series.map((s) => <path key={s.ticker} d={s.pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />)}
        {ends.map((e) => <text key={e.s.ticker} x={W - P.r + 6} y={e.yy + 4} fontSize="11.5" fill="var(--ink-2)"><tspan fill={e.s.color}>●</tspan> {e.s.ticker}</text>)}
        {hx != null && <line x1={hx} x2={hx} y1={P.t} y2={H - P.b} stroke="var(--ink-3)" />}
        {hx != null && series.map((s) => { const p = near(s); return <circle key={s.ticker} cx={x(p[0])} cy={y(p[1])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />; })}
      </svg>
      {hx != null && (
        <div className="tooltip" style={{ left: `${(hx / W) * 100}%`, top: "18%" }}>
          <div className="faint">{new Date(near(series[0])[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</div>
          {series.map((s) => <div key={s.ticker} className="num"><span style={{ color: s.color }}>●</span> {s.ticker} {pct(near(s)[1] / 100 - 1, 1, true)}</div>)}
        </div>
      )}
      <p className="small faint" style={{ marginTop: 6 }}>Each line starts at 100 one year ago, so you compare percentage moves, not prices.</p>
    </div>
  );
}

export default function Compare({ stocks, histories }) {
  const by = useMemo(() => Object.fromEntries(stocks.map((s) => [s.ticker, s])), [stocks]);
  const [picks, setPicks] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = (new URLSearchParams(window.location.search).get("t") || "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => by[x]).slice(0, MAX);
    const start = t.length ? t : ["VST", "CEG", "NRG"].filter((x) => by[x]);
    setPicks(start.map((ticker, i) => ({ ticker, color: SLOTS[i] })));
  }, [by]);

  function sync(next) {
    setPicks(next);
    window.history.replaceState(null, "", `/compare/?t=${next.map((p) => p.ticker).join(",")}`);
  }
  function add(t) {
    t = t.trim().toUpperCase();
    if (!by[t] || picks.some((p) => p.ticker === t) || picks.length >= MAX) return;
    // A new stock takes the first free color, so colors stay with their stock when others are removed.
    const free = SLOTS.find((c) => !picks.some((p) => p.color === c));
    sync([...picks, { ticker: t, color: free }]);
    setQ("");
  }
  const rows = picks.map((p) => ({ ...p, s: by[p.ticker] }));
  const metric = (label, fn) => ({ label, fn });
  const METRICS = [
    metric("Price", (s) => money(s.tech?.price)),
    metric("Suggestion", (s) => <ActionTag action={s.action} />),
    metric("Quality score", (s) => (s.score != null ? `${num(s.score, 0)} (${s.band})` : "n/a")),
    metric("Good price to buy", (s) => { const r = goodRange(s); return r ? `${money(r.low)} to ${money(r.high)}` : "n/a"; }),
    metric("Price vs that range", (s) => priceCheck(s.tech?.price, goodRange(s))?.text || "n/a"),
    metric("Fair value from the numbers", (s) => (s.fair_value ? money(s.fair_value) : "n/a")),
    metric("Trend", (s) => ({ Uptrend: "Rising", Downtrend: "Falling", Mixed: "Unclear" })[s.tech?.trend] || "n/a"),
    metric("Momentum (RSI)", (s) => (s.tech?.rsi14 != null ? Math.round(s.tech.rsi14) : "n/a")),
    metric("Price change, 1 year", (s) => pct(s.tech?.ret_1y, 1, true)),
    metric("Below 52-week high", (s) => (s.tech?.from_hi52 != null ? pct(-s.tech.from_hi52, 0) : "n/a")),
    metric("Company value", (s) => (s.market_cap ? `$${(s.market_cap / 1e9).toFixed(1)}B` : "n/a")),
  ];

  return (
    <div className="stack">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            {rows.map((p) => (
              <span key={p.ticker} className="chip on" style={{ background: "var(--surface)", color: "var(--ink)", borderColor: p.color, display: "inline-flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} aria-hidden />
                <strong>{p.ticker}</strong>
                <button className="star" style={{ fontSize: 14 }} onClick={() => sync(picks.filter((x) => x.ticker !== p.ticker))} aria-label={`Remove ${p.ticker}`}>✕</button>
              </span>
            ))}
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); add(q); }}>
            <input className="input" list="cmp-tickers" value={q} onChange={(e) => setQ(e.target.value)} placeholder={picks.length >= MAX ? "Remove one to add another" : "Add a ticker"} disabled={picks.length >= MAX} aria-label="Add a ticker to compare" />
            <datalist id="cmp-tickers">{stocks.map((s) => <option key={s.ticker} value={s.ticker}>{s.name}</option>)}</datalist>
            <button className="btn" type="submit" disabled={picks.length >= MAX}>Add</button>
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel"><div className="empty"><h3>Pick up to four stocks</h3>Add tickers above to see them side by side.</div></div>
      ) : (
        <>
          <div className="cols-2">
            <div className="panel">
              <div className="panel-head"><h2>Price over the last year</h2></div>
              <IndexedChart picks={rows} histories={histories} />
            </div>
            <div className="panel">
              <div className="panel-head"><h2>Quality shape</h2><span className="small faint">Further out is better</span></div>
              <Radar series={rows.map((p) => ({ name: p.ticker, color: p.color, values: p.s.pillars || {} }))} />
              <div className="legend" style={{ justifyContent: "center" }}>
                {rows.map((p) => <span key={p.ticker}><i className="swatch" style={{ background: p.color }} />{p.ticker} {p.s.score != null ? Math.round(p.s.score) : ""}</span>)}
              </div>
            </div>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table className="fixed-table">
                <thead>
                  <tr><th />{rows.map((p) => <th key={p.ticker}><span style={{ color: p.color }} aria-hidden>●</span> <Link href={`/stock/${p.ticker}/`} className="ticker">{p.ticker}</Link><div className="name" style={{ fontWeight: 400 }}>{p.s.name}</div></th>)}</tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => (
                    <tr key={m.label}><td className="muted small">{m.label}</td>{rows.map((p) => <td key={p.ticker} className="num">{m.fn(p.s)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
