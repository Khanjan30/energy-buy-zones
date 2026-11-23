"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ago, stamp } from "@/lib/format";

function Item({ it, known, hideTickers }) {
  const [now, setNow] = useState(null);
  useEffect(() => setNow(Date.now()), []);
  const tickers = (it.tickers || []).filter((t) => known.has(t) && !hideTickers?.includes(t));
  return (
    <li className="news-item">
      <a href={it.url} target="_blank" rel="noreferrer" className="news-title">{it.title}</a>
      <div className="news-meta">
        <span>{it.source || "News"}</span>
        {it.published && <span className="faint" title={stamp(it.published)}>{now ? ago(it.published, now) : stamp(it.published, false)}</span>}
        {tickers.map((t) => <Link key={t} href={`/stock/${t}/`} className="news-tag">{t}</Link>)}
      </div>
    </li>
  );
}

export default function NewsFeed({ topics, tickers, fetched, compact = false }) {
  const known = new Set(tickers || []);
  const withItems = (topics || []).filter((t) => t.items?.length);
  const [tab, setTab] = useState(withItems[0]?.name);
  if (!withItems.length) {
    return <p className="muted small">Headlines appear here after the next weekday run.</p>;
  }
  const current = withItems.find((t) => t.name === tab) || withItems[0];
  return (
    <div>
      <div className="chips" role="tablist" aria-label="News topics" style={{ marginBottom: 12 }}>
        {withItems.map((t) => (
          <button key={t.name} role="tab" aria-selected={t.name === current.name} className={`chip ${t.name === current.name ? "on" : ""}`} onClick={() => setTab(t.name)}>
            {t.name}
          </button>
        ))}
      </div>
      <ul className={`news-list ${compact ? "" : "two"}`}>
        {current.items.map((it) => <Item key={it.url} it={it} known={known} />)}
      </ul>
      {fetched && <p className="tiny faint" style={{ marginTop: 10 }}>Headlines from Google News, collected {stamp(fetched)}. Links open the original publisher.</p>}
    </div>
  );
}

export function StockNews({ items, ticker, tickers, fetched }) {
  const known = new Set(tickers || []);
  if (!items?.length) return <p className="muted small">No headlines about {ticker} in the last two weeks.</p>;
  return (
    <div>
      <ul className="news-list">{items.map((it) => <Item key={it.url} it={it} known={known} hideTickers={[ticker]} />)}</ul>
      {fetched && <p className="tiny faint" style={{ marginTop: 10 }}>From Google News, collected {stamp(fetched)}.</p>}
    </div>
  );
}
