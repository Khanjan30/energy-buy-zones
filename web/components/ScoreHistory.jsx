"use client";
import { useRef, useState } from "react";
import { date, money } from "@/lib/format";

const BANDS = [[70, 100, "Strong"], [50, 70, "Fair"], [40, 50, "Weak"], [0, 40, "Broken"]];

export default function ScoreHistory({ points, today }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const pts = [...(points || [])];
  if (today?.score != null) pts.push([today.date, today.score, today.band, today.action, today.price, true]);
  if (pts.length < 2) return <p className="muted small">Score history appears after the next weekly rescore.</p>;
  const W = 760, H = 220, P = { l: 56, r: 14, t: 10, b: 26 };
  const ts = pts.map((p) => new Date(p[0] + "T12:00:00Z").getTime());
  const t0 = ts[0], t1 = ts[ts.length - 1];
  const x = (t) => P.l + ((t - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(ts[i]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const years = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1));
  function move(e) {
    const b = ref.current.getBoundingClientRect();
    const sx = ((e.clientX - b.left) / b.width) * W;
    let best = 0;
    ts.forEach((t, i) => { if (Math.abs(x(t) - sx) < Math.abs(x(ts[best]) - sx)) best = i; });
    setHover(best);
  }
  const h = hover != null ? pts[hover] : null;
  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Quality score every quarter over five years">
        {BANDS.map(([lo, hi, label], i) => (
          <g key={label}>
            <rect x={P.l} width={W - P.l - P.r} y={y(hi)} height={y(lo) - y(hi)} fill={i % 2 ? "var(--surface)" : "var(--paper)"} />
            <text x={P.l - 8} y={(y(hi) + y(lo)) / 2 + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{label}</text>
          </g>
        ))}
        {years.map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{new Date(t).getUTCFullYear()}</text>)}
        <path d={d} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(ts[i])} cy={y(p[1])} r={p[5] ? 5 : 3} fill={p[5] ? "var(--volt)" : "var(--s1)"} stroke="var(--surface)" strokeWidth="1.5" />)}
        {h && <line x1={x(ts[hover])} x2={x(ts[hover])} y1={P.t} y2={H - P.b} stroke="var(--ink-3)" />}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(x(ts[hover]) / W) * 100}%`, top: `${(y(h[1]) / H) * 100}%` }}>
          <div className="faint">{h[5] ? "Today" : date(h[0])}</div>
          <div style={{ fontWeight: 650 }}>Quality {Math.round(h[1])}, {h[2]}</div>
          <div className="muted">{h[3]}{h[4] ? `, price ${money(h[4])}` : ""}</div>
        </div>
      )}
      <div className="legend">
        <span><i className="swatch line" style={{ background: "var(--s1)" }} /> Quality score each quarter, from filings public at the time</span>
        <span><i className="swatch" style={{ background: "var(--volt)", borderRadius: "50%", width: 10 }} /> Today</span>
      </div>
      <p className="small faint" style={{ marginTop: 4 }}>Past points leave out government policy and outside risks, which are kept by hand only for today, so today&apos;s score can sit apart from the line.</p>
    </div>
  );
}
