"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { date, pct } from "@/lib/format";

const SLOTS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c7)"];
const FAMILY_LABEL = {
  value: "Value", strength: "Strength", growth: "Growth", technical: "Technicals",
  politics: "Politics and laws", macro: "Rates, oil, gas", current: "Current formula",
};
const VERDICT_CLASS = { "Clear edge": "buy", "Some edge": "buy", "Weak or unproven": "hold", "No edge": "sell", "Not enough data": "none" };

export const fmtSkill = (v) => (v == null ? "n/a" : (v >= 0 ? "+" : "") + v.toFixed(3));

export function Verdict({ v }) {
  return (
    <span className={`tag ${VERDICT_CLASS[v] || "none"}`}>
      <span className="dot" aria-hidden />
      <span className="tag-icon" aria-hidden>{v === "Clear edge" || v === "Some edge" ? "▲" : v === "No edge" ? "✕" : "■"}</span>
      {v}
    </span>
  );
}

export function SkillBar({ v, max = 0.15 }) {
  if (v == null) return <span className="faint small">n/a</span>;
  const w = Math.min(1, Math.abs(v) / max) * 50;
  return (
    <span className="skillbar" title={fmtSkill(v)}>
      <span className="skillbar-track">
        <span className="skillbar-mid" />
        <span className="skillbar-fill" style={{ left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? "var(--div-pos)" : "var(--div-neg)" }} />
      </span>
      <span className="num small" style={{ minWidth: 48, textAlign: "right" }}>{fmtSkill(v)}</span>
    </span>
  );
}

function GrowthChart({ series, bench, testStart }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 800, H = 300, P = { l: 52, r: 130, t: 12, b: 26 };
  const all = [...series.flatMap((s) => s.curve), ...(bench || [])];
  if (all.length < 2) return <p className="muted">Not enough history yet.</p>;
  const ts = (d) => new Date(d + "T12:00:00Z").getTime();
  const t0 = Math.min(...all.map((p) => ts(p[0]))), t1 = Math.max(...all.map((p) => ts(p[0])));
  // Log scale, so a doubling looks the same size early and late.
  const vals = all.map((p) => p[1]).filter((v) => v > 0);
  const lo = Math.log(Math.min(...vals, 100) * 0.92), hi = Math.log(Math.max(...vals, 100) * 1.08);
  const x = (t) => P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (Math.log(v) - lo) / (hi - lo)) * (H - P.t - P.b);
  const ticks = [50, 100, 200, 400, 800, 1600].filter((v) => Math.log(v) >= lo && Math.log(v) <= hi);
  const lines = [...series.map((s) => ({ ...s, pts: s.curve })), { name: "Own every stock", color: "var(--ink-3)", pts: bench || [], dash: true }];
  const ends = lines.filter((l) => l.pts.length).map((l) => ({ l, v: l.pts[l.pts.length - 1][1] })).map((e) => ({ ...e, yy: y(e.v) })).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14;
  const years = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr += 2) years.push(Date.UTC(yr, 0, 1));
  function move(e) {
    const b = ref.current.getBoundingClientRect();
    const t = t0 + ((((e.clientX - b.left) / b.width) * W - P.l) / (W - P.l - P.r)) * (t1 - t0);
    setHover(t);
  }
  const near = (pts) => pts.reduce((best, p) => (Math.abs(ts(p[0]) - hover) < Math.abs(ts(best[0]) - hover) ? p : best), pts[0]);
  const hx = hover != null && lines[0].pts.length ? x(ts(near(lines[0].pts)[0])) : null;
  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Growth of $100 in each formula's top 10 stocks against owning every stock">
        {testStart && (
          <g>
            <rect x={x(ts(testStart))} y={P.t} width={W - P.r - x(ts(testStart))} height={H - P.t - P.b} fill="var(--volt-soft)" opacity="0.5" />
            <text x={x(ts(testStart)) + 6} y={P.t + 14} fontSize="11" fill="var(--ink-2)">Test years, never used to build the learned formula</text>
          </g>
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke={v === 100 ? "var(--ink-3)" : "var(--grid)"} strokeDasharray={v === 100 ? "4 3" : undefined} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">${v}</text>
          </g>
        ))}
        {years.map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{new Date(t).getUTCFullYear()}</text>)}
        {lines.map((l) => l.pts.length > 1 && (
          <path key={l.name} d={l.pts.map((p, i) => `${i ? "L" : "M"}${x(ts(p[0])).toFixed(1)},${y(p[1]).toFixed(1)}`).join("")} fill="none" stroke={l.color} strokeWidth={l.dash ? 1.6 : 2} strokeDasharray={l.dash ? "5 4" : undefined} strokeLinejoin="round" />
        ))}
        {ends.map((e) => (
          <text key={e.l.name} x={W - P.r + 6} y={e.yy + 4} fontSize="11" fill="var(--ink-2)">
            <tspan fill={e.l.color}>●</tspan> ${Math.round(e.v)} {e.l.short || ""}
          </text>
        ))}
        {hx != null && <line x1={hx} x2={hx} y1={P.t} y2={H - P.b} stroke="var(--ink-3)" />}
      </svg>
      {hx != null && (
        <div className="tooltip" style={{ left: `${(hx / W) * 100}%`, top: "16%" }}>
          <div className="faint">{date(near(lines[0].pts)[0])}</div>
          {lines.filter((l) => l.pts.length).map((l) => <div key={l.name} className="num"><span style={{ color: l.color }}>●</span> {l.name}: ${Math.round(near(l.pts)[1])}</div>)}
        </div>
      )}
      <div className="legend">
        {lines.map((l) => <span key={l.name}><i className={`swatch ${l.dash ? "dash" : "line"}`} style={l.dash ? { borderTopColor: l.color } : { background: l.color }} />{l.name}</span>)}
      </div>
    </div>
  );
}

export default function Lab({ data }) {
  const ranked = useMemo(() => [...data.strategies].sort((a, b) => (b.test?.skill ?? -9) - (a.test?.skill ?? -9)), [data]);
  const [picked, setPicked] = useState(() => {
    const top = ranked.slice(0, 2).map((s) => s.id);
    return [...new Set([...top, "v1"])].slice(0, 3);
  });
  const byId = Object.fromEntries(data.strategies.map((s) => [s.id, s]));
  function toggle(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? [...p.slice(1), id] : [...p, id]));
  }
  const colorOf = (id) => SLOTS[picked.indexOf(id) % SLOTS.length];
  const series = picked.map((id) => byId[id]).filter((s) => s?.portfolio).map((s) => ({ name: s.name, color: colorOf(s.id), curve: s.portfolio.curve }));
  const bench = ranked.find((s) => s.portfolio)?.portfolio?.bench_curve;

  return (
    <div className="stack">
      <div className="panel flush">
        <div className="panel-head" style={{ padding: "16px 18px 0" }}>
          <h2>Leaderboard</h2>
          <span className="small faint">Sorted by skill in the test years. Tick formulas to compare them on the chart.</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th aria-label="Show on chart" />
                <th>Formula</th>
                <th>Skill, training years</th>
                <th>Skill, test years</th>
                <th className="r">Right more often than not</th>
                <th className="r">Top 10 a year vs all, test years</th>
                <th className="r">Worst drop</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const pt = s.portfolio_test;
                return (
                  <tr key={s.id} style={picked.includes(s.id) ? { background: "color-mix(in srgb, var(--volt-soft) 50%, transparent)" } : undefined}>
                    <td style={{ width: 34 }}>
                      <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} aria-label={`Show ${s.name} on the chart`} style={{ accentColor: picked.includes(s.id) ? undefined : "var(--ink)" }} />
                      {picked.includes(s.id) && <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: colorOf(s.id), marginLeft: 4 }} />}
                    </td>
                    <td style={{ minWidth: 260 }}>
                      <strong style={{ fontWeight: 650 }}>{s.name}</strong>
                      <div className="small muted">{s.plain}</div>
                      <div className="chips" style={{ marginTop: 5 }}>{s.families.map((f) => <span key={f} className="pill">{FAMILY_LABEL[f] || f}</span>)}</div>
                    </td>
                    <td><SkillBar v={s.train?.skill} /></td>
                    <td><SkillBar v={s.test?.skill} /></td>
                    <td className="r num">{s.test?.hit != null ? pct(s.test.hit, 0) : "n/a"}<div className="tiny faint">of quarters</div></td>
                    <td className={`r num ${pt?.excess_cagr >= 0 ? "up" : "down"}`}>{pt ? pct(pt.excess_cagr, 1, true) : "n/a"}<div className="tiny faint">{pt ? `${pct(pt.cagr, 1, true)} vs ${pct(pt.bench_cagr, 1, true)}` : ""}</div></td>
                    <td className="r num">{s.portfolio ? pct(s.portfolio.max_drawdown, 0) : "n/a"}</td>
                    <td><Verdict v={s.verdict} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>What $100 would have grown to</h2>
          <span className="small faint">Each formula&apos;s 10 best-scored stocks, rebalanced every quarter, against owning every stock equally</span>
        </div>
        <GrowthChart series={series} bench={bench} testStart={data.test_period?.[0]} />
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Today&apos;s top picks by formula</h2><span className="small faint">The best formulas from the leaderboard, scored on today&apos;s data</span></div>
        <div className="cols-3">
          {ranked.filter((s) => s.picks?.length).slice(0, 3).map((s) => (
            <div key={s.id}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}><h3>{s.name}</h3><Verdict v={s.verdict} /></div>
              <ol className="picks">
                {s.picks.map((p) => <li key={p.ticker}><Link href={`/stock/${p.ticker}/`} className="ticker">{p.ticker}</Link><span className="num faint small">{p.score.toFixed(0)}</span></li>)}
              </ol>
            </div>
          ))}
        </div>
        <p className="small faint" style={{ marginTop: 10 }}>Scores run 0 to 100 and rank each stock against the other 55 on that formula&apos;s signals.</p>
      </div>
    </div>
  );
}
