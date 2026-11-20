"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money, pct } from "@/lib/format";
import { goodRange, priceCheck } from "@/lib/plain";

// Squarified treemap: rectangles close to square so small companies stay readable.
function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  const rest = items.map((it) => ({ ...it, area: it.value * scale }));
  let rect = { x, y, w, h };
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    const mx = Math.max(...r.map((i) => i.area)), mn = Math.min(...r.map((i) => i.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const place = (r) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rect.w >= rect.h) {
      const cw = s / rect.h;
      let cy = rect.y;
      r.forEach((i) => { const ih = i.area / cw; out.push({ ...i, x: rect.x, y: cy, w: cw, h: ih }); cy += ih; });
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const rh = s / rect.w;
      let cx = rect.x;
      r.forEach((i) => { const iw = i.area / rh; out.push({ ...i, x: cx, y: rect.y, w: iw, h: rh }); cx += iw; });
      rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
    }
  };
  for (const it of rest) {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it);
    else { place(row); row = [it]; }
  }
  if (row.length) place(row);
  return out;
}

const LENSES = {
  day: {
    label: "Today's move",
    value: (s) => s.tech?.change_pct,
    // Diverging: red falls, blue rises, gray is flat. Capped at 4% either way.
    t: (v) => Math.max(-1, Math.min(1, v / 4)),
    text: (v) => pct(v / 100, 1, true),
    scale: ["Down 4% or more", "Flat", "Up 4% or more"],
  },
  range: {
    label: "Price vs good range",
    value: (s) => {
      const c = priceCheck(s.tech?.price, goodRange(s));
      if (!c) return null;
      return c.where === "in" ? 0 : c.where === "above" ? c.pct : -c.pct;
    },
    // Blue when the price is under the good range, red when above it.
    t: (v) => -Math.max(-1, Math.min(1, v / 0.4)),
    text: (v) => (v === 0 ? "In range" : v < 0 ? `${Math.round(-v * 100)}% under` : `${Math.round(v * 100)}% over`),
    scale: ["40% or more above", "In the range", "40% or more below"],
  },
  quality: {
    label: "Quality score",
    value: (s) => s.score,
    seq: true,
    t: (v) => Math.max(0, Math.min(1, (v - 20) / 60)),
    text: (v) => String(Math.round(v)),
    scale: ["20 or less", "", "80 or more"],
  },
};

function fill(lens, v) {
  if (v == null) return { bg: "var(--surface-2)", fg: "var(--ink-3)" };
  const t = LENSES[lens].t(v);
  if (LENSES[lens].seq) {
    return { bg: `color-mix(in oklab, var(--s1) ${Math.round(t * 100)}%, var(--div-mid))`, fg: t > 0.55 ? "#fff" : "var(--ink)" };
  }
  const a = Math.abs(t);
  const pole = t >= 0 ? "var(--div-pos)" : "var(--div-neg)";
  return { bg: `color-mix(in oklab, ${pole} ${Math.round(a * 100)}%, var(--div-mid))`, fg: a > 0.6 ? "#fff" : "var(--ink)" };
}

export default function Heatmap({ stocks, groups }) {
  const router = useRouter();
  const box = useRef(null);
  const [size, setSize] = useState({ w: 1000, h: 440 });
  const [lens, setLens] = useState("day");
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const caps = stocks.map((s) => s.market_cap).filter(Boolean).sort((a, b) => a - b);
    const med = caps.length ? caps[Math.floor(caps.length / 2)] : 1;
    // Size by company value, compressed so a $200B giant does not hide a $1B small cap.
    const val = (s) => Math.pow(s.market_cap || med, 0.55);
    const byGroup = Object.entries(groups).map(([k, label]) => {
      const items = stocks.filter((s) => s.subsector === k).map((s) => ({ s, value: val(s) })).sort((a, b) => b.value - a.value);
      return { key: k, label, value: items.reduce((a, b) => a + b.value, 0), items };
    }).filter((g) => g.items.length).sort((a, b) => b.value - a.value);
    const gRects = squarify(byGroup, 0, 0, size.w, size.h);
    return gRects.map((g) => ({ ...g, tiles: squarify(g.items, g.x, g.y + 18, g.w, Math.max(0, g.h - 18)) }));
  }, [stocks, groups, size]);

  const L = LENSES[lens];
  return (
    <div>
      <div className="panel-head">
        <div>
          <h2>Energy market map</h2>
          <p className="small muted" style={{ marginTop: 4 }}>Every stock in the model, grouped by sector and sized by company value. Click a tile to open it.</p>
        </div>
        <div className="seg" role="group" aria-label="Color the map by">
          {Object.entries(LENSES).map(([k, v]) => (
            <button key={k} className={lens === k ? "on" : ""} onClick={() => setLens(k)}>{v.label}</button>
          ))}
        </div>
      </div>
      <div className="heat" ref={box} onMouseLeave={() => setTip(null)}>
        {layout.map((g) => (
          <div key={g.key}>
            <div className="heat-group" style={{ left: g.x, top: g.y, width: g.w, height: g.h }}>
              <div className="heat-group-label" style={{ maxWidth: g.w - 10 }}>{g.label}</div>
            </div>
            {g.tiles.map(({ s, x, y, w, h }) => {
              const v = L.value(s);
              const c = fill(lens, v);
              const big = w > 46 && h > 30;
              return (
                <a
                  key={s.ticker}
                  href={`/stock/${s.ticker}/`}
                  onClick={(e) => { e.preventDefault(); router.push(`/stock/${s.ticker}/`); }}
                  className="heat-tile"
                  style={{ left: x, top: y, width: w, height: h, background: c.bg, color: c.fg }}
                  onMouseMove={(e) => setTip({ s, v, x: e.clientX, y: e.clientY })}
                  aria-label={`${s.ticker}, ${s.name}, ${L.label} ${v == null ? "not available" : L.text(v)}`}
                >
                  {big && <span className="heat-t" style={{ fontSize: Math.max(11, Math.min(20, Math.min(w / 4.2, h / 2.6))) }}>{s.ticker}</span>}
                  {big && h > 46 && <span className="heat-v">{v == null ? "n/a" : L.text(v)}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
        <div className="scale">
          <span>{L.scale[0]}</span>
          <span className="scale-bar" style={{ background: L.seq ? "linear-gradient(90deg, var(--div-mid), var(--s1))" : lens === "range" ? "linear-gradient(90deg, var(--div-neg), var(--div-mid), var(--div-pos))" : "linear-gradient(90deg, var(--div-neg), var(--div-mid), var(--div-pos))" }} />
          <span>{L.scale[2]}</span>
          {L.scale[1] && <span className="faint">Gray means {L.scale[1].toLowerCase()}</span>}
        </div>
        <span className="small faint">Hover a tile for details</span>
      </div>
      {tip && (
        <div className="heat-tip" style={{ left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240), top: tip.y + 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
            <span className="ticker">{tip.s.ticker}</span>
            <span className="num" style={{ fontWeight: 650 }}>{money(tip.s.tech?.price)}</span>
          </div>
          <div className="small muted">{tip.s.name}</div>
          <div className="small" style={{ marginTop: 6 }}>{L.label}: <strong>{tip.v == null ? "not available" : L.text(tip.v)}</strong></div>
          <div className="small muted">Quality {tip.s.score != null ? Math.round(tip.s.score) : "n/a"}, suggestion: {tip.s.action || "not enough data"}</div>
        </div>
      )}
    </div>
  );
}
