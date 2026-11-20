// A tiny trend line. Color follows direction over the period; the label beside it carries the number.
export default function Sparkline({ values, width = 88, height = 26, color }) {
  const v = (values || []).filter((x) => x != null);
  if (v.length < 2) return <span style={{ display: "inline-block", width, height }} />;
  const lo = Math.min(...v), hi = Math.max(...v);
  const x = (i) => (i / (v.length - 1)) * (width - 2) + 1;
  const y = (n) => height - 2 - ((n - lo) / (hi - lo || 1)) * (height - 4);
  const d = v.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join("");
  const stroke = color || (v[v.length - 1] >= v[0] ? "var(--s1)" : "var(--s2)");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="2.2" fill={stroke} />
    </svg>
  );
}
