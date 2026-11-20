"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { date } from "@/lib/format";

const TYPES = ["Government decision", "Rule change", "Government change", "Trade and tariffs", "Interest rates", "Geopolitical", "Cyber attack", "Natural disaster", "Weather"];
const LIKELY = { happening: "Happening", likely: "Likely", early: "Early signal" };

export default function EventsList({ events }) {
  const [type, setType] = useState("all");
  const present = useMemo(() => TYPES.filter((t) => events.some((e) => e.type === t)), [events]);
  const shown = events.filter((e) => type === "all" || e.type === type);

  return (
    <div className="panel">
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${type === "all" ? "on" : ""}`} onClick={() => setType("all")}>All ({events.length})</button>
        {present.map((t) => (
          <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
            {t} ({events.filter((e) => e.type === t).length})
          </button>
        ))}
      </div>
      {shown.map((e) => (
        <div className="event" key={e.id}>
          <div className="event-meta">
            <span className="pill">{e.type}</span>
            <span className="pill">{e.pillar === "policy" ? "Policy pillar" : "Outside pressure pillar"}</span>
            <span>{date(e.date)}</span>
            <span>{LIKELY[e.likelihood] || e.likelihood}</span>
            <span>Review by {date(e.review_date)}</span>
          </div>
          <h3 style={{ marginTop: 6 }}>{e.title}</h3>
          {e.summary && <p className="muted" style={{ marginTop: 4 }}>{e.summary}</p>}
          <ul className="effects">
            {e.effects.map((x, i) => (
              <li key={i}>
                <span className={`impact ${x.impact > 0 ? "pos" : x.impact < 0 ? "neg" : ""}`}>{x.impact > 0 ? `+${x.impact}` : x.impact}</span>{" "}
                {(x.tickers || []).map((t, j) => (
                  <span key={t}>{j ? ", " : ""}<Link href={`/stock/${t}/`}>{t}</Link></span>
                ))}
                {(x.subsectors || []).length > 0 && <span>{(x.tickers || []).length ? ", " : ""}all of {x.subsectors.join(", ").replace(/_/g, " ")}</span>}
                {": "}{x.why}
              </li>
            ))}
          </ul>
          {e.source_url && (
            <div className="small" style={{ marginTop: 6 }}>
              Source: <a href={e.source_url} target="_blank" rel="noreferrer">{e.source_name || "link"}</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
