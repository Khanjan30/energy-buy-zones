"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ActionTag from "./ActionTag";
import { ACTION_GROUP, GROUP_LABEL, money, num, pct } from "@/lib/format";

const RANK = { buy: 0, hold: 1, trim: 2, sell: 3, none: 4 };
const POS_ORDER = { "Deep discount": 0, "Buy zone": 1, Fair: 2, Full: 3, Stretched: 4 };

const COLUMNS = [
  ["ticker", "Stock", (r) => r.ticker],
  ["subsector", "Group", (r) => r.subsector_label],
  ["price", "Price", (r) => r.tech?.price ?? -1, "r"],
  ["score", "Ownership score", (r) => r.score ?? -1, "r"],
  ["position", "Price vs fair value", (r) => POS_ORDER[r.position] ?? 9],
  ["zone", "Buy zone", (r) => r.buy_zone?.[0] ?? -1, "r"],
  ["action", "Action", (r) => RANK[ACTION_GROUP[r.action] || "none"] * 100 - (r.score ?? 0)],
];

function DriverTile({ d }) {
  if (!d || d.latest == null) return null;
  const ch = d.change_6m;
  const sub = ch == null ? "" : d.is_rate ? `${ch > 0 ? "+" : ""}${ch.toFixed(2)} pts in 6 months` : `${ch > 0 ? "+" : ""}${ch.toFixed(2)} in 6 months`;
  return (
    <div className="tile">
      <div className="tile-label">{d.label}</div>
      <div className="tile-value">{d.is_rate ? d.latest.toFixed(2) + "%" : "$" + d.latest.toFixed(2)}</div>
      <div className="tile-sub">{sub}</div>
    </div>
  );
}

export default function Dashboard({ rows, tracked, drivers, subsectors, missing, sample }) {
  const router = useRouter();
  const [group, setGroup] = useState("all");
  const [sub, setSub] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(["action", 1]);

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
      {missing.length > 0 && (
        <div className="banner">
          Missing keys: {missing.join(", ")}. Those inputs are skipped and the remaining pillar weights are scaled up to fill the gap.
        </div>
      )}

      <div className="tiles">
        {["buy", "hold", "trim", "sell"].map((g) => (
          <button key={g} className={`tile ${group === g ? "on" : ""}`} onClick={() => setGroup(group === g ? "all" : g)}>
            <div className="tile-label">{GROUP_LABEL[g]}</div>
            <div className="tile-value">{counts[g]}</div>
            <div className="tile-sub">{group === g ? "Showing only these" : "Click to filter"}</div>
          </button>
        ))}
        {["brent", "henry_hub", "us10y", "uranium"].map((k) => (
          <DriverTile key={k} d={drivers[k]} />
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Decision grid</h2>
          <span className="faint small">{shown.length} of {rows.length} stocks</span>
        </div>
        <div className="filters" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Search ticker or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select className="select" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Group">
            <option value="all">All groups</option>
            {Object.entries(subsectors).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {["all", "buy", "hold", "trim", "sell"].map((g) => (
            <button key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>
              {g === "all" ? "All actions" : GROUP_LABEL[g]}
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
                    <div className="ticker">{r.ticker}</div>
                    <div className="name">{r.name}</div>
                  </td>
                  <td className="muted small">{r.subsector_label}</td>
                  <td className="r num">
                    {money(r.tech?.price)}
                    {r.tech?.change_pct != null && (
                      <div className="small" style={{ color: r.tech.change_pct >= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}>
                        {pct(r.tech.change_pct / 100, 1, true)}
                      </div>
                    )}
                  </td>
                  <td className="r">
                    {r.score != null ? (
                      <span className="scorebar">
                        <span className="track"><span className="fill" style={{ width: `${r.score}%` }} /></span>
                        <span className="num" style={{ minWidth: 26 }}>{num(r.score, 0)}</span>
                        <span className="band small muted" style={{ minWidth: 44, textAlign: "left" }}>{r.band}</span>
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    {r.position ? (
                      <>
                        <div>{r.position}</div>
                        <div className="small faint num">{r.price_to_fair ? `${(r.price_to_fair * 100).toFixed(0)}% of fair value` : ""}</div>
                      </>
                    ) : (
                      <span className="faint small">{r.subsector === "early" ? "Chart only" : "No fair value"}</span>
                    )}
                  </td>
                  <td className="r num">
                    {r.buy_zone ? `${money(r.buy_zone[0])} to ${money(r.buy_zone[1])}` : <span className="faint">—</span>}
                  </td>
                  <td><ActionTag action={r.action} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tracked.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Tracked, not scored</h2>
            <span className="faint small">Deals pending, benchmarks and names outside the model</span>
          </div>
          <table>
            <thead>
              <tr><th>Stock</th><th>Status</th><th className="r">Price</th><th className="r">Deal price</th><th className="r">Gap to deal</th></tr>
            </thead>
            <tbody>
              {tracked.map((t) => (
                <tr key={t.ticker}>
                  <td><div className="ticker">{t.ticker}</div><div className="name">{t.name}</div></td>
                  <td className="muted small">{t.status.replace(/_/g, " ")}{t.note ? ` · ${t.note}` : ""}</td>
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
