"""Synthetic filings and prices for tests and local previews. Never shown as real data."""
import math
import random
from datetime import date, timedelta


def _q_ends(year):
    return [date(year, 3, 31), date(year, 6, 30), date(year, 9, 30), date(year, 12, 31)]


def company(rev0=1000.0, growth=0.06, margin=0.15, debt=1500.0, cash=200.0, shares=100.0,
            capex_ratio=0.08, start_year=2018, end=date(2026, 11, 18), seed=1, currency="USD"):
    """Build a record shaped like pipeline.sources.sec.extract() output.

    Cash flow facts are year-to-date (as in real 10-Qs); income statement facts
    come both as 3-month and year-to-date, like real filings.
    """
    rng = random.Random(seed)
    items = {k: [] for k in ["revenue", "net_income", "operating_income", "dna", "cfo", "capex",
                             "interest", "cash", "debt_total", "shares"]}
    year = start_year
    while True:
        fy_start = date(year, 1, 1)
        ytd = {k: 0.0 for k in ["revenue", "net_income", "operating_income", "dna", "cfo", "capex", "interest"]}
        done = False
        for qi, qend in enumerate(_q_ends(year)):
            filed = qend + timedelta(days=40 if qi < 3 else 60)
            if filed > end:
                done = True
                break
            t = (year - start_year) + qi / 4
            rev = rev0 / 4 * (1 + growth) ** t * (1 + rng.uniform(-0.05, 0.05))
            op = rev * (margin + 0.05)
            dna = rev * 0.05
            ni = rev * margin
            cfo = ni + dna + rev * rng.uniform(-0.02, 0.02)
            capex = rev * capex_ratio
            interest = debt * 0.05 / 4
            q = {"revenue": rev, "net_income": ni, "operating_income": op, "dna": dna,
                 "cfo": cfo, "capex": capex, "interest": interest}
            qstart = date(qend.year, qend.month - 2, 1)
            form = "10-K" if qi == 3 else "10-Q"
            for k, v in q.items():
                ytd[k] += v
                if k in ("revenue", "net_income", "operating_income", "interest"):
                    items[k].append([qstart.isoformat(), qend.isoformat(), v, filed.isoformat(), form])
                if qi > 0 or k not in ("revenue", "net_income", "operating_income", "interest"):
                    items[k].append([fy_start.isoformat(), qend.isoformat(), ytd[k], filed.isoformat(), form])
            items["cash"].append([None, qend.isoformat(), cash * (1 + 0.1 * qi), filed.isoformat(), form])
            items["debt_total"].append([None, qend.isoformat(), debt, filed.isoformat(), form])
            items["shares"].append([qstart.isoformat(), qend.isoformat(), shares, filed.isoformat(), form])
        if done:
            break
        year += 1
    return {"taxonomy": "us-gaap", "currency": currency,
            "items": {k: {"tag": k, "unit": currency, "facts": v} for k, v in items.items()}}


def price_series(start=date(2018, 1, 2), end=date(2026, 11, 18), p0=50.0, drift=0.08, vol=0.25, seed=1):
    rng = random.Random(seed)
    out, p, day = [], p0, start
    dt = 1 / 252
    while day <= end:
        if day.weekday() < 5:
            p *= math.exp((drift - vol ** 2 / 2) * dt + vol * math.sqrt(dt) * rng.gauss(0, 1))
            out.append([day.isoformat(), round(p, 4)])
        day += timedelta(days=1)
    return {"closes": out}


def driver_series(name, start=date(2018, 1, 2), end=date(2026, 11, 18), v0=70.0, seed=7):
    s = price_series(start, end, v0, 0.0, 0.3, seed)["closes"]
    return {"name": name, "label": name, "series": s}


def small_universe():
    subs = {
        "oil_gas": {"label": "Oil and gas producers", "driver": "brent", "regulated": False},
        "utilities": {"label": "Regulated utilities", "driver": None, "regulated": True},
        "early": {"label": "Early-stage", "driver": None, "regulated": False},
    }
    stocks = [{"ticker": f"OIL{i}", "name": f"Oil {i}", "subsector": "oil_gas"} for i in range(5)]
    stocks += [{"ticker": f"UTL{i}", "name": f"Utility {i}", "subsector": "utilities"} for i in range(5)]
    stocks += [{"ticker": f"NEW{i}", "name": f"Startup {i}", "subsector": "early"} for i in range(3)]
    return {"subsectors": subs, "stocks": stocks,
            "tracked": [{"ticker": "DEAL", "name": "Deal Co", "status": "deal_pending", "deal_price": 7.02}]}


def small_weights():
    return {
        "oil_gas": {"value": 25, "strength": 20, "growth": 25, "policy": 10, "outside": 20},
        "utilities": {"value": 20, "strength": 20, "growth": 15, "policy": 25, "outside": 20},
        "early": {"value": 10, "strength": 35, "growth": 20, "policy": 25, "outside": 10},
    }


def small_data():
    uni = small_universe()
    fins, prices = {}, {}
    for i in range(5):
        fins[f"OIL{i}"] = company(rev0=2000 + 300 * i, growth=0.02 + 0.02 * i, margin=0.08 + 0.03 * i,
                                  debt=800 + 400 * i, seed=10 + i)
        prices[f"OIL{i}"] = price_series(p0=40 + 5 * i, drift=0.02 * i, seed=20 + i)
        fins[f"UTL{i}"] = company(rev0=3000, growth=0.03, margin=0.10, debt=6000 + 1000 * i, seed=30 + i)
        prices[f"UTL{i}"] = price_series(p0=60, drift=0.04, vol=0.15, seed=40 + i)
    for i in range(3):
        fins[f"NEW{i}"] = company(rev0=20, growth=0.5, margin=-1.5, debt=50, cash=300 + 200 * i,
                                  capex_ratio=1.0, seed=50 + i)
        prices[f"NEW{i}"] = price_series(p0=10, drift=0.1, vol=0.6, seed=60 + i)
    prices["DEAL"] = price_series(p0=6.9, drift=0.0, vol=0.02, seed=70)
    drivers = {"brent": driver_series("brent")}
    return uni, fins, prices, drivers
