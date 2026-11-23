"""Build a point-in-time panel of signals for every stock, every quarter.

For each date the panel holds raw signals in five families, each oriented so that a higher
value is expected to be better, plus the next 3-month and 12-month price returns:

- value: cheapness from filings public on that date
- strength: debt, interest cover, cash generation, margins
- growth: sales and earnings growth
- technical: momentum, trend, distance from the high, volatility, momentum oscillator
- politics and macro: how the stock has reacted to geopolitical risk, policy uncertainty,
  climate policy uncertainty, energy rule-making, interest rates, oil and gas, multiplied by
  where each of those is heading now; plus recent disasters in the states it serves

Political and macro signals only use data that was public by the date: news-based indexes are
lagged two months (they are published early the following month) and the rest one month.
"""
import math
from datetime import date, timedelta
from statistics import mean, pstdev

from .. import config, engine

SECTOR_AGENCIES = {
    "oil_gas": ["epa", "interior"], "gas_pipelines": ["ferc", "epa"], "utilities": ["ferc", "epa"],
    "power": ["ferc", "epa", "nrc"], "nuclear_fuel": ["nrc", "doe"], "grid": ["ferc", "doe"],
    "solar_storage": ["doe", "interior"], "early": ["nrc", "doe"],
}
NEWS_LAG, DATA_LAG = 2, 1
WINDOW = 36  # months used to learn how a stock reacts to each series


def quarter_dates(start, end):
    out, y, m = [], start.year, ((start.month - 1) // 3) * 3 + 1
    while True:
        d = date(y, m, 1)
        if d > end:
            break
        if d >= start:
            out.append(d)
        m += 3
        if m > 12:
            y, m = y + 1, 1
    return out


def month_key(y, m):
    while m < 1:
        y, m = y - 1, m + 12
    while m > 12:
        y, m = y + 1, m - 12
    return f"{y:04d}-{m:02d}"


def months_before(d, n, lag):
    """The n month keys ending `lag` months before the month of d (oldest first)."""
    return [month_key(d.year, d.month - lag - i) for i in range(n - 1, -1, -1)]


def month_end(key):
    y, m = int(key[:4]), int(key[5:])
    return date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)


def log_changes(series, log1p=False):
    keys = sorted(series)
    out = {}
    for a, b in zip(keys, keys[1:]):
        va, vb = series[a], series[b]
        try:
            out[b] = (math.log1p(vb) - math.log1p(va)) if log1p else (math.log(vb) - math.log(va))
        except (ValueError, TypeError):
            continue
    return out


def diffs(series):
    keys = sorted(series)
    return {b: series[b] - series[a] for a, b in zip(keys, keys[1:]) if series[a] is not None and series[b] is not None}


def monthly_returns(prices, keys):
    out = {}
    for a, b in zip(keys, keys[1:]):
        pa, pb = prices.on(month_end(a)), prices.on(month_end(b))
        if pa and pb:
            out[b] = pb / pa - 1
    return out


def beta(ys, xs, keys):
    """Slope of excess return on a standardized move in the series, over the given months."""
    pairs = [(xs[k], ys[k]) for k in keys if k in xs and k in ys]
    if len(pairs) < 24:
        return None
    sx = pstdev([p[0] for p in pairs])
    if not sx:
        return None
    mx, my = mean(p[0] for p in pairs), mean(p[1] for p in pairs)
    cov = mean((p[0] - mx) * (p[1] - my) for p in pairs)
    return cov / sx  # return per one standard deviation move


def recent_z(xs, keys_window, keys_recent):
    vals = [xs[k] for k in keys_window if k in xs]
    rec = [xs[k] for k in keys_recent if k in xs]
    if len(vals) < 24 or not rec:
        return None
    sd = pstdev(vals)
    if not sd:
        return None
    return sum(rec) / (sd * math.sqrt(len(rec)))


def macro_changes(macro, drivers):
    """Monthly changes for every series, keyed by name."""
    ser = {k: (v.get("series") or {}) for k, v in macro.items()}
    ch = {}
    for k in ("gpr", "epu", "cpu"):
        if ser.get(k):
            ch[k] = log_changes(ser[k])
    if ser.get("us10y"):
        ch["rates"] = diffs(ser["us10y"])
    for k in ("brent", "henry_hub"):
        d = drivers.get(k)
        if d is not None and not d.series.empty:
            monthly = {}
            for dt, v in zip(d.series.dates, d.series.closes):
                monthly.setdefault(f"{dt.year:04d}-{dt.month:02d}", []).append(v)
            ch["oil" if k == "brent" else "gas"] = log_changes({m: mean(v) for m, v in monthly.items()})
    for sub, ags in SECTOR_AGENCIES.items():
        got = [ser.get(f"reg_{a}") for a in ags if ser.get(f"reg_{a}")]
        if got:
            keys = set().union(*[set(g) for g in got])
            ch[f"reg:{sub}"] = log_changes({k: sum(g.get(k, 0) for g in got) for k in keys}, log1p=True)
    return ch


LAGS = {"gpr": NEWS_LAG, "epu": NEWS_LAG, "cpu": NEWS_LAG, "rates": DATA_LAG, "oil": DATA_LAG, "gas": DATA_LAG}
POLITICAL = ("gpr", "epu", "cpu", "reg")


def build(universe, fins, prices, drivers, weights, macro, start=date(2012, 1, 1), today=None, log=print):
    today = today or max(p.dates[-1] for p in prices.values() if not p.empty)
    service = {k: set(v) for k, v in config.load_json(config.CONFIG / "service_states.json", {}).items() if not k.startswith("_")}
    fema = (macro.get("fema") or {}).get("records") or []
    changes = macro_changes(macro, drivers)
    sub_of = {s["ticker"]: s["subsector"] for s in universe["stocks"]}
    tickers = list(sub_of)
    dates = quarter_dates(start, today)
    if dates[-1] != today:
        dates.append(today)  # the live row, for today's picks
    all_months = months_before(today, (today.year - start.year + 4) * 12, 0)
    rets = {t: monthly_returns(prices[t], all_months) for t in tickers}
    mkt = {}
    for k in all_months:
        xs = [rets[t][k] for t in tickers if k in rets[t]]
        if len(xs) >= 5:
            mkt[k] = mean(xs)
    excess = {t: {k: v - mkt[k] for k, v in rets[t].items() if k in mkt} for t in tickers}

    rows = []
    for d in dates:
        results, _ = engine.score_universe(d, universe, fins, prices, drivers, weights, [], {}, include_manual=False)
        for t, res in results.items():
            m, p = res["metrics"], prices[t]
            price = p.on(d)
            if not price:
                continue
            snap, tech = m.get("snapshot") or {}, m.get("tech") or {}
            row = {"date": d.isoformat(), "ticker": t, "sub": sub_of[t], "live": d == today}
            # value
            pe, pem = m.get("pe"), m.get("pe_median")
            row["v_pe_own"] = -(pe / pem) if (pe and pem) else None
            row["v_ev_ebitda"] = -m["ev_ebitda"] if m.get("ev_ebitda") else None
            row["v_fcf_yield"] = m.get("fcf_yield")
            row["v_earn_yield"] = (1 / pe) if pe else None
            # strength
            lev = m.get("leverage")
            row["q_leverage"] = -min(lev, 20) if lev is not None and math.isfinite(lev) else None
            row["q_coverage"] = min(m["coverage"], 50) if m.get("coverage") is not None else None
            pos, n_years = m.get("fcf_pos") or (None, 0)
            row["q_fcf_years"] = (pos / n_years) if (pos is not None and n_years >= 2) else None
            rev, op = snap.get("revenue"), snap.get("operating_income")
            row["q_margin"] = (op / rev) if (rev and op is not None and rev > 0) else None
            # growth
            row["g_rev"], row["g_eps"] = m.get("rev_cagr"), m.get("eps_cagr")
            # technical
            p1m, p6m, p12m = p.on(d - timedelta(days=30)), p.on(d - timedelta(days=182)), p.on(d - timedelta(days=365))
            row["t_mom_12_1"] = (p1m / p12m - 1) if (p1m and p12m) else None
            row["t_mom_6"] = (price / p6m - 1) if p6m else None
            row["t_trend"] = (price / tech["ma200"] - 1) if tech.get("ma200") else None
            row["t_near_high"] = (price / tech["hi52"]) if tech.get("hi52") else None
            win = p.window(d, 380)
            if len(win) > 120:
                dr = [b / a - 1 for a, b in zip(win[:-1], win[1:]) if a]
                row["t_low_vol"] = -pstdev(dr) * math.sqrt(252)
            else:
                row["t_low_vol"] = None
            row["t_oversold"] = -(tech["rsi14"] - 50) if tech.get("rsi14") is not None else None
            # politics and macro: reaction learned over 36 months, times the recent move
            sens = []
            for k, lag in LAGS.items():
                xs = changes.get(k)
                if not xs:
                    row[f"m_{k}"] = None
                    continue
                wk = months_before(d, WINDOW, lag)
                b = beta(excess[t], xs, wk)
                z = recent_z(xs, wk, months_before(d, 3, lag))
                row[f"m_{k}"] = (b * z) if (b is not None and z is not None) else None
                if k in POLITICAL and b is not None:
                    sens.append(abs(b))
            xs = changes.get(f"reg:{sub_of[t]}")
            if xs:
                wk = months_before(d, WINDOW, DATA_LAG)
                b = beta(excess[t], xs, wk)
                z = recent_z(xs, wk, months_before(d, 3, DATA_LAG))
                row["m_reg"] = (b * z) if (b is not None and z is not None) else None
                if b is not None:
                    sens.append(abs(b))
            else:
                row["m_reg"] = None
            row["m_policy_proof"] = -mean(sens) if len(sens) >= 2 else None
            if t in service and fema:
                lo = (d - timedelta(days=182)).isoformat()
                row["m_disaster"] = -sum(1 for st, dd, _ in fema if st in service[t] and lo < dd <= d.isoformat())
            else:
                row["m_disaster"] = None
            row["v1_score"] = res["score"]
            # outcomes
            f3, f12 = p.on(d + timedelta(days=91)), p.on(d + timedelta(days=365))
            row["f3"] = (f3 / price - 1) if (f3 and d + timedelta(days=91) <= today) else None
            row["f12"] = (f12 / price - 1) if (f12 and d + timedelta(days=365) <= today) else None
            rows.append(row)
        log(f"  panel {d}: {sum(1 for r in rows if r['date'] == d.isoformat())} stocks")
    return rows
