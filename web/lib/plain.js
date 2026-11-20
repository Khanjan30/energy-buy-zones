// Turns the model's numbers into short, plain sentences. Shared by the dashboard and stock pages.
import { money } from "./format";

// The one range shown as "good price to buy": from the company's numbers when there is a fair value,
// otherwise from the price chart.
export function chartZone(t) {
  if (t?.tech_zone) return t.tech_zone;
  // Same rule as the pipeline: a pullback to the 200-day average, down to 8% below it.
  return t?.ma200 ? [Math.round(t.ma200 * 92) / 100, t.ma200] : null;
}

export function goodRange(s) {
  if (s.buy_zone) return { low: s.buy_zone[0], high: s.buy_zone[1], source: "numbers" };
  const z = chartZone(s.tech);
  if (z) return { low: z[0], high: z[1], source: "chart" };
  return null;
}

export function priceCheck(price, r) {
  if (price == null || !r) return null;
  if (price < r.low) {
    const p = Math.round((1 - price / r.low) * 100);
    // Far below a chart range means the stock is falling; far below a value range can mean bad news.
    const far = p > 15;
    const note = far ? (r.source === "chart" ? ", falling fast" : ", check why") : "";
    return { where: far ? "far" : "below", pct: r.low / price - 1, text: p < 1 ? "just below the range" : `${p}% below the range${note}` };
  }
  if (price > r.high) {
    const p = Math.round((price / r.high - 1) * 100);
    return { where: "above", pct: price / r.high - 1, text: p < 1 ? "just above the range" : `${p}% above the range` };
  }
  return { where: "in", pct: 0, text: "inside the range" };
}

const QUALITY = {
  Strong: "a strong business",
  Fair: "a decent business",
  Weak: "a weak business",
  Broken: "a business with serious problems",
};

export const ACTION_PLAIN = {
  "Buy, check the news": "Buy, but read the latest news first. A price this far below fair value sometimes means something has gone wrong.",
  Buy: "Buy, in three steps rather than all at once.",
  "Buy small": "Buy a small amount. The business is decent, not great, so keep the position modest.",
  "Buy small, 3% cap": "A small position is fine, no more than 3% of your portfolio. Early-stage stocks can swing hard.",
  Hold: "If you own it, keep it. If you don't, wait for a better price.",
  "Hold if owned, review": "If you own it, keep it for now but watch it closely. Don't add more.",
  Watch: "Just watch it for now. No action yet.",
  Trim: "If you own it, think about selling part of it. The price has run ahead.",
  Avoid: "Don't buy. Cheap price, but the business is not strong enough.",
  Sell: "If you own it, the model says sell. The business looks too weak or the price too high.",
  "Not enough data": "Not enough data to judge yet.",
};

export const TREND_PLAIN = {
  Uptrend: "The price is rising: it sits above both its 50-day and 200-day averages.",
  Downtrend: "The price is falling: it sits below both its 50-day and 200-day averages.",
  Mixed: "The trend is unclear: the price is between its 50-day and 200-day averages.",
};

export function rsiPlain(r) {
  if (r == null) return null;
  if (r < 30) return "Oversold. The stock has dropped hard and fast; bounces often follow, but not always.";
  if (r > 70) return "Overbought. The stock has risen hard and fast; it often cools off.";
  return "Normal. No extreme buying or selling right now.";
}

export function summary(s) {
  const price = s.tech?.price;
  const r = goodRange(s);
  const pc = priceCheck(price, r);
  const parts = [];
  if (s.subsector === "early") parts.push(`${s.name} is an early-stage company that does not make steady profits yet.`);
  else if (s.band && QUALITY[s.band]) parts.push(`${s.name} looks like ${QUALITY[s.band]} (quality ${Math.round(s.score)} out of 100).`);
  if (r && pc) {
    const src = r.source === "numbers" ? "based on its earnings and cash flow" : "based on its price chart";
    const range = `${money(r.low)} to ${money(r.high)}`;
    if (pc.where === "in") parts.push(`At ${money(price)}, it is inside the good buying range of ${range}, ${src}.`);
    else {
      const base = pc.text.split(",")[0].replace("the range", "the good buying range");
      parts.push(`At ${money(price)}, it is ${base} of ${range}, ${src}.`);
      if (pc.where === "far") parts.push(r.source === "chart" ? "That far below its long-term average, the stock is falling; wait for it to steady." : "A drop that deep can mean bad news, so read up before buying.");
    }
  }
  return parts.join(" ");
}
