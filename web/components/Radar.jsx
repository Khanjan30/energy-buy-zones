// Five-point shape of the quality score. One axis per part, 0 at the center, 100 at the edge.
const AXES = [["value", "Cheap"], ["strength", "Sturdy"], ["growth", "Growing"], ["policy", "Policy"], ["outside", "Outside risks"]];

export default function Radar({ series, size = 300 }) {
  const c = size / 2, R = size / 2 - 62;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }} role="img"
      aria-label={series.map((s) => `${s.name}: ${AXES.map(([k, l]) => `${l} ${s.values[k] == null ? "n/a" : Math.round(s.values[k])}`).join(", ")}`).join("; ")}>
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={AXES.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke={r === 50 ? "var(--ink-3)" : "var(--grid)"} strokeDasharray={r === 50 ? "3 3" : undefined} />
      ))}
      {AXES.map(([k, l], i) => {
        const [x, y] = pt(i, 100);
        const [lx, ly] = pt(i, 116);
        return (
          <g key={k}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" />
            <text x={lx} y={ly + 4} textAnchor={lx < c - 5 ? "end" : lx > c + 5 ? "start" : "middle"} fontSize="11" fill="var(--ink-2)">{l}</text>
          </g>
        );
      })}
      {series.map((s) => {
        const pts = AXES.map(([k], i) => pt(i, s.values[k] ?? 0).join(",")).join(" ");
        return (
          <g key={s.name}>
            <polygon points={pts} fill={s.color} fillOpacity={series.length > 1 ? 0.1 : 0.18} stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {AXES.map(([k], i) => s.values[k] != null && <circle key={k} cx={pt(i, s.values[k])[0]} cy={pt(i, s.values[k])[1]} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />)}
          </g>
        );
      })}
    </svg>
  );
}
