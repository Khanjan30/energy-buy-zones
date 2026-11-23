"use client";
import { useEffect, useState } from "react";
import { ago, stamp } from "@/lib/format";

// Weekday runs land in the evening; anything older than about four days means a run was missed.
const STALE_HOURS = 100;

export default function Freshness({ updated, asof, variant = "rail" }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  if (!updated) return variant === "rail" ? <>Waiting for the first data run.</> : null;
  const stale = now != null && now - new Date(updated).getTime() > STALE_HOURS * 3600e3;
  if (variant === "badge") {
    return (
      <span className={`fresh-badge ${stale ? "stale" : ""}`} title={`Updated ${stamp(updated)}`}>
        <span className="fresh-dot" aria-hidden />
        <span>Updated {stamp(updated, false)}{now ? <span className="faint">, {ago(updated, now)}</span> : null}</span>
      </span>
    );
  }
  return (
    <>
      <span className={`fresh ${stale ? "stale" : ""}`} aria-hidden />
      Updated {stamp(updated)}.
      <br />Prices as of {asof}. {stale ? "This is older than usual; the nightly run may have failed." : "Refreshes every weekday evening after the market closes."}
    </>
  );
}
