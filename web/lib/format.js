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

// "Nov 21, 2026, 10:36 PM ET" in New York time, whatever time zone the site is built in.
export function stamp(iso, withYear = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day}, ${time} ET`;
}

export function ago(iso, now = Date.now()) {
  if (!iso) return "";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const dd = Math.round(h / 24);
  return `${dd} ${dd === 1 ? "day" : "days"} ago`;
}
