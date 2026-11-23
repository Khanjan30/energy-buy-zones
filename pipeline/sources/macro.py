"""Historical politics, geopolitics, regulation, disaster and interest-rate data, all free.

Each loader returns a monthly series {"YYYY-MM": value} (or records for disasters), caches it
under data/cache/macro, and keeps the last good copy when a site is down. update_all() also
returns a status list so the site can show which sources loaded.

Sources
- Geopolitical risk: Caldara and Iacoviello, matteoiacoviello.com (monthly)
- Economic policy uncertainty: Baker, Bloom and Davis, via FRED when a key is set, else policyuncertainty.com
- Climate policy uncertainty: Gavriilidis and co-authors, policyuncertainty.com
- Regulation: Federal Register API, monthly count of rules and proposed rules per energy agency
- Natural disasters: OpenFEMA major disaster declarations by state
- Interest rates: US Treasury daily par yield curve, 10-year
"""
import csv
import io
import time
from datetime import date, datetime, timedelta, timezone

import requests

from .. import config

MACRO_CACHE = config.CACHE / "macro"
UA = {"User-Agent": "energy-buy-zones research (github.com/Khanjan30/energy-buy-zones)"}
START_YEAR = 2008

AGENCIES = {
    "epa": "environmental-protection-agency",
    "ferc": "federal-energy-regulatory-commission",
    "nrc": "nuclear-regulatory-commission",
    "doe": "energy-department",
    "interior": "interior-department",
}

LABELS = {
    "gpr": "Geopolitical risk index",
    "epu": "Economic policy uncertainty index",
    "cpu": "Climate policy uncertainty index",
    "us10y": "10-year Treasury yield",
    "reg_epa": "New rules, Environmental Protection Agency",
    "reg_ferc": "New rules, Federal Energy Regulatory Commission",
    "reg_nrc": "New rules, Nuclear Regulatory Commission",
    "reg_doe": "New rules, Department of Energy",
    "reg_interior": "New rules, Interior Department",
    "fema": "Major disaster declarations, Federal Emergency Management Agency",
}


def _path(name):
    return MACRO_CACHE / f"{name}.json"


def _fresh(rec, days):
    try:
        return rec and (datetime.now(timezone.utc) - datetime.fromisoformat(rec["fetched"])).days < days
    except (KeyError, ValueError, TypeError):
        return False


def _save(name, series, source, extra=None):
    rec = {"name": name, "label": LABELS.get(name, name), "source": source,
           "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"), "series": series}
    if extra:
        rec.update(extra)
    config.save_json(_path(name), rec, compact=True)
    return rec


def _get(url, **kw):
    r = requests.get(url, headers=UA, timeout=kw.pop("timeout", 60), **kw)
    r.raise_for_status()
    return r


def ym(d):
    return f"{d.year:04d}-{d.month:02d}"


# --- parsers (kept separate so tests can feed them sample files) ---------------

def parse_gpr_rows(rows):
    """rows: list of lists from the GPR sheet. Finds the 'month' and 'GPR' columns."""
    header_i = next((i for i, r in enumerate(rows[:10]) if any(str(c).strip().lower() == "month" for c in r)), None)
    if header_i is None:
        return {}
    head = [str(c).strip() for c in rows[header_i]]
    mi = next(i for i, c in enumerate(head) if c.lower() == "month")
    gi = next((i for i, c in enumerate(head) if c == "GPR"), None)
    if gi is None:
        return {}
    out = {}
    for r in rows[header_i + 1:]:
        if len(r) <= max(mi, gi):
            continue
        m, v = r[mi], r[gi]
        key = None
        if isinstance(m, (datetime, date)):
            key = ym(m)
        elif isinstance(m, (int, float)) and m > 20000:  # Excel serial date
            key = ym(date(1899, 12, 30) + timedelta(days=int(m)))
        elif isinstance(m, str) and len(m) >= 7 and m[4] in "-/":
            key = m[:7].replace("/", "-")
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        if key:
            out[key] = v
    return out


def parse_monthly_csv(text, date_cols=("date",), value_cols=()):
    """Generic monthly CSV: finds a date column and the first matching value column."""
    rdr = csv.DictReader(io.StringIO(text))
    cols = [c.strip() for c in (rdr.fieldnames or [])]
    low = {c.lower(): c for c in cols}
    dcol = next((low[c] for c in date_cols if c in low), None)
    vcol = next((low[c] for c in value_cols if c in low), None)
    if vcol is None:
        vcol = next((c for c in cols if c != dcol), None)
    out = {}
    for row in rdr:
        row = {k.strip(): v for k, v in row.items() if k}
        try:
            v = float(row[vcol])
        except (TypeError, ValueError, KeyError):
            continue
        if dcol:
            d = (row.get(dcol) or "").strip()
            key = None
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m", "%b-%y", "%b %Y", "%Y%m"):
                try:
                    key = ym(datetime.strptime(d, fmt))
                    break
                except ValueError:
                    pass
            if key is None and "year" in low and "month" in low:
                try:
                    key = f"{int(float(row[low['year']])):04d}-{int(float(row[low['month']])):02d}"
                except (TypeError, ValueError):
                    pass
        elif "year" in low and "month" in low:
            try:
                key = f"{int(float(row[low['year']])):04d}-{int(float(row[low['month']])):02d}"
            except (TypeError, ValueError):
                key = None
        else:
            key = None
        if key:
            out[key] = v
    return out


def parse_treasury_csv(text):
    """Daily Treasury par yield CSV -> {date: 10-year yield}."""
    rdr = csv.DictReader(io.StringIO(text))
    out = {}
    for row in rdr:
        d = (row.get("Date") or "").strip()
        v = row.get("10 Yr") or row.get("10 YR")
        try:
            out[datetime.strptime(d, "%m/%d/%Y").date().isoformat()] = float(v)
        except (TypeError, ValueError):
            continue
    return out


def month_end_mean(daily):
    acc = {}
    for d, v in daily.items():
        acc.setdefault(d[:7], []).append(v)
    return {k: sum(v) / len(v) for k, v in sorted(acc.items())}


# --- loaders -------------------------------------------------------------------

def load_gpr(log):
    old = config.load_json(_path("gpr"))
    if _fresh(old, 7):
        return old
    import xlrd  # the GPR file is an old-style .xls
    r = _get("https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls", timeout=120)
    book = xlrd.open_workbook(file_contents=r.content)
    sh = book.sheet_by_index(0)
    rows = []
    for i in range(sh.nrows):
        row = []
        for j in range(sh.ncols):
            c = sh.cell(i, j)
            if c.ctype == xlrd.XL_CELL_DATE:
                row.append(xlrd.xldate.xldate_as_datetime(c.value, book.datemode))
            else:
                row.append(c.value)
        rows.append(row)
    series = parse_gpr_rows(rows)
    if len(series) < 100:
        raise ValueError(f"GPR file parsed to only {len(series)} months")
    return _save("gpr", series, "matteoiacoviello.com/gpr.htm")


def load_epu(log):
    old = config.load_json(_path("epu"))
    if _fresh(old, 7):
        return old
    if config.FRED_KEY:
        r = _get("https://api.stlouisfed.org/fred/series/observations",
                 params={"series_id": "USEPUINDXM", "api_key": config.FRED_KEY, "file_type": "json"})
        series = {o["date"][:7]: float(o["value"]) for o in r.json().get("observations", []) if o["value"] not in (".", "")}
        src = "FRED USEPUINDXM"
    else:
        from openpyxl import load_workbook
        r = _get("https://www.policyuncertainty.com/media/US_Policy_Uncertainty_Data.xlsx", timeout=120)
        ws = load_workbook(io.BytesIO(r.content), read_only=True, data_only=True).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        head = [str(c or "").strip().lower() for c in rows[0]]
        yi, mi = head.index("year"), head.index("month")
        vi = next(i for i, c in enumerate(head) if "news" in c or "policy" in c)
        series = {}
        for row in rows[1:]:
            try:
                series[f"{int(row[yi]):04d}-{int(row[mi]):02d}"] = float(row[vi])
            except (TypeError, ValueError):
                continue
        src = "policyuncertainty.com"
    if len(series) < 100:
        raise ValueError("policy uncertainty series too short")
    return _save("epu", series, src)


CPU_REPO = "dkaenzig/climate-policy-uncertainty-index"


def parse_cpu_xlsx(content):
    """Rows like ('2026M04', narrow, broad, ...) on the 'data' sheet. Returns {'YYYY-MM': narrow index}."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb["data"] if "data" in wb.sheetnames else wb.worksheets[-1]
    rows = ws.iter_rows(values_only=True)
    head = [str(h or "").strip().lower() for h in next(rows)]
    col = head.index("cpu_index_narrow") if "cpu_index_narrow" in head else 1
    out = {}
    for r in rows:
        d, v = r[0], r[col] if len(r) > col else None
        if not isinstance(d, str) or "M" not in d or not isinstance(v, (int, float)):
            continue
        y, m = d.split("M")
        out[f"{int(y):04d}-{int(m):02d}"] = float(v)
    return out


def load_cpu(log):
    """Climate policy uncertainty (Gavriilidis, Kanzig, Raghavan and Stock), kept on GitHub as cpu_YYYY-MM.xlsx."""
    old = config.load_json(_path("cpu"))
    if _fresh(old, 7):
        return old
    listing = _get(f"https://api.github.com/repos/{CPU_REPO}/contents").json()
    files = sorted(f["name"] for f in listing if f.get("name", "").startswith("cpu_") and f["name"].endswith(".xlsx"))
    if not files:
        raise ValueError("climate policy uncertainty file not found in the repository")
    url = f"https://raw.githubusercontent.com/{CPU_REPO}/main/{files[-1]}"
    series = parse_cpu_xlsx(_get(url).content)
    if len(series) < 100:
        raise ValueError(f"climate policy uncertainty file had only {len(series)} months")
    return _save("cpu", series, url)


def load_treasury(log):
    old = config.load_json(_path("us10y")) or {}
    daily = dict(old.get("daily") or {})
    this_year = date.today().year
    have_years = {d[:4] for d in daily}
    years = [y for y in range(START_YEAR, this_year + 1) if str(y) not in have_years or y >= this_year - 1]
    if _fresh(old, 1) and str(this_year) in have_years:
        years = []
    for y in years:
        url = (f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{y}/all"
               f"?type=daily_treasury_yield_curve&field_tdr_date_value={y}&page&_format=csv")
        daily.update(parse_treasury_csv(_get(url).text))
        time.sleep(0.3)
    if len(daily) < 1000:
        raise ValueError("Treasury yields too short")
    return _save("us10y", month_end_mean(daily), "home.treasury.gov", {"daily": dict(sorted(daily.items()))})


def _fedreg_count(slug, start, end):
    params = [("conditions[agencies][]", slug), ("conditions[type][]", "RULE"), ("conditions[type][]", "PRORULE"),
              ("conditions[publication_date][gte]", start), ("conditions[publication_date][lte]", end),
              ("per_page", "1"), ("fields[]", "document_number")]
    r = _get("https://www.federalregister.gov/api/v1/documents.json", params=params, timeout=40)
    return int(r.json().get("count", 0))


def load_fedreg(key, log):
    name = f"reg_{key}"
    old = config.load_json(_path(name)) or {}
    series = dict(old.get("series") or {})
    today = date.today()
    months = []
    y, m = START_YEAR, 1
    while (y, m) <= (today.year, today.month):
        months.append((y, m))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    # Past months never change once a few weeks have passed; refetch only the last two.
    now_i = today.year * 12 + today.month
    todo = [(y, m) for (y, m) in months if f"{y:04d}-{m:02d}" not in series or now_i - (y * 12 + m) <= 1]
    for (y, m) in todo:
        start = date(y, m, 1)
        end = (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))
        series[f"{y:04d}-{m:02d}"] = _fedreg_count(AGENCIES[key], start.isoformat(), end.isoformat())
        time.sleep(0.25)
    return _save(name, dict(sorted(series.items())), "federalregister.gov API")


def load_fema(log):
    old = config.load_json(_path("fema"))
    if _fresh(old, 3):
        return old
    base = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
    flt = f"declarationType eq 'DR' and declarationDate ge '{START_YEAR}-01-01T00:00:00.000z'"
    seen, records, skip = set(), [], 0
    while True:
        r = _get(base, params={"$filter": flt, "$select": "disasterNumber,state,declarationDate,incidentType",
                               "$top": 1000, "$skip": skip, "$orderby": "declarationDate"}, timeout=90)
        rows = r.json().get("DisasterDeclarationsSummaries", [])
        for row in rows:
            k = (row.get("disasterNumber"), row.get("state"))
            if k in seen:
                continue
            seen.add(k)
            records.append([row.get("state"), (row.get("declarationDate") or "")[:10], row.get("incidentType")])
        if len(rows) < 1000:
            break
        skip += 1000
        time.sleep(0.3)
    if len(records) < 100:
        raise ValueError("FEMA returned too few declarations")
    by_month = {}
    for _st, d, _t in records:
        by_month[d[:7]] = by_month.get(d[:7], 0) + 1
    return _save("fema", dict(sorted(by_month.items())), "OpenFEMA, major disasters", {"records": records})


def update_all(log=print):
    """Load every source. Returns ({name: record}, [status rows]). Failures keep the cached copy."""
    MACRO_CACHE.mkdir(parents=True, exist_ok=True)
    jobs = [("gpr", load_gpr), ("epu", load_epu), ("cpu", load_cpu), ("us10y", load_treasury), ("fema", load_fema)]
    jobs += [(f"reg_{k}", (lambda log, k=k: load_fedreg(k, log))) for k in AGENCIES]
    out, status = {}, []
    for name, fn in jobs:
        try:
            rec = fn(log)
            out[name] = rec
            status.append({"name": name, "label": LABELS.get(name, name), "ok": True, "months": len(rec.get("series", {})),
                           "first": min(rec["series"]) if rec.get("series") else None,
                           "last": max(rec["series"]) if rec.get("series") else None, "source": rec.get("source")})
            log(f"  {name}: {len(rec.get('series', {}))} months")
        except Exception as e:
            cached = config.load_json(_path(name))
            if cached:
                out[name] = cached
            status.append({"name": name, "label": LABELS.get(name, name), "ok": False, "error": str(e)[:200],
                           "using_cache": bool(cached), "months": len((cached or {}).get("series", {}))})
            log(f"  {name}: FAILED {e}")
    return out, status


def load_cached():
    out = {}
    for name in LABELS:
        rec = config.load_json(_path(name))
        if rec:
            out[name] = rec
    return out
