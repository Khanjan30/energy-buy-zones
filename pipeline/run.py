"""Daily job: refresh data, score every stock, and write the app's data files.

    python -m pipeline.run              # refresh data and score
    python -m pipeline.run --backtest   # also rerun the backtest
    python -m pipeline.run --offline    # score from cached data only
"""
import argparse
import sys
from datetime import date

from . import backtest, config, engine, output
from .sources import drivers as drivers_src
from .sources import prices as prices_src
from .sources import sec as sec_src


def log(msg):
    print(msg, flush=True)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--backtest", action="store_true")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args(argv)

    uni = config.universe()
    scored = [s["ticker"] for s in uni["stocks"]]
    tracked = [t["ticker"] for t in uni.get("tracked", [])]

    if args.offline:
        price_recs = {t: prices_src.load_cached(t) for t in scored + tracked}
        fin_recs = {t: config.load_json(config.FIN_CACHE / f"{t}.json") for t in scored}
        driver_recs = {n: config.load_json(config.DRIVER_CACHE / f"{n}.json") for n in drivers_src.LABELS}
    else:
        log(f"Prices for {len(scored) + len(tracked)} tickers ({'Twelve Data' if config.TWELVE_DATA_KEY else 'Stooq, no Twelve Data key set'})")
        price_recs = prices_src.update_all(scored + tracked, log)
        log("Company filings from the SEC")
        fin_recs = sec_src.update_all(scored, log)
        log("Energy drivers")
        driver_recs = drivers_src.update_all(log)

    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, {k: v for k, v in driver_recs.items() if v})
    if not any(not p.empty for p in prices.values()):
        log("No price data available; nothing to score.")
        return 1

    asof = max(p.dates[-1] for p in prices.values() if not p.empty)
    events = config.load_json(config.DATA / "events.json", {"events": []})["events"]
    exposures = {k: v for k, v in config.load_json(config.CONFIG / "exposure.json", {}).items() if not k.startswith("_")}
    weights = config.weights()

    log(f"Scoring as of {asof}")
    results, _ = engine.score_universe(asof, uni, fins, prices, drivers, weights, events, exposures)
    sources = {
        "prices": "Twelve Data" if config.TWELVE_DATA_KEY else "Stooq",
        "filings": "SEC company facts",
        "drivers": sorted(drivers.keys()),
        "missing_keys": [n for n, k in [("EIA_API_KEY", config.EIA_KEY), ("FRED_API_KEY", config.FRED_KEY)] if not k],
        "stocks_with_prices": sum(1 for t in scored if t in prices and not prices[t].empty),
        "stocks_with_filings": sum(1 for t in scored if t in fins and not fins[t].empty),
    }
    data = output.build(asof, uni, results, prices, fins, drivers, events, sources)
    config.save_json(config.WEB_DATA / "scores.json", data, compact=True)
    log(f"Wrote {len(data['stocks'])} stocks to web/data/scores.json")

    bt_path = config.WEB_DATA / "backtest.json"
    if args.backtest or not bt_path.exists():
        log("Backtest")
        bt = backtest.run(uni, fins, prices, drivers, weights, today=asof, log=log)
        config.save_json(bt_path, output.clean(bt), compact=True)
        log(f"Backtest: {bt['observations']} observations over {bt['dates']} dates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
