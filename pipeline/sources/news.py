"""Energy headlines from Google News RSS (free, no key).

Stores only headline, source, link and time, never article text. Topic feeds fill the
overview; one search per company fills the stock pages. If a fetch fails, the last good
file is kept.
"""
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import requests

from .. import config

FEED = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
TOPICS = [
    ("Energy markets", '"energy stocks" (NYSE OR Nasdaq OR "S&P 500") when:3d'),
    ("Oil and gas", '"oil prices" OR "natural gas prices" OR OPEC OR LNG when:2d'),
    ("Power and grid", 'utilities OR "power grid" OR "electricity demand" OR "data center power" when:3d'),
    ("Nuclear", '"nuclear power" OR uranium OR "small modular reactor" when:5d'),
    ("Solar and storage", '"solar" OR "battery storage" energy when:5d'),
    ("Policy and regulation", 'FERC OR "Department of Energy" OR "energy policy" OR "permitting reform" when:5d'),
]
SUFFIX = re.compile(r",?\s+(Inc\.?|Corp\.?|Corporation|Company|Co\.?|Holdings|Ltd\.?|plc|LP|L\.P\.|N\.V\.|S\.A\.)$", re.I)


# Names that are too vague once the legal suffix is gone.
OVERRIDES = {"SO": "Southern Company", "EQT": "EQT Corp", "ETN": "Eaton Corp", "D": "Dominion Energy", "ET": "Energy Transfer"}


def search_name(stock):
    return OVERRIDES.get(stock["ticker"]) or clean_name(stock["name"])


def clean_name(name):
    n = name
    for _ in range(2):
        n = SUFFIX.sub("", n).strip()
    return n


def parse(xml_text, limit=12):
    """Turn an RSS document into [{title, source, url, published}] newest first."""
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None and src_el.text else ""
        # Google appends " - Source" to every title; drop it, the source is shown on its own.
        if source and title.endswith(" - " + source):
            title = title[: -len(source) - 3].strip()
        try:
            published = parsedate_to_datetime(item.findtext("pubDate") or "").astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            published = None
        if title and link.startswith("http"):
            out.append({"title": title, "source": source, "url": link, "published": published})
    out.sort(key=lambda x: x["published"] or "", reverse=True)
    return out[:limit]


def tag(items, stocks):
    """Mark which stocks each headline mentions, by ticker in brackets or by company name."""
    keys = []
    for s in stocks:
        nm = search_name(s)
        keys.append((s["ticker"], re.compile(rf"(\({re.escape(s['ticker'])}\)|\b{re.escape(nm)}\b)", re.I) if len(nm) > 3 else
                     re.compile(rf"\({re.escape(s['ticker'])}\)")))
    for it in items:
        it["tickers"] = [t for t, rx in keys if rx.search(it["title"])]
    return items


def _get(q, session):
    r = session.get(FEED.format(q=quote(q)), timeout=20, headers={"User-Agent": "Mozilla/5.0 (energy-buy-zones research bot)"})
    r.raise_for_status()
    return r.text


def update(universe, log=print):
    path = config.WEB_DATA / "news.json"
    old = config.load_json(path, None)
    stocks = universe["stocks"]
    session = requests.Session()
    topics, by_ticker, seen, failures = [], {}, set(), 0
    for name, q in TOPICS:
        try:
            items = tag(parse(_get(q, session), 14), stocks)
        except Exception as e:  # network or rate limit
            failures += 1
            log(f"  news topic {name}: {e}")
            items = []
        fresh = [i for i in items if i["title"].lower() not in seen]
        seen.update(i["title"].lower() for i in fresh)
        topics.append({"name": name, "items": fresh[:8]})
        time.sleep(1.0)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    for s in stocks:
        q = f'"{search_name(s)}" when:10d'
        try:
            items = parse(_get(q, session), 8)
        except Exception as e:
            failures += 1
            log(f"  news {s['ticker']}: {e}")
            items = []
        by_ticker[s["ticker"]] = [i for i in items if (i["published"] or "") >= cutoff][:6]
        time.sleep(0.8)
    total = sum(len(t["items"]) for t in topics) + sum(len(v) for v in by_ticker.values())
    if total == 0 and old:
        log("  news: nothing fetched, keeping the previous file")
        return old
    data = {"fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"), "topics": topics,
            "by_ticker": by_ticker, "failures": failures}
    config.save_json(path, data, compact=True)
    log(f"  news: {total} headlines, {failures} failed requests")
    return data
