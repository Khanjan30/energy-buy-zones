"""Backtest the calculated parts of the formula.

Every quarter over the last 5 years, score the universe using only the
filings and prices public at that date, then measure the next 12 months of
price return. Policy and Outside pressure are left out: they come from a
hand-kept log, and scoring past events with hindsight would flatter them.
"""
from datetime import date, timedelta
from statistics import mean, median

from . import engine

BUY = {"Buy, check the news", "Buy", "Buy small", "Buy small, 3% cap"}
SELLISH = {"Trim", "Sell", "Avoid"}


def test_dates(today, years=5):
    out = []
    y, mth = today.year - years, 3
    while True:
        dt = date(y, mth, 1)
        if dt > today - timedelta(days=366):
            break
        if dt >= today - timedelta(days=365 * years):
            out.append(dt)
        mth += 3
        if mth > 12:
            mth, y = 3, y + 1
    return out


def _summary(rows):
    if not rows:
        return {"n": 0}
    fwd = [r["fwd"] for r in rows]
    exc = [r["excess"] for r in rows]
    return {"n": len(rows), "mean_return": mean(fwd), "median_return": median(fwd),
            "mean_excess": mean(exc), "hit_rate": sum(1 for e in exc if e > 0) / len(exc)}


def run(universe, fins, prices, drivers, weights, today=None, log=print):
    today = today or max(p.dates[-1] for p in prices.values() if not p.empty)
    rows, per_date = [], []
    for dt in test_dates(today):
        results, _ = engine.score_universe(dt, universe, fins, prices, drivers, weights, [], {}, include_manual=False)
        batch = []
        for t, res in results.items():
            if res["band"] == "Not enough data":
                continue
            p0 = prices[t].on(dt)
            p1 = prices[t].on(dt + timedelta(days=365))
            if not p0 or not p1:
                continue
            batch.append({"date": dt.isoformat(), "ticker": t, "band": res["band"], "action": res["action"],
                          "position": res["position"], "score": res["score"], "fwd": p1 / p0 - 1})
        if len(batch) < 5:
            log(f"  backtest {dt}: only {len(batch)} stocks scorable, skipped")
            continue
        avg_all = mean(r["fwd"] for r in batch)
        for r in batch:
            r["excess"] = r["fwd"] - avg_all
        rows.extend(batch)

        def m(band_set):
            xs = [r["fwd"] for r in batch if r["band"] in band_set]
            return mean(xs) if xs else None

        per_date.append({"date": dt.isoformat(), "n": len(batch), "all": avg_all,
                         "strong": m({"Strong"}), "fair": m({"Fair"}), "weak": m({"Weak", "Broken"})})
        log(f"  backtest {dt}: {len(batch)} stocks")

    by_band = {b: _summary([r for r in rows if r["band"] == b]) for b in ["Strong", "Fair", "Weak", "Broken"]}
    groups = {
        "Buy signals": [r for r in rows if r["action"] in BUY],
        "Hold": [r for r in rows if r["action"].startswith("Hold")],
        "Trim, sell or avoid": [r for r in rows if r["action"] in SELLISH],
    }
    by_action = {k: _summary(v) for k, v in groups.items()}
    cheap = [r for r in rows if r["position"] in ("Deep discount", "Buy zone")]
    rich = [r for r in rows if r["position"] in ("Full", "Stretched")]
    by_position = {p: _summary([r for r in rows if r["position"] == p])
                   for p in ["Deep discount", "Buy zone", "Fair", "Full", "Stretched"]}
    strong, weak = by_band["Strong"], _summary([r for r in rows if r["band"] in ("Weak", "Broken")])
    tests = []
    if strong["n"] >= 10 and weak["n"] >= 10:
        spread = strong["mean_excess"] - weak["mean_excess"]
        tests.append({"name": "Strong beats Weak", "spread": spread, "passed": spread > 0,
                      "detail": f"Strong stocks averaged {strong['mean_excess'] * 100:+.1f} points against the group each year; Weak and Broken averaged {weak['mean_excess'] * 100:+.1f}."})
    else:
        tests.append({"name": "Strong beats Weak", "passed": None,
                      "detail": "Not enough Strong or Weak observations yet to judge."})
    if len(cheap) >= 10 and len(rich) >= 10:
        cs, rs = _summary(cheap), _summary(rich)
        spread = cs["mean_excess"] - rs["mean_excess"]
        tests.append({"name": "Buying in the zone beats buying rich", "spread": spread, "passed": spread > 0,
                      "detail": f"Stocks at Deep discount or in the Buy zone averaged {cs['mean_excess'] * 100:+.1f} points against the group; Full or Stretched averaged {rs['mean_excess'] * 100:+.1f}."})
    else:
        tests.append({"name": "Buying in the zone beats buying rich", "passed": None,
                      "detail": "Not enough priced observations yet to judge."})
    return {
        "generated_for": today.isoformat(),
        "observations": len(rows),
        "dates": len(per_date),
        "by_band": by_band, "by_action": by_action, "by_position": by_position,
        "tests": tests, "per_date": per_date,
        "notes": [
            "Price return only; dividends are not included, which understates returns for utilities, pipelines and oil producers.",
            "Policy and Outside pressure are excluded because they come from a hand-kept log that cannot be honestly back-dated.",
            "The stock list was chosen in 2026, so companies that failed or were bought out earlier are missing. This survivorship bias flatters every band equally but should be kept in mind.",
            "Excess return is each stock's 12-month return minus the average of all stocks scored on the same date.",
        ],
    }
