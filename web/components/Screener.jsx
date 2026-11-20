"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ActionTag from "./ActionTag";
import MiniRange from "./MiniRange";
import Sparkline from "./Sparkline";
import WatchStar from "./WatchStar";
import { Icon } from "./Icons";
import { ACTION_GROUP, GROUP_LABEL, money, num, pct } from "@/lib/format";
import { goodRange, priceCheck } from "@/lib/plain";

const BLANK = { q: "", sub: "all", group: "all", minScore: 0, where: "any", trend: "any", rsi: "any" };

const PRESETS = [
  { id: "quality-discount", name: "Good business, good price", note: "Quality 60 or more, priced inside or under its good range", f: { minScore: 60, where: "in_or_below" } },
  { id: "oversold", name: "Strong but oversold", note: "Quality 55 or more, momentum under 35 after a sharp drop", f: { minScore: 55, rsi: "oversold" } },
  { id: "uptrend", name: "Rising with quality", note: "Price above both averages, quality 50 or more", f: { minScore: 50, trend: "Uptrend" } },
  { id: "review", name: "Review what you own", note: "Every stock the model says to trim, sell or avoid", f: { group: "sell_trim" } },
  { id: "traps", name: "Cheap for a reason?", note: "Under its good range but quality below 45", f: { where: "below", maxScore: 45 } },
  { id: "early", name: "Early-stage bets", note: "Companies with no steady profits yet", f: { sub: "early" } },
];

const RANK = { buy: 0, hold: 1, trim: 2, sell: 3, none: 4 };
const COLS = [
  ["ticker", "Stock", (r) => r.ticker],
  ["price", "Price", (r) => r.tech?.price ?? -1, "r"],
  ["spark", "6 months", (r) => (r.spark?.length > 1 ? r.spark[r.spark.length - 1] / r.spark[0] : 0)],
  ["range", "Good price to buy", (r) => (r.check ? (r.check.where === "below" || r.check.where === "far" ? -r.check.pct : r.check.pct) : 9)],
  ["score", "Quality", (r) => r.score ?? -1, "r"],
  ["trend", "Trend", (r) => ({ Uptrend: 0, Mixed: 1, Downtrend: 2 })[r.tech?.trend] ?? 3],
  ["rsi", "Momentum", (r) => r.tech?.rsi14 ?? -1, "r"],
  ["action", "Suggestion", (r) => RANK[ACTION_GROUP[r.action] || "none"] * 100 - (r.score ?? 0)],
];

function matches(r, f) {
  const needle = f.q.trim().toLowerCase();
  if (needle && !r.ticker.toLowerCase().includes(needle) && !r.name.toLowerCase().includes(needle)) return false;
  if (f.sub !== "all" && r.subsector !== f.sub) return false;
  const g = ACTION_GROUP[r.action] || "none";
  if (f.group === "sell_trim" ? !["trim", "sell"].includes(g) : f.group !== "all" && g !== f.group) return false;
  if (f.minScore && (r.score ?? -1) < f.minScore) return false;
  if (f.maxScore != null && (r.score ?? 999) > f.maxScore) return false;
  const w = r.check?.where;
  if (f.where === "in_or_below" && !["in", "below", "far"].includes(w)) return false;
  if (f.where === "below" && !["below", "far"].includes(w)) return false;
  if (f.where === "above" && w !== "above") return false;
  if (f.trend !== "any" && r.tech?.trend !== f.trend) return false;
  if (f.rsi === "oversold" && !(r.tech?.rsi14 != null && r.tech.rsi14 < 35)) return false;
  if (f.rsi === "overbought" && !(r.tech?.rsi14 != null && r.tech.rsi14 > 70)) return false;
  return true;
}

function toCsv(rows) {
  const head = ["Ticker", "Name", "Sector", "Price", "Change today %", "Good range low", "Good range high", "Range source", "Quality", "Band", "Trend", "Momentum (RSI)", "Suggestion"];
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.map((r) => [r.ticker, r.name, r.subsector_label, r.tech?.price, r.tech?.change_pct, r.range?.low, r.range?.high, r.range?.source, r.score?.toFixed(1), r.band, r.tech?.trend, r.tech?.rsi14, r.action].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}

export default function Screener({ rows: raw, subsectors, asof }) {
  const router = useRouter();
  const [f, setF] = useState(BLANK);
  const [preset, setPreset] = useState(null);
  const [sort, setSort] = useState(["action", 1]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preset");
    const p = PRESETS.find((x) => x.id === id);
    if (p) { setF({ ...BLANK, ...p.f }); setPreset(p.id); }
  }, []);

  const rows = useMemo(() => raw.map((r) => {
    const range = goodRange(r);
    return { ...r, range, check: priceCheck(r.tech?.price, range) };
  }), [raw]);

  const shown = useMemo(() => {
    const col = COLS.find((c) => c[0] === sort[0]);
    return rows.filter((r) => matches(r, f)).sort((a, b) => {
      const x = col[2](a), y = col[2](b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort[1];
    });
  }, [rows, f, sort]);

  const set = (patch) => { setF((o) => ({ ...o, ...patch })); setPreset(null); };
  const pick = (p) => {
    if (preset === p.id) { setF(BLANK); setPreset(null); window.history.replaceState(null, "", "/screener/"); return; }
    setF({ ...BLANK, ...p.f }); setPreset(p.id);
    window.history.replaceState(null, "", `/screener/?preset=${p.id}`);
  };
  const clickSort = (k) => setSort(([c, d]) => (c === k ? [c, -d] : [k, ["score", "price", "spark", "rsi"].includes(k) ? -1 : 1]));

  function download() {
    const blob = new Blob([toCsv(shown)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `energy-screener-${asof}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="stack">
      <div>
        <div className="section-head"><h2>Start from a screen</h2><span className="small faint">Click again to clear</span></div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={`preset ${preset === p.id ? "on" : ""}`} onClick={() => pick(p)} aria-pressed={preset === p.id}>
              <strong>{p.name}</strong>
              <span>{p.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="filters-grid">
          <label className="field">Search
            <input className="input" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Ticker or company" />
          </label>
          <label className="field">Sector
            <select className="select" value={f.sub} onChange={(e) => set({ sub: e.target.value })}>
              <option value="all">All sectors</option>
              {Object.entries(subsectors).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">Suggestion
            <select className="select" value={f.group} onChange={(e) => set({ group: e.target.value })}>
              <option value="all">Any</option>
              <option value="buy">{GROUP_LABEL.buy}</option>
              <option value="hold">{GROUP_LABEL.hold}</option>
              <option value="sell_trim">Trim, sell or avoid</option>
            </select>
          </label>
          <label className="field">Price vs good range
            <select className="select" value={f.where} onChange={(e) => set({ where: e.target.value })}>
              <option value="any">Any</option>
              <option value="in_or_below">Inside or under it</option>
              <option value="below">Under it</option>
              <option value="above">Above it</option>
            </select>
          </label>
          <label className="field">Trend
            <select className="select" value={f.trend} onChange={(e) => set({ trend: e.target.value })}>
              <option value="any">Any</option>
              <option value="Uptrend">Rising</option>
              <option value="Mixed">Unclear</option>
              <option value="Downtrend">Falling</option>
            </select>
          </label>
          <label className="field">Momentum
            <select className="select" value={f.rsi} onChange={(e) => set({ rsi: e.target.value })}>
              <option value="any">Any</option>
              <option value="oversold">Oversold (under 35)</option>
              <option value="overbought">Overbought (over 70)</option>
            </select>
          </label>
          <label className="field">Quality at least {f.minScore}
            <input type="range" min="0" max="80" step="5" value={f.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="panel flush">
        <div className="panel-head" style={{ padding: "14px 16px 0" }}>
          <h2>{shown.length} {shown.length === 1 ? "stock" : "stocks"} match</h2>
          <div className="row">
            <button className="btn sm" onClick={() => { setF(BLANK); setPreset(null); }}>Clear filters</button>
            <button className="btn sm" onClick={download}>{Icon.download} Download CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th aria-label="Watchlist" />
                {COLS.map(([k, label, , cls]) => (
                  <th key={k} className={`sortable ${cls || ""}`} onClick={() => clickSort(k)} aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : "none"}>
                    {label} {sort[0] === k ? (sort[1] > 0 ? "↑" : "↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={COLS.length + 1}><div className="empty"><h3>No stocks match these filters</h3>Loosen one filter, or clear them all to start again.</div></td></tr>
              )}
              {shown.map((r) => (
                <tr key={r.ticker} className="link-row" onClick={() => router.push(`/stock/${r.ticker}/`)}>
                  <td style={{ width: 30, paddingRight: 0 }}><WatchStar ticker={r.ticker} /></td>
                  <td>
                    <Link href={`/stock/${r.ticker}/`} className="ticker" onClick={(e) => e.stopPropagation()}>{r.ticker}</Link>
                    <div className="name">{r.name}</div>
                  </td>
                  <td className="r num">
                    {money(r.tech?.price)}
                    {r.tech?.change_pct != null && <div className={`small ${r.tech.change_pct >= 0 ? "up" : "down"}`}>{pct(r.tech.change_pct / 100, 1, true)}</div>}
                  </td>
                  <td><Sparkline values={r.spark} /></td>
                  <td>
                    {r.range ? (
                      <div className="rangecell">
                        <MiniRange price={r.tech?.price} range={r.range} />
                        <div>
                          <div className="num small">{money(r.range.low)} to {money(r.range.high)}</div>
                          <div className={`tiny check ${r.check?.where}`}>{r.check?.text.replace(/^./, (c) => c.toUpperCase())}</div>
                        </div>
                      </div>
                    ) : <span className="faint small">Not enough history</span>}
                  </td>
                  <td className="r">
                    {r.score != null ? (
                      <span className="scorebar">
                        <span className="track"><span className="fill" style={{ width: `${r.score}%` }} /></span>
                        <span className="num" style={{ minWidth: 22 }}>{num(r.score, 0)}</span>
                      </span>
                    ) : <span className="faint">n/a</span>}
                  </td>
                  <td className="small">{({ Uptrend: "Rising", Downtrend: "Falling", Mixed: "Unclear" })[r.tech?.trend] || <span className="faint">n/a</span>}</td>
                  <td className="r num small">{r.tech?.rsi14 != null ? Math.round(r.tech.rsi14) : <span className="faint">n/a</span>}</td>
                  <td><ActionTag action={r.action} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
