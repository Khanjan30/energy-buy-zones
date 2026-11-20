"use client";
// Watchlist and portfolio live in this browser only (no accounts yet).
import { useEffect, useState } from "react";

const KEYS = { watch: "ebz.watchlist.v1", holdings: "ebz.holdings.v1" };
const EVENT = "ebz-store";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function useStored(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(read(key, fallback));
    setReady(true);
    const on = (e) => {
      if (!e.detail || e.detail === key) setValue(read(key, fallback));
    };
    const onStorage = (e) => e.key === key && setValue(read(key, fallback));
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, (v) => write(key, typeof v === "function" ? v(read(key, fallback)) : v), ready];
}

export function useWatchlist() {
  const [list, setList, ready] = useStored(KEYS.watch, []);
  const toggle = (t) => setList((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  return { list, has: (t) => list.includes(t), toggle, ready };
}

// Holdings: [{ ticker, shares, cost }] where cost is the average price paid per share.
export function useHoldings() {
  const [list, setList, ready] = useStored(KEYS.holdings, []);
  const upsert = (h) => setList((l) => {
    const rest = l.filter((x) => x.ticker !== h.ticker);
    return [...rest, h].sort((a, b) => a.ticker.localeCompare(b.ticker));
  });
  const remove = (t) => setList((l) => l.filter((x) => x.ticker !== t));
  return { list, upsert, remove, replace: setList, ready };
}
