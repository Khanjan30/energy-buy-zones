"use client";
import { useRef, useState } from "react";
import { date, money } from "@/lib/format";

const W = 760, H = 320, PAD = { l: 52, r: 54, t: 14, b: 28 };

function ticks(lo, hi, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n || 1)));
  const err = (hi - lo) / n / step;
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(v);
  return out;
}

function linePath(pts, x, y, idx) {
  let d = "", pen = false;
  pts.forEach((p) => {
    const v = p[idx];
    if (v == null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(p[0]).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

export default function PriceChart({ history, zone, zoneLabel, fair }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const [span, setSpan] = useState(1);
  if (!history || history.length < 2) return <p className="muted">No price history yet.</p>;

  const all = history.map(([d, p, m50, m200]) => [new Date(d + "T12:00:00Z").getTime(), p, m50 ?? null, m200 ?? null]);
  const cut = all[all.length - 1][0] - span * 365.25 * 864e5;
  const pts = all.filter((p) => p[0] >= cut);
  const hasMa = pts.some((p) => p[2] != null);
  const vals = pts.flatMap((p) => [p[1], p[2], p[3]]).concat([zone?.[0], zone?.[1], fair]).filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padY = (hi - lo) * 0.06 || 1;
  lo = Math.max(0, lo - padY);
  hi += padY;
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const yt = ticks(lo, hi);
  const marks = [];
  if (span > 1) for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) marks.push([Date.UTC(yr, 0, 1), String(yr)]);
  else for (let m = 0; m < 13; m += 3) { const d = new Date(t0); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 1); if (t < t1) marks.push([t, new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })]); }

  // Direct labels at the right end, nudged apart so they never overlap.
  const last = pts[pts.length - 1];
  const ends = [["Price", last[1], "var(--s1)"], ["50-day", last[2], "var(--s2)"], ["200-day", last[3], "var(--s3)"]]
    .filter((e) => e[1] != null).map((e) => [...e, y(e[1])]).sort((a, b) => a[3] - b[3]);
  for (let i = 1; i < ends.length; i++) if (ends[i][3] - ends[i - 1][3] < 13) ends[i][3] = ends[i - 1][3] + 13;

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
      <div className="chips" style={{ marginBottom: 8 }}>
        {[1, 3].map((n) => (
          <button key={n} className={`chip ${span === n ? "on" : ""}`} onClick={() => { setSpan(n); setHover(null); }}>{n === 1 ? "1 year" : "3 years"}</button>
        ))}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Weekly price with 50-day and 200-day averages and the good buying range">
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">${v % 1 ? v.toFixed(1) : v}</text>
          </g>
        ))}
        {marks.map(([t, l]) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{l}</text>)}
        {zone && <rect x={PAD.l} width={W - PAD.l - PAD.r} y={y(zone[1])} height={Math.max(1, y(zone[0]) - y(zone[1]))} fill="var(--zone)" />}
        {fair != null && <line x1={PAD.l} x2={W - PAD.r} y1={y(fair)} y2={y(fair)} stroke="var(--ink-2)" strokeDasharray="5 4" strokeWidth="1.5" />}
        {hasMa && <path d={linePath(pts, x, y, 3)} fill="none" stroke="var(--s3)" strokeWidth="1.5" strokeDasharray="6 3" />}
        {hasMa && <path d={linePath(pts, x, y, 2)} fill="none" stroke="var(--s2)" strokeWidth="1.5" />}
        <path d={linePath(pts, x, y, 1)} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {ends.map(([l, , c, yy]) => <text key={l} x={W - PAD.r + 6} y={yy + 4} fontSize="11" fill="var(--ink-2)"><tspan fill={c}>●</tspan> {l}</text>)}
        {h && (
          <g>
            <line x1={x(h[0])} x2={x(h[0])} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" />
            <circle cx={x(h[0])} cy={y(h[1])} r="4.5" fill="var(--s1)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent" />
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(x(h[0]) / W) * 100}%`, top: `${(y(h[1]) / H) * 100}%` }}>
          <div className="faint">{date(new Date(h[0]).toISOString().slice(0, 10))}</div>
          <div className="num" style={{ fontWeight: 600 }}>Price {money(h[1])}</div>
          {h[2] != null && <div className="num muted">50-day {money(h[2])}</div>}
          {h[3] != null && <div className="num muted">200-day {money(h[3])}</div>}
        </div>
      )}
      <div className="legend">
        <span><i className="swatch line" style={{ background: "var(--s1)" }} /> Weekly price</span>
        {hasMa && <span><i className="swatch line" style={{ background: "var(--s2)" }} /> 50-day average (short-term trend)</span>}
        {hasMa && <span><i className="swatch dash" style={{ borderTopColor: "var(--s3)" }} /> 200-day average (long-term trend)</span>}
        {zone && <span><i className="swatch" style={{ background: "var(--zone)" }} /> {zoneLabel}</span>}
        {fair != null && <span><i className="swatch dash" /> Fair value {money(fair)}</span>}
      </div>
    </div>
  );
}
