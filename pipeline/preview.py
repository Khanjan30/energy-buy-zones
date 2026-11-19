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
    save_json(out / "backtest.json", output.clean(bt))
    print(f"Sample data written to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/preview-data")
