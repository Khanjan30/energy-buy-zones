// A small bar for the table: the shaded part is the good buying range, the dot is today's price.
export default function MiniRange({ price, range }) {
  if (price == null || !range) return null;
  const lo = Math.min(range.low, price) * 0.9;
  const hi = Math.max(range.high, price) * 1.1;
  const x = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <span className="minirange" aria-hidden>
      <span className="band" style={{ left: `${x(range.low)}%`, width: `${Math.max(2, x(range.high) - x(range.low))}%` }} />
      <span className="pt" style={{ left: `${x(price)}%` }} />
    </span>
  );
}
