import profiles from "@/lib/profiles.json";
import { big, date } from "@/lib/format";

const BUILDERS = new Set(["utilities"]);
const MOOD = { good: ["Good sign", "buy"], ok: ["Okay", "hold"], watch: ["Watch", "trim"], bad: ["Weak spot", "sell"], none: ["No data", "none"] };

const per100 = (x) => `$${Math.abs(Math.round(x * 100))}`;
const yrs = (x) => (x < 1 ? "less than a year" : `about ${x < 10 ? x.toFixed(1) : Math.round(x)} years`);

/** Turn the company's numbers into short sentences anyone can read. */
export function explain(s) {
  const f = s.financials || {};
  const sub = s.subsector;
  const builder = BUILDERS.has(sub);
  const early = sub === "early";
  const rows = [];

  if (s.market_cap) {
    rows.push({
      k: "Size", v: big(s.market_cap), mood: "none",
      text: `If you bought every share, the whole company would cost ${big(s.market_cap)}.`,
    });
  }

  if (f.revenue > 0) {
    const g = f.rev_cagr;
    const growth = g == null ? "" : g > 0.15 ? ` Sales have grown fast, about ${Math.round(g * 100)}% a year over three years.` :
      g > 0.03 ? ` Sales have grown about ${Math.round(g * 100)}% a year over three years.` :
      g > -0.03 ? " Sales have been roughly flat over three years." : ` Sales have shrunk about ${Math.round(-g * 100)}% a year over three years.`;
    rows.push({
      k: "Sales", v: big(f.revenue),
      mood: g == null ? "ok" : g > 0.08 ? "good" : g > -0.03 ? "ok" : "watch",
      text: `Customers paid it ${big(f.revenue)} in the last 12 months.${growth}`,
    });
  } else {
    rows.push({ k: "Sales", v: f.revenue === 0 || early ? "None yet" : "n/a", mood: early ? "watch" : "none",
      text: early ? "It does not sell much yet. You are paying for what it might earn years from now, which is the riskiest kind of stock." : "Sales figures were not available in its filings." });
  }

  if (f.net_income != null) {
    if (f.revenue > 0) {
      const m = f.net_income / f.revenue;
      rows.push({
        k: "Profit", v: big(f.net_income),
        mood: m > 0.15 ? "good" : m > 0.05 ? "ok" : m > 0 ? "watch" : "bad",
        text: m >= 0
          ? `After paying all its costs, it keeps ${per100(m)} of every $100 in sales as profit${m > 0.15 ? ", which is healthy" : m < 0.05 ? ", a thin cushion" : ""}.`
          : `It spends more than it earns, losing ${per100(m)} for every $100 in sales.`,
      });
    } else {
      rows.push({ k: "Profit", v: big(f.net_income), mood: f.net_income >= 0 ? "ok" : "bad",
        text: f.net_income >= 0 ? `It earned ${big(f.net_income)} in the last 12 months, mostly from interest or one-off gains.` : `It lost ${big(-f.net_income)} in the last 12 months while it builds its business.` });
    }
  }

  if (f.fcf != null) {
    const pos = f.fcf >= 0;
    rows.push({
      k: "Spare cash", v: big(f.fcf),
      mood: pos ? (f.fcf_yield > 0.05 ? "good" : "ok") : builder ? "ok" : "bad",
      text: pos
        ? `After paying for new equipment and buildings, it had ${big(f.fcf)} left over. That is the money that can pay dividends, buy back shares or pay down debt.`
        : builder
          ? `It spent ${big(-f.fcf)} more on new power lines and plants than its business brought in. That is normal for a utility: it borrows to build, then regulators let it charge customers for the new equipment over many years.`
          : `It spent ${big(-f.fcf)} more than its business brought in, so it has to use savings, borrow or sell new shares to keep going.${
            f.cash > 0 ? ` At this pace, its ${big(f.cash)} of cash would last ${yrs(f.cash / -f.fcf)}.` : ""}`,
    });
  }

  if (f.debt != null) {
    const net = f.debt - (f.cash || 0);
    const lev = f.leverage;
    let mood = "ok", text;
    if (net <= 0) {
      mood = "good";
      text = `It has more cash (${big(f.cash)}) than debt (${big(f.debt)}), so a bad year is unlikely to sink it.`;
    } else if (lev != null && lev > 0) {
      mood = lev < 2 ? "good" : lev < 3.5 ? "ok" : builder && lev < 6.5 ? "watch" : "bad";
      text = `It owes ${big(f.debt)} and holds ${big(f.cash)} in cash. Paying off the debt would take ${yrs(lev)} of its yearly cash earnings${lev < 2 ? ", which is light" : lev < 3.5 ? ", a normal amount" : builder ? ". That is high, but common for utilities, whose steady bills make lenders comfortable" : ", which is heavy and makes it sensitive to higher interest rates"}.`;
    } else if (lev == null && f.net_income > 0) {
      text = `It owes ${big(f.debt)} and holds ${big(f.cash)} in cash.`;
    } else {
      mood = "bad";
      text = `It owes ${big(f.debt)} and holds ${big(f.cash)} in cash, but it does not yet earn enough to pay that debt from its business.`;
    }
    rows.push({ k: "Debt", v: big(f.debt), mood, text });
  }

  if (f.pe != null && f.pe > 0) {
    const usual = f.pe_median;
    const vs = usual ? f.pe / usual - 1 : null;
    rows.push({
      k: "Price tag", v: `${f.pe.toFixed(1)}x`,
      mood: vs == null ? "ok" : vs < -0.15 ? "good" : vs < 0.15 ? "ok" : vs < 0.4 ? "watch" : "bad",
      text: `Each share costs about $${f.pe.toFixed(0)} for every $1 of yearly profit behind it${
        usual ? `. Over the past five years buyers usually paid $${usual.toFixed(0)}, so today it is ${vs < -0.15 ? "cheaper than usual" : vs < 0.15 ? "close to its usual price" : "more expensive than usual"}` : ""}.`,
    });
  } else if (f.net_income != null && f.net_income <= 0) {
    rows.push({ k: "Price tag", v: "No profit", mood: "watch", text: "With no profit, there is no simple price-to-profit tag. The price reflects hopes about the future." });
  }
  return rows;
}

function bottomLine(s, rows) {
  const by = Object.fromEntries(rows.map((r) => [r.k, r.mood]));
  const good = rows.filter((r) => r.mood === "good").map((r) => r.k.toLowerCase());
  const weak = rows.filter((r) => r.mood === "bad" || r.mood === "watch").map((r) => r.k.toLowerCase());
  if (s.subsector === "early") return "This is a bet on the future. The company is not yet a working business that pays for itself, so the stock can swing a lot on news, approvals and fundraising.";
  const parts = [];
  if (good.length) parts.push(`Strong points: ${good.join(", ")}.`);
  if (weak.length) parts.push(`Points to keep an eye on: ${weak.join(", ")}.`);
  if (by["Price tag"] === "bad" || by["Price tag"] === "watch") parts.push("A good business can still be a poor buy if you pay too much, which is why the buy range on this page sits below today's price.");
  else if (by["Price tag"] === "good") parts.push("The price is lower than buyers usually pay for it, which is when long-term buyers tend to look closer.");
  return parts.join(" ");
}

export default function BusinessSummary({ s }) {
  const p = profiles[s.ticker];
  const rows = explain(s);
  const f = s.financials || {};
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>The business in plain words</h2>
        <span className="faint small">{f.period_end ? `Numbers for the 12 months to ${date(f.period_end)}, from its filings with the Securities and Exchange Commission` : "From company filings"}</span>
      </div>
      {p && (
        <div className="biz-top">
          <div><div className="small muted">What it does</div><p>{p.what}</p></div>
          <div><div className="small muted">How it makes money</div><p>{p.money}</p></div>
          <div><div className="small muted">What to watch</div><p>{p.watch}</p></div>
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="biz-rows">
            {rows.map((r) => {
              const [label, cls] = MOOD[r.mood] || MOOD.none;
              return (
                <div key={r.k} className="biz-row">
                  <div className="biz-k">
                    <div style={{ fontWeight: 650 }}>{r.k}</div>
                    <div className="num muted">{r.v}</div>
                  </div>
                  <p className="biz-text">{r.text}</p>
                  <div>{r.mood !== "none" && <span className={`tag ${cls}`}><span className="dot" aria-hidden />{label}</span>}</div>
                </div>
              );
            })}
          </div>
          <div className="biz-bottom">
            <div className="small muted">What it adds up to</div>
            <p>{bottomLine(s, rows)}</p>
          </div>
        </>
      )}
    </div>
  );
}
