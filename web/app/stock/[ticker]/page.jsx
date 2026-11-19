import Link from "next/link";
import ActionTag from "@/components/ActionTag";
import PriceChart from "@/components/PriceChart";
import Pending from "@/components/Pending";
import { getScores } from "@/lib/data";
import { big, date, money, num, pct } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  const data = getScores();
  const list = data?.stocks?.map((s) => ({ ticker: s.ticker })) || [];
  // A static export needs at least one page per dynamic route.
  return list.length ? list : [{ ticker: "pending" }];
}

export async function generateMetadata({ params }) {
  const { ticker } = await params;
  return { title: `${ticker} · Energy Buy Zones` };
}

const ORDER = ["value", "strength", "growth", "policy", "outside"];

function ImpactText({ n }) {
  const cls = n > 0 ? "pos" : n < 0 ? "neg" : "";
  return <span className={`impact ${cls}`}>{n > 0 ? `+${n}` : n}</span>;
}

export default async function StockPage({ params }) {
  const { ticker } = await params;
  const data = getScores();
  const s = data?.stocks?.find((x) => x.ticker === ticker);
  if (!s) return <Pending what="stock pages" />;
  const f = s.financials || {};
  const events = (data.events || []).filter((e) => (s.event_ids || []).includes(e.id));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link href="/">← All stocks</Link> · {s.subsector_label}</div>
          <h1 style={{ marginTop: 8 }}>{s.ticker} <span className="muted" style={{ fontWeight: 450 }}>{s.name}</span></h1>
          <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 640 }} className="num">{money(s.tech?.price)}</span>
            {s.tech?.change_pct != null && (
              <span className="num" style={{ color: s.tech.change_pct >= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}>
                {pct(s.tech.change_pct / 100, 2, true)} today
              </span>
            )}
            <ActionTag action={s.action} />
          </div>
        </div>
        <div className="tiles" style={{ minWidth: 380, gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="tile">
            <div className="tile-label">Ownership score</div>
            <div className="tile-value">{s.score != null ? num(s.score, 0) : "—"}<span className="muted" style={{ fontSize: 14 }}> / 100</span></div>
            <div className="tile-sub">{s.band}{s.coverage < 1 ? ` · ${Math.round(s.coverage * 100)}% of inputs` : ""}</div>
          </div>
          <div className="tile">
            <div className="tile-label">Price vs fair value</div>
            <div className="tile-value">{s.price_to_fair ? `${Math.round(s.price_to_fair * 100)}%` : "—"}</div>
            <div className="tile-sub">{s.position || (s.subsector === "early" ? "Early-stage: chart only" : "No fair value")}</div>
          </div>
        </div>
      </div>

      <div className="stack">
        {(s.notes?.length > 0 || s.hard_fails?.length > 0) && (
          <div className="banner">
            {s.hard_fails?.map((h, i) => <div key={"h" + i}><strong>Hard fail:</strong> {Array.isArray(h) ? h[1] : h}</div>)}
            {s.notes?.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        )}

        <div className="grid-2">
          <div className="stack">
            <div className="card">
              <div className="card-head"><h2>Price, buy zone and fair value</h2><span className="faint small">3 years, weekly</span></div>
              <PriceChart history={s.history} zone={s.buy_zone} fair={s.fair_value} addMore={s.add_more} />
              {s.fair_value_views?.length > 0 && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Fair value is the average of {s.fair_value_views.map((v) => `${v.name.toLowerCase()} ${money(v.value)}`).join(" and ")}.
                  The buy zone is 75% to 90% of fair value; buy in thirds.
                </p>
              )}
            </div>
          <div className="card">
            <div className="card-head"><h2>Key figures</h2><span className="faint small">Trailing twelve months to {date(f.period_end)}, from SEC filings</span></div>
            <div className="kv" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {[
                ["Revenue", big(f.revenue, f.currency)],
                ["Net income", big(f.net_income, f.currency)],
                ["Cash earnings (EBITDA)", big(f.ebitda, f.currency)],
                ["Free cash flow", big(f.fcf, f.currency)],
                ["Cash", big(f.cash, f.currency)],
                ["Debt", big(f.debt, f.currency)],
                ["Earnings per share", f.eps != null ? money(f.eps) : "—"],
                ["Price to earnings", f.pe != null ? num(f.pe, 1) + "x" : "—"],
                ["Own 5-year median P/E", f.pe_median != null ? num(f.pe_median, 1) + "x" : "—"],
                ["Value to cash earnings", f.ev_ebitda != null ? num(f.ev_ebitda, 1) + "x" : "—"],
                ["Free cash flow yield", pct(f.fcf_yield)],
                ["Debt to cash earnings", f.leverage != null ? num(f.leverage, 1) + "x" : "—"],
                ["Revenue growth, 3 years", pct(f.rev_cagr, 1, true)],
                ["52-week range", s.tech?.lo52 ? `${money(s.tech.lo52)} to ${money(s.tech.hi52)}` : "—"],
                ["200-day average", money(s.tech?.ma200)],
              ].map(([k, v]) => (
                <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
              ))}
            </div>
            <p className="small faint" style={{ marginTop: 12 }}>P/E means price to earnings. EBITDA means earnings before interest, taxes, depreciation and amortization.</p>
          </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Why this score</h2><span className="faint small">50 is neutral</span></div>
            {ORDER.filter((p) => s.pillars?.[p]).map((p) => {
              const pl = s.pillars[p];
              return (
                <div className="pillar" key={p}>
                  <div className="pillar-head">
                    <h3>{pl.label} <span className="faint small" style={{ fontWeight: 450 }}>· weight {pl.weight}%</span></h3>
                    <span className="num" style={{ fontWeight: 620 }}>{pl.score != null ? num(pl.score, 0) : "—"}</span>
                  </div>
                  <div className="pbar">
                    {pl.score != null && <div className="fill" style={{ width: `${pl.score}%` }} />}
                    <div className="mid" />
                  </div>
                  <ul className="inputs">
                    {pl.inputs.map((inp, i) => (
                      <li key={i}><span className="s">{num(inp.score, 0)}</span><span><strong style={{ fontWeight: 550, color: "var(--text)" }}>{inp.name}.</strong> {inp.why}</span></li>
                    ))}
                    {pl.inputs.length === 0 && <li>No inputs available; this pillar is left out and the rest are scaled up.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Events affecting {s.ticker}</h2><Link href="/events/" className="small">All events</Link></div>
          {events.length === 0 && <p className="muted">No live events in the log touch this stock.</p>}
          {events.map((e) => (
            <div className="event" key={e.id}>
              <div className="event-meta"><span className="pill">{e.type}</span><span>{date(e.date)}</span><span>· {e.likelihood}</span></div>
              <h3 style={{ marginTop: 6 }}>{e.title}</h3>
              <ul className="effects">
                {e.effects.filter((x) => (x.tickers || []).includes(s.ticker) || (x.subsectors || []).includes(s.subsector)).map((x, i) => (
                  <li key={i}><ImpactText n={x.impact} /> {x.why}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
