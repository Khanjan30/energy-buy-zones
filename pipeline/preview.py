"""Write made-up sample data for a local preview of the site.

    python -m pipeline.preview /tmp/preview-data
    cd web && DATA_DIR=/tmp/preview-data npm run build

The output is marked as sample data and the site shows a banner. Never commit it to web/data.
"""
import sys
from datetime import date
from pathlib import Path

from . import backtest, engine, output
from .config import load_json, save_json, CONFIG
from .tests import fixtures


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    uni, fin_recs, price_recs, drv_recs = fixtures.small_data()
    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, drv_recs)
    asof = date(2026, 11, 18)
    events = load_json(CONFIG.parent / "data" / "events.json")["events"]
    res, _ = engine.score_universe(asof, uni, fins, prices, drivers, fixtures.small_weights(), events, {})
    data = output.build(asof, uni, res, prices, fins, drivers, events, {"prices": "sample", "sample": True})
    save_json(out / "scores.json", data)
    bt = backtest.run(uni, fins, prices, drivers, fixtures.small_weights(), today=asof, log=lambda m: None)
    bt["history"] = backtest.score_history(uni, fins, prices, drivers, fixtures.small_weights(), asof, log=lambda m: None)
    # Two days of signals, with a couple of made-up changes, so the "what changed" feed has something to show.
    today = {s["ticker"]: [s.get("score"), s.get("action"), (s.get("tech") or {}).get("price")] for s in data["stocks"] if s.get("action")}
    prev = {k: list(v) for k, v in today.items()}
    for k in list(prev)[:3]:
        prev[k][1] = "Hold"
    save_json(out / "signals.json", {"days": {"2026-11-17": prev, asof.isoformat(): today}})
    save_json(out / "backtest.json", output.clean(bt))
    print(f"Sample data written to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/preview-data")
