import Link from "next/link";
import ActionTag from "@/components/ActionTag";
import PriceChart from "@/components/PriceChart";
import PriceLadder from "@/components/PriceLadder";
import TechPanel from "@/components/TechPanel";
import Pending from "@/components/Pending";
import { getScores } from "@/lib/data";
import { big, date, money, num, pct } from "@/lib/format";
import { ACTION_PLAIN, chartZone, priceCheck, summary } from "@/lib/plain";

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
const PILLAR_PLAIN = {
  value: ["Is it cheap?", "Price compared with what the company earns and the cash it brings in."],
  strength: ["Can it survive bad times?", "Debt, cash, and whether it keeps producing spare cash."],
  growth: ["Is it growing?", "Sales and profit growth, and whether its main market (oil, gas, rates or uranium) is moving its way."],
  policy: ["Are governments helping or hurting?", "Laws, regulators, elections, trade and interest rates, from the event log."],
  outside: ["Outside risks", "Storms, wildfires, wars, cyber attacks and supply problems."],
};

function ImpactText({ n }) {
  return <span className={`impact ${n > 0 ? "pos" : n < 0 ? "neg" : ""}`}>{n > 0 ? `+${n}` : n}</span>;
}

function ZoneBox({ title, how, zone, price, empty }) {
  const pc = zone ? priceCheck(price, { low: zone[0], high: zone[1] }) : null;
  return (
    <div className="zonebox">
      <div className="small muted">{title}</div>
      {zone ? (
        <>
          <div className="zonebox-v num">{money(zone[0])} to {money(zone[1])}</div>
          <div className={`zonebox-check ${pc?.where}`}>{pc?.where === "in" ? "Today's price is inside this range" : `Today's price is ${pc?.text}`}</div>
        </>
      ) : (
        <div className="zonebox-v faint" style={{ fontSize: 15 }}>{empty}</div>
      )}
      <p className="small faint" style={{ marginTop: 8 }}>{how}</p>
    </div>
  );
}

export default async function StockPage({ params }) {
  const { ticker } = await params;
  const data = getScores();
  const s = data?.stocks?.find((x) => x.ticker === ticker);
  if (!s) return <Pending what="stock pages" />;
  const f = s.financials || {};
  const t = s.tech || {};
  const cz = chartZone(t);
  const events = (data.events || []).filter((e) => (s.event_ids || []).includes(e.id));
  const noFairWhy = s.subsector === "early"
    ? "Not used for early-stage companies: they have no steady profits to value."
    : s.notes?.find((n) => n.startsWith("Reports in"))
      ? "Not available: this company reports in a foreign currency, which version 1 skips."
      : "Not available: the free SEC filings did not give enough earnings or cash flow history.";

  return (
    <>
      <div className="page-head" style={{ paddingBottom: 12 }}>
        <div>
          <div className="small"><Link href="/">← All stocks</Link> · {s.subsector_label}</div>
          <h1 style={{ marginTop: 8 }}>{s.ticker} <span className="muted" style={{ fontWeight: 450 }}>{s.name}</span></h1>
          <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 640 }} className="num">{money(t.price)}</span>
            {t.change_pct != null && (
              <span className="num" style={{ color: t.change_pct >= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}>{pct(t.change_pct / 100, 2, true)} today</span>
            )}
            <span className="faint small">as of {date(t.date)}</span>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card answer">
          <div className="answer-top">
            <div>
              <div className="small muted">The short answer</div>
              <div className="answer-action"><ActionTag action={s.action} /></div>
              <p className="answer-text">{ACTION_PLAIN[s.action] || ""}</p>
              <p className="muted" style={{ marginTop: 6 }}>{summary(s)}</p>
            </div>
            <div className="answer-score">
              <div className="small muted">Quality score</div>
              <div className="tile-value">{s.score != null ? num(s.score, 0) : "—"}<span className="muted" style={{ fontSize: 14 }}> / 100</span></div>
              <div className="small faint">{s.band}{s.coverage < 1 ? ` · ${Math.round(s.coverage * 100)}% of inputs` : ""}</div>
            </div>
          </div>
          <PriceLadder price={t.price} zone={s.buy_zone} fair={s.fair_value} addMore={s.add_more} techZone={cz} />
        </div>

        {(s.hard_fails?.length > 0) && (
          <div className="banner">
            {s.hard_fails.map((h, i) => <div key={i}><strong>Red flag:</strong> {Array.isArray(h) ? h[1] : h}</div>)}
          </div>
        )}

        <div className="card">
          <div className="card-head"><h2>Good price to buy</h2><span className="faint small">Two ways of looking at it</span></div>
          <div className="grid-2 even">
            <ZoneBox
              title="From the company's numbers"
              zone={s.buy_zone}
              price={t.price}
              empty={noFairWhy}
              how={s.fair_value ? `We estimate the stock is worth about ${money(s.fair_value)} a share from its earnings and cash flow. The good range is 75% to 90% of that, which leaves room for error. Buy in thirds; add more below ${money(s.add_more)}.` : "Uses earnings and cash flow from SEC filings to estimate what a share is worth."}
            />
            <ZoneBox
              title="From the price chart"
              zone={cz}
              price={t.price}
              empty="Needs at least 200 days of prices."
              how="A pullback to the 200-day average, down to 8% below it. For long-term buyers, dips to this line have often been calmer entry points. If the price is far below it, the stock is falling; wait for it to steady."
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h2>Price chart</h2><span className="faint small">Weekly closes</span></div>
            <PriceChart
              history={s.history}
              zone={s.buy_zone || cz}
              zoneLabel={s.buy_zone ? "Good buying range (company's numbers)" : "Good buying range (chart)"}
              fair={s.fair_value}
            />
          </div>
          <div className="card">
            <div className="card-head"><h2>Technical analysis</h2><span className="faint small">What the price itself says</span></div>
            <TechPanel t={t} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Why this quality score</h2><span className="faint small">Each part runs 0 to 100; 50 is neutral</span></div>
          <div className="pillars">
            {ORDER.filter((p) => s.pillars?.[p]).map((p) => {
              const pl = s.pillars[p];
              const [q, d] = PILLAR_PLAIN[p];
              return (
                <details className="pillar" key={p}>
                  <summary>
                    <div className="pillar-head">
                      <div>
                        <h3>{q}</h3>
                        <div className="small faint">{d}</div>
                      </div>
                      <span className="num" style={{ fontWeight: 640, fontSize: 18 }}>{pl.score != null ? num(pl.score, 0) : "—"}</span>
                    </div>
                    <div className="pbar">
                      {pl.score != null && <div className="fill" style={{ width: `${pl.score}%` }} />}
                      <div className="mid" />
                    </div>
                    <div className="small faint">Counts for {pl.weight}% of the score · <span className="more">show details</span></div>
                  </summary>
                  <ul className="inputs">
                    {pl.inputs.map((inp, i) => (
                      <li key={i}><span className="s">{num(inp.score, 0)}</span><span><strong style={{ fontWeight: 550, color: "var(--text)" }}>{inp.name}.</strong> {inp.why}</span></li>
                    ))}
                    {pl.inputs.length === 0 && <li>No data for this part, so it is left out and the other parts count for more.</li>}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>News and events that affect {s.ticker}</h2><Link href="/events/" className="small">All events</Link></div>
          {events.length === 0 && <p className="muted">Nothing in the event log touches this stock right now.</p>}
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

        <details className="card">
          <summary className="card-head" style={{ marginBottom: 0, cursor: "pointer" }}>
            <h2>Company numbers</h2><span className="faint small">From SEC filings, last twelve months to {date(f.period_end)} · show</span>
          </summary>
          <div className="kv" style={{ marginTop: 14 }}>
            {[
              ["Sales", big(f.revenue, f.currency)],
              ["Profit", big(f.net_income, f.currency)],
              ["Cash earnings", big(f.ebitda, f.currency)],
              ["Spare cash (free cash flow)", big(f.fcf, f.currency)],
              ["Cash", big(f.cash, f.currency)],
              ["Debt", big(f.debt, f.currency)],
              ["Profit per share", f.eps != null ? money(f.eps) : "—"],
              ["Price to profit", f.pe != null ? num(f.pe, 1) + "x" : "—"],
              ["Its usual price to profit (5 years)", f.pe_median != null ? num(f.pe_median, 1) + "x" : "—"],
              ["Spare cash as % of price", pct(f.fcf_yield)],
              ["Debt vs yearly cash earnings", f.leverage != null ? num(f.leverage, 1) + "x" : "—"],
              ["Sales growth per year, 3 years", pct(f.rev_cagr, 1, true)],
            ].map(([k, v]) => (
              <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
            ))}
          </div>
          {s.notes?.length > 0 && <div className="small faint" style={{ marginTop: 12 }}>{s.notes.join(" ")}</div>}
        </details>
      </div>
    </>
  );
}
