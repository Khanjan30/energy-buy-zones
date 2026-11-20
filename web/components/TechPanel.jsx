import { money, pct } from "@/lib/format";
import { TREND_PLAIN, rsiPlain } from "@/lib/plain";

function Row({ label, value, note }) {
  return (
    <div className="tech-row">
      <div className="tech-k">{label}</div>
      <div className="tech-v num">{value}</div>
      {note && <div className="tech-note">{note}</div>}
    </div>
  );
}

export default function TechPanel({ t }) {
  if (!t || t.price == null) return <p className="muted">No price data yet.</p>;
  const oldData = t.trend === undefined;
  const pos = t.range_pos ?? (t.hi52 && t.lo52 && t.hi52 > t.lo52 ? (t.price - t.lo52) / (t.hi52 - t.lo52) : null);
  const vs = (avg) => (avg ? `${t.price >= avg ? "+" : ""}${Math.round((t.price / avg - 1) * 100)}% vs price` : "");
  return (
    <div>
      {oldData && <p className="small faint" style={{ marginBottom: 10 }}>Trend, momentum and returns appear after the next data run.</p>}
      {t.trend && <Row label="Trend" value={t.trend} note={TREND_PLAIN[t.trend]} />}
      <Row label="50-day average" value={money(t.ma50)} note={`Average price over the last 50 trading days. Today's price is ${t.ma50 ? (t.price >= t.ma50 ? "above" : "below") : "—"} it (${vs(t.ma50)}).`} />
      <Row label="200-day average" value={money(t.ma200)} note={`Average over the last 200 trading days, about 10 months. Long-term holders watch this line most. Today's price is ${t.ma200 ? (t.price >= t.ma200 ? "above" : "below") : "—"} it (${vs(t.ma200)}).`} />
      {t.rsi14 != null && <Row label="Momentum (RSI, relative strength index)" value={t.rsi14.toFixed(0)} note={`${rsiPlain(t.rsi14)} Scale 0 to 100; under 30 is oversold, over 70 is overbought.`} />}
      <div className="tech-row">
        <div className="tech-k">52-week range</div>
        <div className="tech-v num">{money(t.lo52)} to {money(t.hi52)}</div>
        {pos != null && (
          <div className="tech-note">
            <div className="range52"><span className="range52-dot" style={{ left: `${pos * 100}%` }} /></div>
            Today is {Math.round(pos * 100)}% of the way from the year&apos;s low to its high{t.from_hi52 != null ? `, ${Math.round(-t.from_hi52 * 100)}% below the high` : ""}.
          </div>
        )}
      </div>
      {t.ret_1m !== undefined && (
        <div className="tech-row">
          <div className="tech-k">Price change</div>
          <div className="returns">
            {[["1 month", t.ret_1m], ["3 months", t.ret_3m], ["1 year", t.ret_1y]].map(([l, v]) => (
              <div key={l}><div className="faint small">{l}</div><div className="num" style={{ fontWeight: 600, color: v == null ? undefined : v >= 0 ? "var(--good-ink)" : "var(--critical-ink)" }}>{pct(v, 1, true)}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
