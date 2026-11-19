"""Turn filed line items into point-in-time figures.

Quarterly reports often give year-to-date totals (6 months, 9 months), so
single quarters are rebuilt by subtracting the earlier total. Every value
keeps the date it was filed, and every lookup takes an "as of" date, so a
figure is only used once it was public.
"""
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import median

DURATION_ITEMS = {"revenue", "net_income", "operating_income", "pretax_income", "dna", "cfo", "capex", "interest", "shares"}
INSTANT_ITEMS = {"cash", "debt_total", "debt_noncurrent", "debt_current", "short_debt"}
STALE_DAYS = 460  # about 15 months


def d(s):
    return date.fromisoformat(s[:10])


@dataclass
class Item:
    quarters: dict = field(default_factory=dict)   # end -> (value, filed)
    annual: dict = field(default_factory=dict)     # end -> (value, filed)
    points: dict = field(default_factory=dict)     # end -> (value, filed), instants or any


def _dedupe(facts):
    """Keep the first-filed value for each (start, end) pair."""
    best = {}
    for start, end, val, filed, _form in facts:
        key = (start, end)
        if key not in best or filed < best[key][1]:
            best[key] = (val, filed)
    return best


def build_item(facts, duration=True):
    it = Item()
    best = _dedupe(facts)
    if not duration:
        for (start, end), (val, filed) in best.items():
            prev = it.points.get(end)
            if not prev or filed < prev[1]:
                it.points[end] = (val, filed)
        return it
    groups = {}
    for (start, end), (val, filed) in best.items():
        if not start:
            it.points[end] = (val, filed)
            continue
        days = (d(end) - d(start)).days
        if 80 <= days <= 100:
            it.quarters[end] = (val, filed)
        if 350 <= days <= 380:
            it.annual[end] = (val, filed)
        groups.setdefault(start, []).append((d(end), days, end, val, filed))
        prev = it.points.get(end)
        if not prev or filed < prev[1]:
            it.points[end] = (val, filed)
    # Rebuild single quarters from year-to-date totals that share a start date.
    for start, rows in groups.items():
        rows.sort()
        for a, b in zip(rows, rows[1:]):
            gap = b[1] - a[1]
            if 80 <= gap <= 100 and b[2] not in it.quarters:
                it.quarters[b[2]] = (b[3] - a[3], max(a[4], b[4]))
    return it


class Financials:
    def __init__(self, rec):
        self.rec = rec or {}
        self.currency = (self.rec.get("currency") or "USD")
        self.items = {}
        for name, node in (self.rec.get("items") or {}).items():
            dur = name in DURATION_ITEMS
            self.items[name] = build_item(node.get("facts", []), duration=dur)

    @property
    def usd(self):
        return self.currency == "USD"

    @property
    def empty(self):
        return not self.items

    # --- lookups -------------------------------------------------------
    def ttm(self, name, asof, max_end=None):
        """Sum of the last 4 quarters filed by `asof`, or the latest annual figure.
        Returns (value, period_end) or (None, None)."""
        it = self.items.get(name)
        if not it:
            return None, None
        asof_s = asof.isoformat()
        cap = max_end.isoformat() if max_end else asof_s
        qs = sorted((e, v) for e, (v, f) in it.quarters.items() if f <= asof_s and e <= cap)
        q_val, q_end = None, None
        if len(qs) >= 4:
            last4 = qs[-4:]
            ends = [d(e) for e, _ in last4]
            if all(70 <= (b - a).days <= 110 for a, b in zip(ends, ends[1:])):
                q_val, q_end = sum(v for _, v in last4), last4[-1][0]
        ann = sorted((e, v) for e, (v, f) in it.annual.items() if f <= asof_s and e <= cap)
        a_val, a_end = (ann[-1][1], ann[-1][0]) if ann else (None, None)
        if q_end and (not a_end or q_end >= a_end):
            val, end = q_val, q_end
        else:
            val, end = a_val, a_end
        ref = max_end or asof
        if end is None or (ref - d(end)).days > STALE_DAYS:
            return None, None
        return val, end

    def latest(self, name, asof, max_end=None):
        """Most recent single value (balance sheet items, share counts)."""
        it = self.items.get(name)
        if not it:
            return None, None
        asof_s = asof.isoformat()
        cap = max_end.isoformat() if max_end else asof_s
        pts = sorted((e, v) for e, (v, f) in it.points.items() if f <= asof_s and e <= cap)
        if not pts:
            return None, None
        end, val = pts[-1]
        ref = max_end or asof
        if (ref - d(end)).days > STALE_DAYS:
            return None, None
        return val, end

    def annual_series(self, name, asof):
        it = self.items.get(name)
        if not it:
            return {}
        a = asof.isoformat()
        return {e: v for e, (v, f) in it.annual.items() if f <= a}

    # --- derived figures ---------------------------------------------
    def snapshot(self, asof, max_end=None):
        g = lambda n: self.ttm(n, asof, max_end)[0]
        rev, end = self.ttm("revenue", asof, max_end)
        ni = g("net_income")
        op = g("operating_income")
        dna = g("dna")
        interest = g("interest")
        if op is None:
            pretax = g("pretax_income")
            if pretax is not None:
                op = pretax + abs(interest or 0)
        cfo = g("cfo")
        capex = g("capex")
        cash = self.latest("cash", asof, max_end)[0]
        debt = self.latest("debt_total", asof, max_end)[0]
        if debt is None:
            nc = self.latest("debt_noncurrent", asof, max_end)[0]
            cur = self.latest("debt_current", asof, max_end)[0]
            if nc is not None or cur is not None:
                debt = (nc or 0) + (cur or 0)
        short = self.latest("short_debt", asof, max_end)[0]
        if debt is not None and short:
            debt += short
        shares = self.latest("shares", asof, max_end)[0]
        ebitda = (op + abs(dna)) if (op is not None and dna is not None) else op
        fcf = (cfo - abs(capex)) if (cfo is not None and capex is not None) else None
        eps = (ni / shares) if (ni is not None and shares) else None
        return {
            "revenue": rev, "net_income": ni, "operating_income": op, "ebitda": ebitda,
            "cfo": cfo, "capex": abs(capex) if capex is not None else None, "fcf": fcf,
            "interest": abs(interest) if interest is not None else None,
            "cash": cash, "debt": debt, "shares": shares, "eps": eps, "period_end": end,
        }

    def fcf_positive_years(self, asof, n=4):
        cfo = self.annual_series("cfo", asof)
        capex = self.annual_series("capex", asof)
        ends = sorted(set(cfo) & set(capex))[-n:]
        if not ends:
            return None, 0
        pos = sum(1 for e in ends if cfo[e] - abs(capex[e]) > 0)
        return pos, len(ends)


def growth(fin, asof, years=3):
    """Per-year growth in revenue and earnings per share over `years`."""
    now = fin.snapshot(asof)
    past_end = asof - timedelta(days=int(365.25 * years))
    then = fin.snapshot(asof, max_end=past_end)

    def cagr(a, b):
        if a is None or b is None or a <= 0 or b <= 0:
            return None
        return (a / b) ** (1 / years) - 1

    return cagr(now["revenue"], then["revenue"]), cagr(now["eps"], then["eps"])


class Prices:
    def __init__(self, closes, max_gap=10):
        self.dates = [d(x[0]) for x in closes]
        self.closes = [x[1] for x in closes]
        # How stale the last value may be. Daily series allow 10 days; monthly series need more.
        self.max_gap = max_gap

    @property
    def empty(self):
        return not self.dates

    def on(self, day):
        i = bisect_right(self.dates, day) - 1
        if i < 0:
            return None
        if (day - self.dates[i]).days > self.max_gap:
            return None
        return self.closes[i]

    def window(self, end, days):
        j = bisect_right(self.dates, end)
        start = end - timedelta(days=days)
        i = bisect_right(self.dates, start)
        return self.closes[i:j]

    def moving_average(self, end, n):
        j = bisect_right(self.dates, end)
        if j < n:
            return None
        seg = self.closes[j - n:j]
        return sum(seg) / n

    def last(self, end=None):
        end = end or (self.dates[-1] if self.dates else None)
        if not end:
            return None, None
        j = bisect_right(self.dates, end) - 1
        if j < 0:
            return None, None
        return self.dates[j], self.closes[j]

    def weekly(self, end, weeks):
        out = []
        for k in range(weeks, -1, -1):
            day = end - timedelta(weeks=k)
            out.append(self.on(day))
        return out


def pe_history_median(fin, prices, asof, years=5):
    """Median price-to-earnings ratio at past quarter ends, each using only data public then."""
    pts = []
    for k in range(1, years * 4 + 1):
        day = asof - timedelta(days=int(91.3 * k))
        p = prices.on(day)
        if p is None:
            continue
        eps = fin.snapshot(day)["eps"]
        if eps and eps > 0:
            pe = p / eps
            if 0 < pe < 200:
                pts.append(pe)
    if len(pts) < 8:
        return None, len(pts)
    return median(pts), len(pts)


def correlation(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 40:
        return None
    mx = sum(p[0] for p in pairs) / len(pairs)
    my = sum(p[1] for p in pairs) / len(pairs)
    sxx = sum((p[0] - mx) ** 2 for p in pairs)
    syy = sum((p[1] - my) ** 2 for p in pairs)
    if sxx == 0 or syy == 0:
        return None
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pairs)
    return sxy / (sxx * syy) ** 0.5
