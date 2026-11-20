import fs from "node:fs";
import path from "node:path";

// The nightly job writes these files. DATA_DIR lets a local build point at sample data instead.
const DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

function read(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
  } catch {
    return null;
  }
}

export function getScores() {
  return read("scores.json");
}

export function getBacktest() {
  return read("backtest.json");
}

export function getSignals() {
  return read("signals.json");
}

// The fields client pages need for lists, tables and the heatmap; leaves out the heavy parts.
export function slim(s) {
  const h = s.history || [];
  return {
    ticker: s.ticker, name: s.name, subsector: s.subsector, subsector_label: s.subsector_label,
    tech: s.tech || null, score: s.score ?? null, band: s.band ?? null, action: s.action ?? null,
    position: s.position ?? null, price_to_fair: s.price_to_fair ?? null, fair_value: s.fair_value ?? null,
    buy_zone: s.buy_zone ?? null, add_more: s.add_more ?? null, market_cap: s.market_cap ?? null,
    pillars: Object.fromEntries(Object.entries(s.pillars || {}).map(([k, v]) => [k, v.score])),
    spark: h.slice(-26).map((r) => r[1]),
    event_count: (s.event_ids || []).length,
  };
}

export const REPO = process.env.NEXT_PUBLIC_REPO || "Khanjan30/energy-buy-zones";
