"""Daily closing prices.

Twelve Data is the main source (free plan: 8 requests a minute, 800 a day).
When no Twelve Data key is set, Stooq's free CSV download is tried instead.
Prices are cached as compact [[date, close], ...] lists and topped up each day.
"""
import csv
import io
import time
from datetime import date, timedelta

import requests

from .. import config

TD_URL = "https://api.twelvedata.com/time_series"
STOOQ_URL = "https://stooq.com/q/d/l/"
PACE_SECONDS = 8.2  # stay under 8 requests a minute


class PriceError(Exception):
    pass


def _cache_path(ticker):
    return config.PRICE_CACHE / f"{ticker}.json"


def load_cached(ticker):
    return config.load_json(_cache_path(ticker), {"ticker": ticker, "source": None, "closes": []})


def _merge(old, new):
    by_date = {d: c for d, c in old}
    for d, c in new:
        by_date[d] = c
    return sorted(([d, c] for d, c in by_date.items()), key=lambda x: x[0])


def _twelve_data(ticker, outputsize):
    params = {
        "symbol": ticker,
        "interval": "1day",
        "outputsize": outputsize,
        "apikey": config.TWELVE_DATA_KEY,
        "format": "JSON",
        "order": "ASC",
    }
    for attempt in range(2):
        r = requests.get(TD_URL, params=params, timeout=30)
        body = r.json()
        if body.get("status") == "error":
            code = body.get("code")
            if code == 429 and attempt == 0:
                time.sleep(61)
                continue
            raise PriceError(f"Twelve Data {code}: {body.get('message')}")
        values = body.get("values") or []
        out = []
        for v in values:
            try:
                out.append([v["datetime"][:10], round(float(v["close"]), 4)])
            except (KeyError, ValueError):
                continue
        return out
    raise PriceError("Twelve Data rate limit")


def _stooq(ticker):
    sym = ticker.lower().replace(".", "-") + ".us"
    r = requests.get(STOOQ_URL, params={"s": sym, "i": "d"}, timeout=30,
                     headers={"User-Agent": "Mozilla/5.0 EnergyBuyZones"})
    if r.status_code != 200 or not r.text.startswith("Date"):
        raise PriceError(f"Stooq returned no data for {ticker}")
    rows = csv.DictReader(io.StringIO(r.text))
    out = []
    for row in rows:
        try:
            out.append([row["Date"], round(float(row["Close"]), 4)])
        except (KeyError, ValueError):
            continue
    if not out:
        raise PriceError(f"Stooq returned no rows for {ticker}")
    return out


def update(ticker, log=print):
    """Top up one ticker's cached history. Returns (record, used_network_call)."""
    rec = load_cached(ticker)
    closes = rec.get("closes", [])
    fresh_enough = closes and date.fromisoformat(closes[-1][0]) >= date.today() - timedelta(days=20)
    try:
        if config.TWELVE_DATA_KEY:
            new = _twelve_data(ticker, 30 if fresh_enough else 5000)
            rec["source"] = "Twelve Data"
        else:
            new = _stooq(ticker)
            rec["source"] = "Stooq"
    except (PriceError, requests.RequestException, ValueError) as e:
        log(f"  prices {ticker}: {e}")
        return rec, True
    rec["closes"] = _merge(closes, new)
    config.save_json(_cache_path(ticker), rec, compact=True)
    return rec, True


def update_all(tickers, log=print):
    out = {}
    for i, t in enumerate(tickers):
        rec, called = update(t, log)
        out[t] = rec
        if called and config.TWELVE_DATA_KEY and i < len(tickers) - 1:
            time.sleep(PACE_SECONDS)
    return out
