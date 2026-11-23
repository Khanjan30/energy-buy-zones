"""Strategy lab: build the signal panel, backtest every formula, write web/data/research.json.

    python -m pipeline.research.run            # refresh political and macro data, then run
    python -m pipeline.research.run --offline  # use cached data only

Runs after pipeline.run, which refreshes prices, filings and oil and gas prices.
"""
import argparse
from datetime import datetime, timezone

from .. import config, engine
from ..sources import drivers as drivers_src
from ..sources import macro as macro_src
from ..sources import prices as prices_src
from . import evaluate, panel


def log(msg):
    print(msg, flush=True)


def macro_summary(macro):
    out = {}
    for name, rec in macro.items():
        ser = rec.get("series") or {}
        if not ser:
            continue
        keys = sorted(ser)
        last = keys[-1]
        prev = next((k for k in reversed(keys) if k <= f"{int(last[:4]) - 1}{last[4:]}"), None)
        out[name] = {"label": rec.get("label", name), "source": rec.get("source"), "last_month": last, "value": ser[last],
                     "year_ago": ser.get(prev) if prev else None, "history": [[k, ser[k]] for k in keys[-72:]]}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args(argv)
    uni = config.universe()
    scored = [s["ticker"] for s in uni["stocks"]]
    log("Political and macro data")
    if args.offline:
        macro, status = macro_src.load_cached(), []
    else:
        macro, status = macro_src.update_all(log)
    price_recs = {t: prices_src.load_cached(t) for t in scored}
    fin_recs = {t: config.load_json(config.FIN_CACHE / f"{t}.json") for t in scored}
    driver_recs = {n: config.load_json(config.DRIVER_CACHE / f"{n}.json") for n in drivers_src.LABELS}
    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, {k: v for k, v in driver_recs.items() if v})
    log("Signal panel")
    rows = panel.build(uni, fins, prices, drivers, config.weights(), macro, log=log)
    log("Backtesting formulas")
    res = evaluate.run(rows, log)
    res["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    res["data_status"] = status
    res["macro"] = macro_summary(macro)
    res["notes"] = [
        "Price returns only; dividends are left out, which understates utilities, pipelines and oil producers.",
        "The stock list was chosen in 2026, so companies that failed or were bought out earlier are missing (survivorship bias).",
        "Signals use only data public on each date. News-based indexes are lagged two months, other series one month.",
        "Weights for the learned formula come only from the training years; the test years are never used to choose them.",
        "56 stocks is a small universe, so a skill number near zero can be luck. Treat anything below 0.03 as no edge.",
        "The hand-kept event log is not part of this test; it cannot be honestly back-dated.",
    ]
    out = evaluate_clean(res)
    config.save_json(config.WEB_DATA / "research.json", out, compact=True)
    log(f"Wrote web/data/research.json: {len(res['strategies'])} strategies, {res['observations']} observations")
    return 0


def evaluate_clean(obj):
    import math
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else round(obj, 5)
    if isinstance(obj, dict):
        return {k: evaluate_clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [evaluate_clean(v) for v in obj]
    return obj


if __name__ == "__main__":
    raise SystemExit(main())
