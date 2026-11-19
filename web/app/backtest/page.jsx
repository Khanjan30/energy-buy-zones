import Pending from "@/components/Pending";
import { getBacktest } from "@/lib/data";
import { date, pct } from "@/lib/format";

export const metadata = { title: "Backtest · Energy Buy Zones" };

function ExcessBars({ rows }) {
  // One measure, one axis: average 12-month return versus the group, centered on zero.
  const items = rows.filter((r) => r.n > 0);
  if (!items.length) return <p className="muted">Not enough observations yet.</p>;
  const W = 640, rowH = 34, L = 170, R = 70;
  const maxAbs = Math.max(0.05, ...items.map((r) => Math.abs(r.mean_excess)));
  const mid = L + (W - L - R) / 2;
  const scale = (W - L - R) / 2 / maxAbs;
  const H = items.length * rowH + 24;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average return versus the group by bucket">
        <line x1={mid} x2={mid} y1={0} y2={H - 20} stroke="var(--text-3)" />
        <text x={mid} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--text-3)">0 = same as the group</text>
        {items.map((r, i) => {
          const y = i * rowH + 6;
          const w = Math.abs(r.mean_excess) * scale;
          const pos = r.mean_excess >= 0;
          return (
            <g key={r.label}>
              <text x={0} y={y + 15} fontSize="12.5" fill="var(--text)">{r.label}</text>
              <text x={0} y={y + 28} fontSize="11" fill="var(--text-3)">{r.n} observations</text>
              <rect x={pos ? mid : mid - w} y={y + 4} width={Math.max(w, 1)} height={18} rx="4" fill={pos ? "var(--accent)" : "var(--neg)"} />
              <text x={W} y={y + 17} textAnchor="end" fontSize="12.5" fill="var(--text)" className="num">{pct(r.mean_excess, 1, true)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="swatch" style={{ background: "var(--accent)" }} /> Beat the group</span>
        <span><i className="swatch" style={{ background: "var(--neg)" }} /> Trailed the group</span>
      </div>
    </div>
  );
}

function Table({ title, obj }) {
  return (
    <div className="card">
      <div className="card-head"><h2>{title}</h2></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Bucket</th><th className="r">Observations</th><th className="r">Average return</th><th className="r">Median return</th><th className="r">Versus group</th><th className="r">Beat the group</th></tr>
          </thead>
          <tbody>
            {Object.entries(obj).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="r num">{v.n}</td>
                <td className="r num">{v.n ? pct(v.mean_return, 1, true) : "—"}</td>
                <td className="r num">{v.n ? pct(v.median_return, 1, true) : "—"}</td>
                <td className="r num">{v.n ? pct(v.mean_excess, 1, true) : "—"}</td>
                <td className="r num">{v.n ? pct(v.hit_rate, 0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const bt = getBacktest();
  if (!bt) return (<><div className="page-head"><h1>Backtest</h1></div><Pending what="backtest results" /></>);
  const bandRows = Object.entries(bt.by_band).map(([label, v]) => ({ label, ...v }));
  const actionRows = Object.entries(bt.by_action).map(([label, v]) => ({ label, ...v }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Does the formula work?</h1>
          <p className="muted">
            The model scored every stock four times a year for five years using only filings that were public on each date,
            then checked the next 12 months of price. {bt.observations} stock-dates across {bt.dates} test dates, run {date(bt.generated_for)}.
          </p>
        </div>
      </div>
      <div className="stack">
        <div className="grid-3">
          {bt.tests.map((t) => (
            <div className="card" key={t.name}>
              <div className="card-head">
                <h3>{t.name}</h3>
                <span className={`tag ${t.passed === true ? "buy" : t.passed === false ? "sell" : "none"}`}>
                  <span className="dot" aria-hidden />
                  {t.passed === true ? "Passed" : t.passed === false ? "Failed" : "Too early"}
                </span>
              </div>
              <p className="muted">{t.detail}</p>
            </div>
          ))}
          <div className="card">
            <div className="card-head"><h3>Read with care</h3></div>
            <p className="muted small">{bt.notes[0]} {bt.notes[1]}</p>
          </div>
        </div>
        <div className="grid-2 even">
          <div className="card">
            <div className="card-head"><h2>By score band</h2><span className="faint small">Average 12-month return versus the group</span></div>
            <ExcessBars rows={bandRows} />
          </div>
          <div className="card">
            <div className="card-head"><h2>By action</h2><span className="faint small">Average 12-month return versus the group</span></div>
            <ExcessBars rows={actionRows} />
          </div>
        </div>
        <Table title="By price versus fair value" obj={bt.by_position} />
        <Table title="By score band, full numbers" obj={bt.by_band} />
        <div className="card">
          <div className="card-head"><h2>How the test was run</h2></div>
          <ul className="prose" style={{ margin: 0, paddingLeft: 18 }}>
            {bt.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      </div>
    </>
  );
}
