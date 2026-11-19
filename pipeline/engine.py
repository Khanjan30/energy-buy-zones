"""Score the whole universe on a given date, using only data public by then."""
from datetime import timedelta

from . import scoring
from .financials import Financials, Prices, correlation, growth, pe_history_median


class Driver:
    def __init__(self, rec):
        self.name = rec["name"]
        self.label = rec.get("label", rec["name"])
        self.is_rate = self.name == "us10y"
        # Uranium is entered by hand once a month, so allow its last value to be up to 45 days old.
        self.series = Prices(rec["series"], max_gap=45 if self.name == "uranium" else 10)


def technicals(prices, asof):
    day, last = prices.last(asof)
    if last is None:
        return {}
    ma50 = prices.moving_average(asof, 50)
    ma200 = prices.moving_average(asof, 200)
    year = prices.window(asof, 365)
    prev = prices.window(asof, 10)
    change = (prev[-1] / prev[-2] - 1) * 100 if len(prev) >= 2 and prev[-2] else None
    return {
        "date": day.isoformat(), "price": last, "change_pct": round(change, 2) if change is not None else None,
        "ma50": round(ma50, 2) if ma50 else None, "ma200": round(ma200, 2) if ma200 else None,
        "hi52": max(year) if year else None, "lo52": min(year) if year else None,
        "above_ma50": bool(ma50 and last > ma50), "below_ma200": bool(ma200 and last < ma200),
    }


def driver_inputs(prices, driver, asof):
    if driver is None:
        return None, None
    weeks = 156
    sp = prices.weekly(asof, weeks)
    dv = driver.series.weekly(asof, weeks)
    sr, dr = [], []
    for i in range(1, len(sp)):
        a, b = sp[i - 1], sp[i]
        x, y = dv[i - 1], dv[i]
        sr.append((b / a - 1) if a and b else None)
        if x is None or y is None:
            dr.append(None)
        elif driver.is_rate:
            dr.append(y - x)
        else:
            dr.append((y / x - 1) if x else None)
    corr = correlation(sr, dr)
    now = driver.series.on(asof)
    then = driver.series.on(asof - timedelta(days=182))
    if now is None or then is None:
        return corr, None
    if driver.is_rate:
        trend = scoring.clip((now - then) / 1.0, -1, 1)
    else:
        trend = scoring.clip((now / then - 1) / 0.20, -1, 1) if then else None
    return corr, trend


def metrics(stock, fin, prices, driver, asof):
    m = {"ticker": stock["ticker"]}
    tech = technicals(prices, asof) if not prices.empty else {}
    m["tech"] = tech
    price = tech.get("price")
    m["price"] = price
    if fin is None or fin.empty:
        m["no_financials"] = True
        return m
    s = fin.snapshot(asof)
    m["snapshot"] = s
    m["currency"] = fin.currency
    usd = fin.usd
    shares, eps = s["shares"], s["eps"]
    mcap = price * shares if (price and shares and usd) else None
    if usd:
        m["eps"] = eps
        m["pe"] = price / eps if (price and eps and eps > 0) else None
        m["pe_median"], _ = pe_history_median(fin, prices, asof) if (eps and eps > 0) else (None, 0)
        if mcap and s["ebitda"] and s["ebitda"] > 0 and s["debt"] is not None:
            ev = mcap + (s["debt"] or 0) - (s["cash"] or 0)
            m["ev_ebitda"] = ev / s["ebitda"] if ev > 0 else None
        m["fcf_yield"] = s["fcf"] / mcap if (mcap and s["fcf"] is not None) else None
        m["ps"] = mcap / s["revenue"] if (mcap and s["revenue"] and s["revenue"] > 0) else None
        m["fcf_per_share"] = s["fcf"] / shares if (s["fcf"] is not None and shares) else None
    # Ratios below are currency-neutral, so foreign reporters still get them.
    if s["ebitda"] is not None and s["debt"] is not None:
        nd = s["debt"] - (s["cash"] or 0)
        m["leverage"] = (nd / s["ebitda"]) if s["ebitda"] > 0 else (float("-inf") if nd <= 0 else float("inf"))
        if m["leverage"] == float("-inf"):
            m["leverage"] = 0.0
    if s["ebitda"] and s["interest"]:
        m["coverage"] = s["ebitda"] / s["interest"]
    m["fcf_pos"] = fin.fcf_positive_years(asof)
    if s["cash"] is not None and s["fcf"] is not None:
        m["runway"] = float("inf") if s["fcf"] >= 0 else s["cash"] / -s["fcf"]
    m["rev_cagr"], m["eps_cagr"] = growth(fin, asof)
    m["driver_corr"], m["driver_trend"] = driver_inputs(prices, driver, asof)
    m["driver_label"] = driver.label if driver else None
    return m


def group_peers(ms):
    return {
        "ps_median": scoring.peer_median([m.get("ps") for m in ms]),
        "ev_ebitda_median": scoring.peer_median([m.get("ev_ebitda") for m in ms]),
        "fcf_yield_median": scoring.peer_median([m.get("fcf_yield") for m in ms]),
        "fcf_yields": [m.get("fcf_yield") for m in ms],
        "rev_cagrs": [m.get("rev_cagr") for m in ms],
        "eps_cagrs": [m.get("eps_cagr") for m in ms],
    }


def score_universe(asof, universe, fins, prices, drivers, weights, events, exposures, include_manual=True):
    subs = universe["subsectors"]
    stocks = universe["stocks"]
    ms = {}
    for st in stocks:
        t = st["ticker"]
        p = prices.get(t)
        if p is None or p.empty or p.on(asof) is None:
            continue
        drv_name = st.get("driver", subs[st["subsector"]].get("driver"))
        drv = drivers.get(drv_name) if drv_name else None
        ms[t] = metrics(st, fins.get(t), p, drv, asof)
    by_group = {}
    for st in stocks:
        if st["ticker"] in ms:
            by_group.setdefault(st["subsector"], []).append(ms[st["ticker"]])
    peers = {g: group_peers(v) for g, v in by_group.items()}
    results = {}
    for st in stocks:
        t = st["ticker"]
        if t not in ms:
            continue
        g = st["subsector"]
        early = g == "early"
        regulated = st.get("regulated", subs[g].get("regulated", False))
        w = weights[g]
        if not include_manual:
            w = {k: v for k, v in w.items() if k not in ("policy", "outside")}
        res = scoring.score_stock(ms[t], peers[g], g, regulated, early, w, events,
                                  exposures.get(t, {}), asof, include_manual)
        res["metrics"] = ms[t]
        results[t] = res
    return results, peers


def load_inputs(universe, fin_recs, price_recs, driver_recs):
    fins = {t: Financials(r) for t, r in fin_recs.items() if r}
    prices = {t: Prices(r.get("closes", [])) for t, r in price_recs.items() if r}
    drivers = {n: Driver(r) for n, r in driver_recs.items() if r}
    return fins, prices, drivers
