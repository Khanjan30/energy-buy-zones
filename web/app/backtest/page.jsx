import Link from "next/link";
import Pending from "@/components/Pending";
import { getBacktest, getScores } from "@/lib/data";
import { date, pct } from "@/lib/format";

export const metadata = { title: "Backtest · Energy Buy Zones" };

const pts = (v) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)} pts`);
const val = (t, v) => (v == null ? "n/a" : t.unit === "rank" ? `beat ${Math.round(v * 100)}%` : pts(v));
// A gap this small could easily be luck, so it is shown as a tie rather than a pass or fail.
const tooClose = (t) => t.a != null && t.b != null && Math.abs(t.a - t.b) < (t.unit === "rank" ? 0.02 : 0.01);

function Verdict({ passed, tie }) {
  if (tie) return <span className="tag hold"><span className="dot" aria-hidden /><span className="tag-icon" aria-hidden>=</span>Too close to call</span>;
  const cls = passed === true ? "buy" : passed === false ? "sell" : "none";
  return (
    <span className={`tag ${cls}`}>
      <span className="dot" aria-hidden />
      <span className="tag-icon" aria-hidden>{passed === true ? "✓" : passed === false ? "✕" : "?"}</span>
      {passed === true ? "Passes" : passed === false ? "Fails" : "Too few cases"}
    </span>
  );
}

function ExcessBars({ rows, unit = "Average 12-month return versus the group" }) {
  const items = rows.filter((r) => r.n > 0 && r.value != null);
  if (!items.length) return <p className="muted">Not enough observations yet.</p>;
  const W = 640, rowH = 36, L = 190, R = 76;
  const maxAbs = Math.max(0.05, ...items.map((r) => Math.abs(r.value)));
  const mid = L + (W - L - R) / 2;
  const scale = (W - L - R) / 2 / maxAbs;
  const H = items.length * rowH + 24;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit}>
        <line x1={mid} x2={mid} y1={0} y2={H - 20} stroke="var(--ink-3)" />
        <text x={mid} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--ink-3)">0 means the same as the group</text>
        {items.map((r, i) => {
          const y = i * rowH + 6;
          const w = Math.abs(r.value) * scale;
          const pos = r.value >= 0;
          return (
            <g key={r.label}>
              <text x={0} y={y + 14} fontSize="12.5" fill="var(--ink)">{r.label}</text>
              <text x={0} y={y + 28} fontSize="11" fill="var(--ink-3)">{r.n} cases</text>
              <rect x={pos ? mid : mid - w} y={y + 4} width={Math.max(w, 1)} height={18} rx="4" fill={pos ? "var(--div-pos)" : "var(--div-neg)"} />
              <text x={W} y={y + 17} textAnchor="end" fontSize="12.5" fill="var(--ink)">{pts(r.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BacktestPage() {
  const bt = getBacktest();
  const scores = getScores();
  if (!bt) return (<><div className="page-head"><h1>Does the formula work?</h1></div><Pending what="backtest results" /></>);
  const dg = bt.diagnostics;
  const first = bt.dates && bt.per_date?.[0]?.date;
  const last = bt.per_date?.[bt.per_date.length - 1]?.date;
  const labels = scores?.subsectors || {};
  const q = dg?.quality_tests || [];
  const p = dg?.price_tests || [];
  const fairQ = q.find((t) => t.label === "Within each sector, no early-stage");
  const anyFair = q.slice(1).some((t) => t.passed && !tooClose(t));
  const fairQClear = fairQ?.passed && !tooClose(fairQ);
  const sectors = (dg?.by_sector || []).filter((s) => s.median_return != null).sort((a, b) => b.median_return - a.median_return);
  const winners = dg?.top_winners || [];
  const brokenWinners = winners.filter((w) => w.band === "Broken" || w.band === "Weak").length;
  const earlyWinners = winners.filter((w) => w.sub === "early").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Does the formula work?</h1>
          <p>
            A backtest asks a simple question: if you had used this formula in the past, would it have pointed you to better stocks?
            Right now the honest answer is <strong>not yet</strong>. This page explains what was tested, why it failed, and what we are changing.
          </p>
        </div>
      </div>

      <div className="stack">
        <div className="panel">
          <div className="panel-head"><h2>What the backtest does</h2><span className="small faint">{bt.dates} test dates from {date(first)} to {date(last)}, {bt.observations} stock checks in all</span></div>
          <ol className="steps">
            <li><strong>Go back in time.</strong> Pick a date, once every three months over the last five years.</li>
            <li><strong>Score every stock as it looked then.</strong> Only filings and prices that were public on that date count, so the formula cannot peek at the future.</li>
            <li><strong>Wait one year.</strong> Record how much each stock&apos;s price rose or fell over the next twelve months.</li>
            <li><strong>Check two promises.</strong> Did high-quality stocks beat low-quality ones? Did stocks bought cheap beat stocks bought expensive?</li>
          </ol>
          <p className="small faint" style={{ marginTop: 10 }}>Government policy and outside risks are left out of the test: they come from the hand-kept event log, and adding past events with hindsight would make the formula look smarter than it is.</p>
        </div>

        <div className="cols-even">
          {bt.tests.map((t) => (
            <div className="panel" key={t.name}>
              <div className="panel-head"><h3>{t.name === "Strong beats Weak" ? "Promise 1: good businesses do better" : "Promise 2: buying cheap does better"}</h3><Verdict passed={t.passed} /></div>
              <p className="muted">{t.detail}</p>
              <p className="small" style={{ marginTop: 8 }}>
                {t.name === "Strong beats Weak"
                  ? "In plain words: stocks the formula rated Strong did not beat the ones it rated Weak or Broken. If anything, the low-rated group did better."
                  : "In plain words: stocks priced inside or under their buy zone did worse than stocks the formula called expensive."}
              </p>
            </div>
          ))}
        </div>

        {dg && (
          <div className="panel">
            <div className="panel-head"><h2>Why it failed</h2><span className="small faint">Four things pulled the result off course</span></div>
            <div className="reasons">
              <div className="reason">
                <h3>A handful of huge winners skew the average</h3>
                <p className="muted small">The first test used averages, and one stock that triples outweighs ten that do fine. {brokenWinners} of the 12 biggest one-year gains came from stocks rated Weak or Broken at the time{earlyWinners ? `, and ${earlyWinners} of the 12 were early-stage companies` : ""}.</p>
                <ul className="mini-list">
                  {winners.slice(0, 6).map((w) => (
                    <li key={w.ticker + w.date}><Link href={`/stock/${w.ticker}/`} className="ticker">{w.ticker}</Link> <span className="num up">{pct(w.fwd, 0, true)}</span> <span className="faint">from {date(w.date)}, rated {w.band}</span></li>
                  ))}
                </ul>
              </div>
              <div className="reason">
                <h3>Whole sectors boomed and busted together</h3>
                <p className="muted small">Comparing every stock against every other mostly measures which sector was hot that year, not which company was better. The middle one-year return ranged widely by sector:</p>
                <ul className="mini-list">
                  {sectors.map((x) => <li key={x.key}><span>{x.sector}</span> <span className={`num ${x.median_return >= 0 ? "up" : "down"}`}>{pct(x.median_return, 0, true)}</span></li>)}
                </ul>
              </div>
              <div className="reason">
                <h3>Early-stage stocks break the quality test</h3>
                <p className="muted small">
                  Companies with no profits almost always score Broken, because the formula rewards earnings and cash. Yet their prices can jump on news alone.
                  {dg.early_share?.n ? ` Of ${dg.early_share.n} early-stage checks, ${dg.early_share.broken} were rated Broken, with a middle one-year return of ${pct(dg.early_share.median_return, 0, true)}.` : ""}
                </p>
              </div>
              <div className="reason">
                <h3>One year is short for a long-term formula</h3>
                <p className="muted small">The formula is built for owners who hold for years, but the test judged it after twelve months, when price swings matter more than business quality. It also counts price only, leaving out dividends, which favor the steady utilities and pipelines the formula likes.</p>
              </div>
            </div>
          </div>
        )}

        {dg && (
          <div className="panel flush">
            <div className="panel-head" style={{ padding: "16px 18px 0" }}>
              <h2>The same checks, measured more fairly</h2>
              <span className="small faint">Each row fixes one of the problems above</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Promise 1: good businesses do better</th><th>How it is measured</th><th className="r">Strong</th><th className="r">Weak or Broken</th><th>Result</th></tr></thead>
                <tbody>
                  {q.map((t) => (
                    <tr key={t.label}><td><strong style={{ fontWeight: 600 }}>{t.label}</strong></td><td className="small muted" style={{ maxWidth: 360 }}>{t.how}</td><td className="r num">{val(t, t.a)}</td><td className="r num">{val(t, t.b)}</td><td><Verdict passed={t.passed} tie={tooClose(t)} /></td></tr>
                  ))}
                </tbody>
              </table>
              <table style={{ borderTop: "1px solid var(--line)" }}>
                <thead><tr><th>Promise 2: buying cheap does better</th><th>How it is measured</th><th className="r">Cheap</th><th className="r">Expensive</th><th>Result</th></tr></thead>
                <tbody>
                  {p.map((t) => (
                    <tr key={t.label}><td><strong style={{ fontWeight: 600 }}>{t.label}</strong></td><td className="small muted" style={{ maxWidth: 360 }}>{t.how}</td><td className="r num">{val(t, t.a)}</td><td className="r num">{val(t, t.b)}</td><td><Verdict passed={t.passed} tie={tooClose(t)} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ padding: "12px 18px 16px" }}>
              {fairQClear
                ? "Measured within each sector and without early-stage names, high-quality stocks did beat low-quality ones. The formula picks better companies inside a sector; it does not predict which sector will be hot."
                : anyFair
                  ? "Some fairer versions pass and others do not, so the evidence is mixed. Treat the scores as one input, not a signal to follow on its own."
                  : "Even measured fairly, the checks fail. The scoring itself needs work, starting with the inputs listed below."}
              {dg.consistency?.dates ? ` Date by date, Strong beat Weak inside sectors on ${dg.consistency.wins} of ${dg.consistency.dates} test dates.` : ""}
            </p>
          </div>
        )}

        {dg && (
          <div className="panel flush">
            <div className="panel-head" style={{ padding: "16px 18px 0" }}><h2>Sector by sector</h2><span className="small faint">Share of same-sector stocks beaten over one year; 50% is average</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Sector</th><th className="r">Middle return</th><th className="r">Strong</th><th className="r">Weak or Broken</th><th>Does quality help here?</th></tr></thead>
                <tbody>
                  {sectors.map((x) => {
                    const ok = x.strong != null && x.weak != null && x.n_strong >= 5 && x.n_weak >= 5;
                    return (
                      <tr key={x.key}>
                        <td>{labels[x.key] || x.sector}<div className="tiny faint">{x.n} checks</div></td>
                        <td className={`r num ${x.median_return >= 0 ? "up" : "down"}`}>{pct(x.median_return, 1, true)}</td>
                        <td className="r num">{x.strong != null ? `${Math.round(x.strong * 100)}%` : "n/a"} <span className="tiny faint">({x.n_strong})</span></td>
                        <td className="r num">{x.weak != null ? `${Math.round(x.weak * 100)}%` : "n/a"} <span className="tiny faint">({x.n_weak})</span></td>
                        <td>{ok ? <Verdict passed={x.strong > x.weak} tie={Math.abs(x.strong - x.weak) < 0.02} /> : <span className="small faint">Too few cases</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-head"><h2>What we can do better</h2><span className="small faint">In order of priority</span></div>
          <ol className="steps">
            <li><strong>Judge stocks inside their own sector.</strong> Make the within-sector comparison the main test, and show each stock&apos;s rank inside its sector on its page. Done now as a diagnostic above.</li>
            <li><strong>Keep early-stage companies out of the quality test.</strong> Score them on cash runway and progress, and test them separately.</li>
            <li><strong>Count dividends.</strong> Use total return, so a utility paying 4% a year gets credit for it.</li>
            <li><strong>Test over three years, not one.</strong> That matches how the formula is meant to be used. It is already measured above, on the dates old enough to have three years of results.</li>
            <li><strong>Check which inputs carry the signal.</strong> Test value, strength and growth one at a time to see which help, then reweight. To avoid fitting the past too closely, tune on the older dates and confirm on the newest ones.</li>
            <li><strong>Widen the stock list.</strong> 56 stocks over 16 dates is a small sample, so luck plays a big part. Adding more energy names, including ones that failed or were bought out, would make the results steadier.</li>
          </ol>
        </div>

        <details className="panel">
          <summary className="panel-head" style={{ marginBottom: 0 }}><h2>Full results from the first run</h2><span className="small faint">Averages against all stocks. Click to show.</span></summary>
          <div className="cols-even" style={{ marginTop: 14 }}>
            <div><h3 style={{ marginBottom: 8 }}>By quality band</h3><ExcessBars rows={Object.entries(bt.by_band).map(([label, v]) => ({ label, n: v.n, value: v.mean_excess }))} /></div>
            <div><h3 style={{ marginBottom: 8 }}>By suggestion</h3><ExcessBars rows={Object.entries(bt.by_action).map(([label, v]) => ({ label, n: v.n, value: v.mean_excess }))} /></div>
          </div>
          <div style={{ marginTop: 16 }}><h3 style={{ marginBottom: 8 }}>By price against fair value</h3><ExcessBars rows={Object.entries(bt.by_position).map(([label, v]) => ({ label, n: v.n, value: v.mean_excess }))} /></div>
          <ul className="small muted" style={{ marginTop: 14, paddingLeft: 18 }}>{bt.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      </div>
    </>
  );
}
