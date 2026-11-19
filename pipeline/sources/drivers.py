"""Energy drivers: oil and gas prices (U.S. Energy Information Administration),
the 10-year Treasury yield (St. Louis Federal Reserve), and uranium (entered by hand).

Each driver is cached as a sorted [[date, value], ...] list. A missing key
simply leaves that driver out, and the formula skips the input.
"""
from datetime import date, timedelta

import requests

from .. import config

EIA_SERIES = {"brent": "PET.RBRTE.D", "henry_hub": "NG.RNGWHHD.D"}
EIA_URL = "https://api.eia.gov/v2/seriesid/{sid}"
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
LABELS = {
    "brent": "Brent crude oil price",
    "henry_hub": "Henry Hub natural gas price",
    "us10y": "10-year Treasury yield",
    "uranium": "Long-term uranium contract price",
}


def _path(name):
    return config.DRIVER_CACHE / f"{name}.json"


def _eia(name, sid, log):
    start = (date.today() - timedelta(days=365 * 7)).isoformat()
    rows, offset = [], 0
    while True:
        params = {"api_key": config.EIA_KEY, "start": start, "offset": offset, "length": 5000}
        r = requests.get(EIA_URL.format(sid=sid), params=params, timeout=60)
        r.raise_for_status()
        resp = r.json().get("response", {})
        data = resp.get("data", [])
        for d in data:
            try:
                rows.append([d["period"][:10], float(d["value"])])
            except (KeyError, TypeError, ValueError):
                continue
        total = int(resp.get("total") or 0)
        offset += len(data)
        if not data or offset >= total:
            break
    return sorted(rows)


def _fred(series_id):
    params = {"series_id": series_id, "api_key": config.FRED_KEY, "file_type": "json",
              "observation_start": (date.today() - timedelta(days=365 * 7)).isoformat()}
    r = requests.get(FRED_URL, params=params, timeout=60)
    r.raise_for_status()
    out = []
    for o in r.json().get("observations", []):
        if o.get("value") not in (None, "", "."):
            out.append([o["date"], float(o["value"])])
    return out


def update_all(log=print):
    out = {}
    if config.EIA_KEY:
        for name, sid in EIA_SERIES.items():
            try:
                series = _eia(name, sid, log)
                if series:
                    config.save_json(_path(name), {"name": name, "label": LABELS[name], "source": "EIA", "series": series}, compact=True)
            except (requests.RequestException, ValueError) as e:
                log(f"  EIA {name}: {e}")
    if config.FRED_KEY:
        try:
            series = _fred("DGS10")
            if series:
                config.save_json(_path("us10y"), {"name": "us10y", "label": LABELS["us10y"], "source": "FRED", "series": series}, compact=True)
        except (requests.RequestException, ValueError) as e:
            log(f"  FRED us10y: {e}")
    # Uranium: monthly values typed into config/uranium.json.
    manual = config.load_json(config.CONFIG / "uranium.json", {"series": []})
    if manual.get("series"):
        config.save_json(_path("uranium"), {"name": "uranium", "label": LABELS["uranium"], "source": "manual",
                                            "series": sorted(manual["series"])}, compact=True)
    for name in LABELS:
        rec = config.load_json(_path(name))
        if rec and rec.get("series"):
            out[name] = rec
    return out
