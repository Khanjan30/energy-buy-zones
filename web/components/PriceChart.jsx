"use client";
import { useRef, useState } from "react";
import { date, money } from "@/lib/format";

const W = 760, H = 300, PAD = { l: 52, r: 16, t: 14, b: 28 };

function ticks(lo, hi, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n || 1)));
  const err = ((hi - lo) / n) / step;
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(v);
  return out;
}

export default function PriceChart({ history, zone, fair, addMore }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  if (!history || history.length < 2) return <p className="muted">No price history yet.</p>;

  const pts = history.map(([d, p]) => [new Date(d + "T12:00:00Z").getTime(), p]);
  const vals = pts.map((p) => p[1]).concat([zone?.[0], zone?.[1], fair, addMore].filter((v) => v != null));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padY = (hi - lo) * 0.06 || 1;
  lo = Math.max(0, lo - padY);
  hi = hi + padY;
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const yt = ticks(lo, hi);
  const years = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1));

  function move(e) {
    const box = ref.current.getBoundingClientRect();
    const sx = ((e.clientX - box.left) / box.width) * W;
    const t = t0 + ((sx - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - t) < Math.abs(pts[best][0] - t)) best = i;
    setHover(best);
  }

  const h = hover != null ? pts[hover] : null;
  return (
    <div className="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Weekly closing price for three years, with buy zone and fair value">
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)">${v % 1 ? v.toFixed(1) : v}</text>
          </g>
        ))}
        {years.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-3)">{new Date(t).getUTCFullYear()}</text>
        ))}
        {zone && (
          <rect x={PAD.l} width={W - PAD.l - PAD.r} y={y(zone[1])} height={Math.max(1, y(zone[0]) - y(zone[1]))} fill="var(--zone)" />
        )}
        {fair != null && <line x1={PAD.l} x2={W - PAD.r} y1={y(fair)} y2={y(fair)} stroke="var(--text-2)" strokeDasharray="5 4" strokeWidth="1.5" />}
        {addMore != null && <line x1={PAD.l} x2={W - PAD.r} y1={y(addMore)} y2={y(addMore)} stroke="var(--text-3)" strokeDasharray="2 4" strokeWidth="1.5" />}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={x(h[0])} x2={x(h[0])} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-3)" strokeWidth="1" />
            <circle cx={x(h[0])} cy={y(h[1])} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(x(h[0]) / W) * 100}%`, top: `${(y(h[1]) / H) * 100}%` }}>
          <div className="faint">{date(new Date(h[0]).toISOString().slice(0, 10))}</div>
          <div className="num" style={{ fontWeight: 600 }}>{money(h[1])}</div>
        </div>
      )}
      <div className="legend">
        <span><i className="swatch line" style={{ background: "var(--accent)" }} /> Weekly close</span>
        {zone && <span><i className="swatch" style={{ background: "var(--zone)" }} /> Buy zone {money(zone[0])} to {money(zone[1])}</span>}
        {fair != null && <span><i className="swatch dash" /> Fair value {money(fair)}</span>}
        {addMore != null && <span><i className="swatch dash" style={{ borderTopStyle: "dotted", borderTopColor: "var(--text-3)" }} /> Add more below {money(addMore)}</span>}
      </div>
    </div>
  );
}
