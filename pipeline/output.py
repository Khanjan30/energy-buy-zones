"""Shape engine results into the JSON files the web app reads."""
import math
from datetime import date, datetime, timedelta, timezone

from .financials import Prices
from .scoring import ACTION_RANK, OUTSIDE_TYPES, POLICY_TYPES


def clean(x):
    """Make values JSON-safe: no infinities or NaNs."""
    if isinstance(x, float):
        if math.isinf(x) or math.isnan(x):
            return None
        return round(x, 4)
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    return x


def weekly_history(prices: Prices, asof: date, years=3):
    out = []
    for k in range(years * 52, -1, -1):
        day = asof - timedelta(weeks=k)
        p = prices.on(day)
        if p is not None:
            m50, m200 = prices.moving_average(day, 50), prices.moving_average(day, 200)
            out.append([day.isoformat(), round(p, 2), round(m50, 2) if m50 else None, round(m200, 2) if m200 else None])
    return out


def stock_record(st, label, res, prices, fin):
    m = res["metrics"]
    snap = m.get("snapshot") or {}
    notes = []
    if m.get("no_financials"):
        notes.append("No financial filings found in the SEC's free data, so only price-based and event inputs are scored.")
    elif m.get("currency") and m["currency"] != "USD":
        notes.append(f"Reports in {m['currency']}, so valuation inputs that compare price with earnings are skipped in version 1.")
    if res["coverage"] < 1:
        notes.append(f"Scored on {round(res['coverage'] * 100)}% of the pillar weight; missing inputs are left out rather than guessed.")
    for last_before, n in (getattr(fin, "splits", None) or []):
        # Only splits that touch the five-year valuation window, and not early-stage companies,
        # where big share sales can look like a split.
        if st["subsector"] == "early" or last_before < f"{date.today().year - 6}":
            continue
        kind = f"{int(n)}-for-1 stock split" if n >= 1 else f"1-for-{round(1 / n)} reverse split"
        notes.append(f"Share counts before {last_before[:7]} are adjusted for a {kind}, so past earnings per share line up with today's prices.")
    return {
        "ticker": st["ticker"], "name": st["name"], "subsector": st["subsector"], "subsector_label": label,
        "status": "scored",
        "tech": m.get("tech", {}),
        "score": res["score"], "band": res["band"], "action": res["action"],
        "position": res["position"], "price_to_fair": res["price_to_fair"],
        "fair_value": res["fair_value"], "fair_value_views": res["fair_value_views"],
        "buy_zone": res["buy_zone"], "add_more": res["add_more"],
        "pillars": res["pillars"], "hard_fails": res["hard_fails"], "coverage": res["coverage"],
        "event_ids": res.get("event_ids", []),
        "market_cap": m.get("mcap"),
        "financials": {
            "currency": m.get("currency"), "period_end": snap.get("period_end"),
            "revenue": snap.get("revenue"), "net_income": snap.get("net_income"),
            "ebitda": snap.get("ebitda"), "fcf": snap.get("fcf"), "cash": snap.get("cash"),
            "debt": snap.get("debt"), "eps": m.get("eps"), "pe": m.get("pe"), "pe_median": m.get("pe_median"),
            "ev_ebitda": m.get("ev_ebitda"), "fcf_yield": m.get("fcf_yield"),
            "leverage": m.get("leverage"), "rev_cagr": m.get("rev_cagr"),
        },
        "notes": notes,
        # Which SEC tags were found and how recent each one is; used to track down data gaps.
        "sec_check": {k: [v.get("tag"), max((f[1] for f in v.get("facts", [])), default=None)]
                      for k, v in ((fin.rec.get("items") or {}).items() if fin else [])},
        "history": weekly_history(prices, date.fromisoformat(m["tech"]["date"])) if m.get("tech") else [],
    }


def tracked_record(t, prices):
    rec = {"ticker": t["ticker"], "name": t["name"], "status": t["status"], "note": t.get("note")}
    if t.get("deal_price"):
        rec["deal_price"] = t["deal_price"]
    if prices and not prices.empty:
        day, last = prices.last()
        rec["tech"] = {"date": day.isoformat(), "price": last}
        rec["history"] = weekly_history(prices, day)
        if t.get("deal_price"):
            rec["deal_upside_pct"] = round((t["deal_price"] / last - 1) * 100, 2)
    return rec


def event_record(ev):
    e = dict(ev)
    e["pillar"] = "policy" if ev.get("type") in POLICY_TYPES else "outside" if ev.get("type") in OUTSIDE_TYPES else "other"
    return e


def build(asof, universe, results, prices, fins, drivers, events, sources):
    subs = universe["subsectors"]
    stocks = []
    for st in universe["stocks"]:
        res = results.get(st["ticker"])
        if res:
            stocks.append(stock_record(st, subs[st["subsector"]]["label"], res, prices[st["ticker"]], fins.get(st["ticker"])))
        else:
            stocks.append({"ticker": st["ticker"], "name": st["name"], "subsector": st["subsector"],
                           "subsector_label": subs[st["subsector"]]["label"], "status": "no_data",
                           "notes": ["No price history yet."]})
    stocks.sort(key=lambda s: (ACTION_RANK.get(s.get("action"), 11), -(s.get("score") or 0)))
    drv = {}
    for name, d in drivers.items():
        now = d.series.on(asof)
        then = d.series.on(asof - timedelta(days=182))
        drv[name] = {
            "label": d.label, "latest": now, "change_6m": (now - then) if (now is not None and then is not None) else None,
            "is_rate": d.is_rate, "history": weekly_history(d.series, asof),
        }
    return clean({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "asof": asof.isoformat(),
        "sources": sources,
        "subsectors": {k: v["label"] for k, v in subs.items()},
        "stocks": stocks,
        "tracked": [tracked_record(t, prices.get(t["ticker"])) for t in universe.get("tracked", [])],
        "drivers": drv,
        "events": [event_record(e) for e in sorted(events, key=lambda e: e["date"], reverse=True)],
    })
