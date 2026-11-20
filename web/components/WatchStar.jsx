"use client";
import { useWatchlist } from "@/lib/store";

export default function WatchStar({ ticker, withLabel = false }) {
  const w = useWatchlist();
  const on = w.ready && w.has(ticker);
  const label = on ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`;
  if (withLabel) {
    return (
      <button className={`btn ${on ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); w.toggle(ticker); }} aria-pressed={on} aria-label={label}>
        <span aria-hidden style={{ color: on ? "var(--volt)" : "var(--ink-3)" }}>★</span>
        {on ? "On your watchlist" : "Add to watchlist"}
      </button>
    );
  }
  return (
    <button className={`star ${on ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); w.toggle(ticker); }} aria-pressed={on} aria-label={label} title={label}>
      {on ? "★" : "☆"}
    </button>
  );
}
