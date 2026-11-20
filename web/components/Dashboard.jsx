"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ActionTag from "./ActionTag";
import MiniRange from "./MiniRange";
import { ACTION_GROUP, GROUP_LABEL, money, num, pct } from "@/lib/format";
import { goodRange, priceCheck } from "@/lib/plain";

const RANK = { buy: 0, hold: 1, trim: 2, sell: 3, none: 4 };

const COLUMNS = [
  ["ticker", "Stock", (r) => r.ticker],
  ["price", "Price now", (r) => r.tech?.price ?? -1, "r"],
  ["range", "Good price to buy", (r) => (r.check ? (r.check.where === "below" ? -r.check.pct : r.check.pct) : 9)],
  ["score", "Quality", (r) => r.score ?? -1, "r"],
  ["action", "What to do", (r) => RANK[ACTION_GROUP[r.action] || "none"] * 100 - (r.score ?? 0)],
];

function DriverTile({ d }) {
  if (!d || d.latest == null) return null;
  const ch = d.change_6m;
  return (
    <div className="driver">
      <div className="small muted">{d.label}</div>
      <div className="num" style={{ fontWeight: 620, fontSize: 16 }}>{d.is_rate ? d.latest.toFixed(2) + "%" : "$" + d.latest.toFixed(2)}</div>
      {ch != null && <div className="small faint num">{ch > 0 ? "+" : ""}{ch.toFixed(2)} in 6 months</div>}
    </div>
  );
}

function IdeaCard({ r }) {
  return (
    <Link href={`/stock/${r.ticker}/`} className="idea">
      <div className="idea-top">
        <span className="ticker">{r.ticker}</span>
        <span className="num">{money(r.tech?.price)}</span>
      </div>
      <div className="name" style={{ maxWidth: "none" }}>{r.name}</div>
      <div className="idea-range">
        <MiniRange price={r.tech?.price} range={r.range} />
        <span className="small muted num">Good price {money(r.range?.low, 0)} to {money(r.range?.high, 0)}</span>
      </div>
      <div className="idea-foot">
        <ActionTag action={r.action} />
        <span className="small faint">Quality {num(r.score, 0)}</span>
      </div>
    </Link>
  );
}

export default function Dashboard({ rows: raw, tracked, drivers, subsectors, sample }) {
  const router = useRouter();
  const [group, setGroup] = useState("all");
  const [sub, setSub] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(["action", 1]);

  const rows = useMemo(() => raw.map((r) => {
    const range = goodRange(r);
    return { ...r, range, check: priceCheck(r.tech?.price, range) };
  }), [raw]);

  const ideas = useMemo(() => rows.filter((r) => ACTION_GROUP[r.action] === "buy" && r.range).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6), [rows]);

  const counts = useMemo(() => {
    const c = { buy: 0, hold: 0, trim: 0, sell: 0, none: 0 };
    rows.forEach((r) => c[ACTION_GROUP[r.action] || "none"]++);
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const col = COLUMNS.find((c) => c[0] === sort[0]);
    return rows
      .filter((r) => group === "all" || (ACTION_GROUP[r.action] || "none") === group)
      .filter((r) => sub === "all" || r.subsector === sub)
      .filter((r) => !needle || r.ticker.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = col[2](a), y = col[2](b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort[1];
      });
  }, [rows, group, sub, q, sort]);

  function clickSort(key) {
    setSort(([k, dir]) => (k === key ? [k, -dir] : [key, key === "score" || key === "price" ? -1 : 1]));
  }

  return (
    <div className="stack">
      {sample && <div className="banner warn">Sample data for a local preview. These are made-up companies, not real scores.</div>}

      <div className="howto">
        <div className="howto-step"><span className="howto-n">1</span><div><strong>Quality</strong><div className="small muted">Is it a good business? A score from 0 to 100 built from cheapness, debt, growth, government policy and outside risks.</div></div></div>
        <div className="howto-step"><span className="howto-n">2</span><div><strong>Good price to buy</strong><div className="small muted">The price range worth buying in. The bar shows the range shaded and today&apos;s price as a dot.</div></div></div>
        <div className="howto-step"><span className="howto-n">3</span><div><strong>What to do</strong><div className="small muted">Quality and price combined into one suggestion. Click any stock to see why.</div></div></div>
      </div>

      {ideas.length > 0 && (
        <div>
          <div className="section-head">
            <h2>Best ideas right now</h2>
            <span className="faint small">Highest quality stocks with a buy signal</span>
          </div>
          <div className="ideas">{ideas.map((r) => <IdeaCard key={r.ticker} r={r} />)}</div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>All stocks</h2>
          <span className="faint small">{shown.length} of {rows.length} · click a row for the full story</span>
        </div>
        <div className="filters" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Search ticker or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select className="select" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Group">
            <option value="all">All groups</option>
            {Object.entries(subsectors).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {["all", "buy", "hold", "trim", "sell"].map((g) => (
            <button key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>
              {g === "all" ? `All (${rows.length})` : `${GROUP_LABEL[g]} (${counts[g]})`}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map(([key, label, , cls]) => (
                  <th key={key} className={`sortable ${cls || ""}`} onClick={() => clickSort(key)}>
                    {label} {sort[0] === key ? (sort[1] > 0 ? "↑" : "↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.ticker} className="link-row" onClick={() => router.push(`/stock/${r.ticker}/`)}>
                  <td>
                    <Link href={`/stock/${r.ticker}/`} className="ticker" onClick={(e) => e.stopPropagation()}>{r.ticker}</Link>
                    <div className="name">{r.name} · {r.subsector_label}</div>
                  </td>
                  <td className="r num">
                    {money(r.tech?.price)}
                    {r.tech?.change_pct != null && (
                      <div className="small" style={{ color: r.tech.change_pct >= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}>{pct(r.tech.change_pct / 100, 1, true)}</div>
                    )}
                  </td>
                  <td>
                    {r.range ? (
                      <div className="rangecell">
                        <MiniRange price={r.tech?.price} range={r.range} />
                        <div>
                          <div className="num">{money(r.range.low)} to {money(r.range.high)}</div>
                          <div className={`small check ${r.check?.where}`}>{r.check?.text.replace(/^./, (c) => c.toUpperCase())} <span className="faint">· {r.range.source === "numbers" ? "from company numbers" : "from chart"}</span></div>
                        </div>
                      </div>
                    ) : <span className="faint small">Not enough price history</span>}
                  </td>
                  <td className="r">
                    {r.score != null ? (
                      <span className="scorebar">
                        <span className="track"><span className="fill" style={{ width: `${r.score}%` }} /></span>
                        <span className="num" style={{ minWidth: 22 }}>{num(r.score, 0)}</span>
                        <span className="small muted" style={{ minWidth: 44, textAlign: "left" }}>{r.band}</span>
                      </span>
                    ) : <span className="faint">—</span>}
                  </td>
                  <td><ActionTag action={r.action} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Market drivers</h2><span className="faint small">The prices that move whole groups of energy stocks</span></div>
        <div className="drivers">
          {["brent", "henry_hub", "us10y", "uranium"].map((k) => <DriverTile key={k} d={drivers[k]} />)}
        </div>
      </div>

      {tracked.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Tracked, not scored</h2><span className="faint small">Pending takeovers, benchmarks and names outside the model</span></div>
          <table>
            <thead><tr><th>Stock</th><th>Why it is here</th><th className="r">Price</th><th className="r">Deal price</th><th className="r">Gap to deal</th></tr></thead>
            <tbody>
              {tracked.map((t) => (
                <tr key={t.ticker}>
                  <td><div className="ticker">{t.ticker}</div><div className="name">{t.name}</div></td>
                  <td className="muted small">{t.note || t.status.replace(/_/g, " ")}</td>
                  <td className="r num">{money(t.tech?.price)}</td>
                  <td className="r num">{t.deal_price ? money(t.deal_price) : "—"}</td>
                  <td className="r num">{t.deal_upside_pct != null ? pct(t.deal_upside_pct / 100, 1, true) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
