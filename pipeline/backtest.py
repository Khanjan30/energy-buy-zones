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
    sub_of = {s["ticker"]: s["subsector"] for s in universe["stocks"]}
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
            p3 = prices[t].on(dt + timedelta(days=365 * 3))
            batch.append({"date": dt.isoformat(), "ticker": t, "sub": sub_of.get(t), "band": res["band"], "action": res["action"],
                          "position": res["position"], "score": res["score"], "fwd": p1 / p0 - 1,
                          "fwd3": (p3 / p0 - 1) if (p3 and dt + timedelta(days=365 * 3) <= today) else None})
        if len(batch) < 5:
            log(f"  backtest {dt}: only {len(batch)} stocks scorable, skipped")
            continue
        avg_all = mean(r["fwd"] for r in batch)
        med_all = median(r["fwd"] for r in batch)
        by_sub = {}
        for r in batch:
            by_sub.setdefault(r["sub"], []).append(r["fwd"])
        for r in batch:
            r["excess"] = r["fwd"] - avg_all
            r["excess_med"] = r["fwd"] - med_all
            peers = by_sub.get(r["sub"], [])
            # Against the middle stock of its own sector, so a sector-wide boom or bust cancels out.
            r["excess_sec"] = r["fwd"] - (median(peers) if len(peers) >= 3 else med_all)
        three = [r["fwd3"] for r in batch if r["fwd3"] is not None]
        med3 = median(three) if len(three) >= 5 else None
        for r in batch:
            r["excess3"] = (r["fwd3"] - med3) if (med3 is not None and r["fwd3"] is not None) else None
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
        "diagnostics": diagnostics(rows, universe),
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


def score_history(universe, fins, prices, drivers, weights, today, years=5, log=print):
    """Quarterly scores for every stock up to today, for the score history chart.

    Uses the same point-in-time data as the backtest. Policy and Outside pressure are
    left out, so these scores can differ from today's full score.
    """
    days, y, mth = [], today.year - years, 3
    while True:
        dt = date(y, mth, 1)
        if dt > today:
            break
        if dt >= today - timedelta(days=365 * years):
            days.append(dt)
        mth += 3
        if mth > 12:
            mth, y = 3, y + 1
    out = {}
    for dt in days:
        results, _ = engine.score_universe(dt, universe, fins, prices, drivers, weights, [], {}, include_manual=False)
        for t, res in results.items():
            if res["score"] is None:
                continue
            out.setdefault(t, []).append([dt.isoformat(), round(res["score"], 1), res["band"], res["action"],
                                          prices[t].on(dt)])
    log(f"  score history: {len(days)} dates")
    return out


def _med(xs):
    xs = [x for x in xs if x is not None]
    return median(xs) if xs else None


def _versus(rows, key, a, b, label, how, agg=median):
    """Compare the middle result of group a against group b on one measure."""
    ra = [r[key] for r in rows if a(r) and r.get(key) is not None]
    rb = [r[key] for r in rows if b(r) and r.get(key) is not None]
    if len(ra) < 10 or len(rb) < 10:
        return {"label": label, "how": how, "passed": None, "a": None, "b": None, "na": len(ra), "nb": len(rb)}
    ma, mb = agg(ra), agg(rb)
    return {"label": label, "how": how, "passed": ma > mb, "a": ma, "b": mb, "spread": ma - mb, "na": len(ra), "nb": len(rb)}


def diagnostics(rows, universe):
    """Breakdowns that explain the headline tests: outliers, sector booms, early-stage names, horizon."""
    strong = lambda r: r["band"] == "Strong"
    weak = lambda r: r["band"] in ("Weak", "Broken")
    cheap = lambda r: r["position"] in ("Deep discount", "Buy zone")
    rich = lambda r: r["position"] in ("Full", "Stretched")
    not_early = lambda f: (lambda r: f(r) and r["sub"] != "early")
    quality = [
        _versus(rows, "excess", strong, weak, "As first run", "Average 12-month return against the average of every stock, early-stage included", agg=mean),
        _versus(rows, "excess_med", strong, weak, "Against the middle stock", "Median return against the median stock, so a few huge winners count once each"),
        _versus(rows, "excess_sec", strong, weak, "Within each sector", "Against the middle stock of the same sector, so an oil boom or an AI-power boom cancels out"),
        _versus(rows, "excess_sec", not_early(strong), not_early(weak), "Within each sector, no early-stage", "Same, with early-stage companies left out, since the formula is not built for them"),
        _versus(rows, "excess3", not_early(strong), not_early(weak), "Over three years", "Three-year return against the middle stock, early-stage left out; fewer dates qualify"),
    ]
    price = [
        _versus(rows, "excess_med", cheap, rich, "Against the middle stock", "Median return, cheap against expensive"),
        _versus(rows, "excess_sec", cheap, rich, "Within each sector", "Against the middle stock of the same sector"),
        _versus(rows, "excess_sec", not_early(cheap), not_early(rich), "Within each sector, no early-stage", "Same, early-stage left out"),
        _versus(rows, "excess3", not_early(cheap), not_early(rich), "Over three years", "Three-year return against the middle stock"),
    ]
    labels = {k: v["label"] for k, v in universe["subsectors"].items()}
    by_sector = []
    for k, label in labels.items():
        rs = [r for r in rows if r["sub"] == k]
        if not rs:
            continue
        by_sector.append({
            "sector": label, "key": k, "n": len(rs),
            "median_return": _med([r["fwd"] for r in rs]),
            "strong": _med([r["excess_sec"] for r in rs if strong(r)]), "n_strong": sum(1 for r in rs if strong(r)),
            "weak": _med([r["excess_sec"] for r in rs if weak(r)]), "n_weak": sum(1 for r in rs if weak(r)),
        })
    # How often, date by date, Strong beat Weak inside sectors (early-stage left out).
    wins = total = 0
    for dt in sorted({r["date"] for r in rows}):
        d = [r for r in rows if r["date"] == dt and r["sub"] != "early"]
        a, b = _med([r["excess_sec"] for r in d if strong(r)]), _med([r["excess_sec"] for r in d if weak(r)])
        if a is not None and b is not None:
            total += 1
            wins += a > b
    winners = sorted(rows, key=lambda r: r["fwd"], reverse=True)[:12]
    early = [r for r in rows if r["sub"] == "early"]
    return {
        "quality_tests": quality,
        "price_tests": price,
        "by_sector": by_sector,
        "consistency": {"wins": wins, "dates": total},
        "top_winners": [{"ticker": r["ticker"], "date": r["date"], "band": r["band"], "fwd": r["fwd"], "sub": r["sub"]} for r in winners],
        "early_share": {"n": len(early), "broken": sum(1 for r in early if r["band"] == "Broken"),
                        "median_return": _med([r["fwd"] for r in early])},
        "rows": [[r["date"], r["ticker"], r["sub"], r["band"], r["position"], round(r["fwd"], 4),
                  round(r["fwd3"], 4) if r["fwd3"] is not None else None] for r in rows],
    }
