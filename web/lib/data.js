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

export const REPO = process.env.NEXT_PUBLIC_REPO || "Khanjan30/energy-buy-zones";
