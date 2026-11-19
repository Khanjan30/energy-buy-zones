import { ACTION_GROUP } from "@/lib/format";

const ICON = { buy: "▲", hold: "■", trim: "▼", sell: "✕", none: "?" };

export default function ActionTag({ action }) {
  const g = ACTION_GROUP[action] || "none";
  return (
    <span className={`tag ${g}`}>
      <span className="dot" aria-hidden />
      <span className="tag-icon" aria-hidden>{ICON[g]}</span>
      {action || "Not enough data"}
    </span>
  );
}
