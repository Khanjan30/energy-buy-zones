"""Paths and settings shared by the pipeline."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"
CACHE = DATA / "cache"
PRICE_CACHE = CACHE / "prices"
FIN_CACHE = CACHE / "financials"
DRIVER_CACHE = CACHE / "drivers"
WEB_DATA = ROOT / "web" / "data"

TWELVE_DATA_KEY = os.environ.get("TWELVE_DATA_API_KEY", "").strip()
EIA_KEY = os.environ.get("EIA_API_KEY", "").strip()
FRED_KEY = os.environ.get("FRED_API_KEY", "").strip()


def sec_user_agent() -> str:
    email = os.environ.get("SEC_CONTACT_EMAIL", "").strip()
    if not email:
        owner = os.environ.get("GITHUB_REPOSITORY_OWNER", "energy-buy-zones")
        email = f"{owner}@users.noreply.github.com"
    return f"EnergyBuyZones research app {email}"


def load_json(path: Path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path: Path, obj, compact: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        if compact:
            json.dump(obj, f, separators=(",", ":"))
        else:
            json.dump(obj, f, indent=2)
        f.write("\n")


def universe():
    return load_json(CONFIG / "universe.json")


def weights():
    w = load_json(CONFIG / "weights.json")
    w.pop("_note", None)
    return w
