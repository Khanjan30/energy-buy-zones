export function money(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const n = Number(x);
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function big(x, currency = "USD") {
  if (x === null || x === undefined) return "—";
  const sign = x < 0 ? "-" : "";
  const a = Math.abs(x);
  const unit = a >= 1e12 ? [1e12, "T"] : a >= 1e9 ? [1e9, "B"] : a >= 1e6 ? [1e6, "M"] : [1, ""];
  const prefix = currency === "USD" ? "$" : currency + " ";
  return `${sign}${prefix}${(a / unit[0]).toFixed(unit[1] ? 1 : 0)}${unit[1]}`;
}

export function pct(x, digits = 1, signed = false) {
  if (x === null || x === undefined) return "—";
  const v = x * 100;
  return (signed && v > 0 ? "+" : "") + v.toFixed(digits) + "%";
}

export function num(x, digits = 1) {
  if (x === null || x === undefined) return "—";
  return Number(x).toFixed(digits);
}

export function date(s) {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T12:00:00Z" : s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Action groups drive both color and filters. Color is never the only signal: each tag also has an icon and text.
export const ACTION_GROUP = {
  "Buy, check the news": "buy",
  "Buy": "buy",
  "Buy small": "buy",
  "Buy small, 3% cap": "buy",
  "Hold": "hold",
  "Hold if owned, review": "hold",
  "Watch": "hold",
  "Trim": "trim",
  "Avoid": "sell",
  "Sell": "sell",
  "Not enough data": "none",
};

export const GROUP_LABEL = { buy: "Buy signals", hold: "Hold or watch", trim: "Trim", sell: "Sell or avoid", none: "Not enough data" };
