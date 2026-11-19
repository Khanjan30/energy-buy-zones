"""The Version 1 formula. Pure functions: numbers in, scores and reasons out.

See the "Energy Stock Scoring Formula, Version 1" spec for the reasoning.
"""
from datetime import date, timedelta
from statistics import median

LIKELIHOOD = {"happening": 1.0, "likely": 0.5, "early": 0.25}
POLICY_TYPES = {"Government decision", "Rule change", "Government change", "Trade and tariffs", "Interest rates"}
OUTSIDE_TYPES = {"Geopolitical", "Cyber attack", "Natural disaster", "Weather"}
PILLARS = ["value", "strength", "growth", "policy", "outside"]
PILLAR_LABELS = {"value": "Value", "strength": "Strength", "growth": "Growth and drivers",
                 "policy": "Policy and regulation", "outside": "Outside pressure"}


def clip(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def interp(x, points):
    """Piecewise-linear score from sorted (x, score) points, flat beyond the ends."""
    if x <= points[0][0]:
        return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return points[-1][1]


def vs_median(x, med):
    """100 at 40% or more below the median, 50 at it, 0 at 40% or more above."""
    if x is None or med is None or x <= 0 or med <= 0:
        return None
    return clip(50 + 125 * (med - x) / med)


def percentile(x, values):
    vals = [v for v in values if v is not None]
    if x is None or len(vals) < 3:
        return None
    below = sum(1 for v in vals if v < x)
    equal = sum(1 for v in vals if v == x)
    return clip(100 * (below + 0.5 * (equal - 1)) / (len(vals) - 1))


def peer_median(values):
    vals = [v for v in values if v is not None and v > 0]
    return median(vals) if len(vals) >= 3 else None


def avg(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def fmt_x(x):
    return f"{x:.1f} times"


def fmt_pct(x):
    return f"{x * 100:.0f}%"


# --- pillars ----------------------------------------------------------

def value_pillar(m, peers, early):
    inputs = []
    if early or not m.get("eps") or m["eps"] <= 0:
        s = vs_median(m.get("ps"), peers.get("ps_median"))
        if s is not None:
            inputs.append(("Price to sales against peers", s,
                           f"Priced at {fmt_x(m['ps'])} sales against a group median of {fmt_x(peers['ps_median'])}."))
    else:
        s = vs_median(m.get("pe"), m.get("pe_median"))
        if s is not None:
            inputs.append(("Price to earnings against its 5-year median", s,
                           f"Trades at {fmt_x(m['pe'])} earnings against its own 5-year median of {fmt_x(m['pe_median'])}."))
        s = vs_median(m.get("ev_ebitda"), peers.get("ev_ebitda_median"))
        if s is not None:
            inputs.append(("Enterprise value to cash earnings against peers", s,
                           f"Enterprise value is {fmt_x(m['ev_ebitda'])} cash earnings; the group median is {fmt_x(peers['ev_ebitda_median'])}."))
        s = percentile(m.get("fcf_yield"), peers.get("fcf_yields", []))
        if s is not None:
            inputs.append(("Free cash flow yield, ranked in group", s,
                           f"Free cash flow yield of {fmt_pct(m['fcf_yield'])}, ranked against its group."))
    return inputs


def strength_pillar(m, regulated, early):
    inputs = []
    if early:
        runway = m.get("runway")
        if runway is not None:
            s = interp(runway, [(1, 0), (2, 50), (4, 100)])
            txt = "Generates its own cash, so runway is not a concern." if runway == float("inf") else \
                f"Cash covers about {runway:.1f} years at the current burn rate."
            inputs.append(("Cash runway", s, txt))
        return inputs
    lev = m.get("leverage")
    if lev is not None:
        allowance = 2 if regulated else 0
        s = clip(100 - 20 * (lev - allowance - 1)) if lev != float("inf") else 0
        txt = "Has more cash than debt." if lev <= 0 else f"Net debt is {fmt_x(lev)} cash earnings" + \
            (" (regulated businesses get 2 extra turns of allowance)." if regulated else ".")
        if lev == float("inf"):
            txt = "Cash earnings are negative, so debt cannot be covered from operations."
        inputs.append(("Net debt to cash earnings", s, txt))
    cov = m.get("coverage")
    if cov is not None:
        s = interp(cov, [(1.5, 0), (2, 20), (4, 60), (8, 100)])
        inputs.append(("Interest coverage", s, f"Cash earnings cover interest {fmt_x(cov)}."))
    pos = m.get("fcf_pos")
    if pos and pos[1] >= 2:
        count, n = pos
        s = 100 * count / n
        inputs.append(("Years of positive free cash flow", s, f"Free cash flow was positive in {count} of the last {n} years."))
    return inputs


def growth_pillar(m, peers, early):
    inputs = []
    s = percentile(m.get("rev_cagr"), peers.get("rev_cagrs", []))
    if s is not None:
        inputs.append(("Revenue growth, ranked in group", s,
                       f"Revenue grew {fmt_pct(m['rev_cagr'])} a year over 3 years."))
    if not early:
        s = percentile(m.get("eps_cagr"), peers.get("eps_cagrs", []))
        if s is not None:
            inputs.append(("Earnings per share growth, ranked in group", s,
                           f"Earnings per share grew {fmt_pct(m['eps_cagr'])} a year over 3 years."))
    corr, trend = m.get("driver_corr"), m.get("driver_trend")
    if corr is not None and trend is not None:
        s = clip(50 + 50 * corr * trend)
        direction = "rising" if trend > 0.05 else "falling" if trend < -0.05 else "flat"
        follow = "closely" if abs(corr) >= 0.5 else "loosely" if abs(corr) >= 0.2 else "barely"
        inverse = " and moves against it" if corr < 0 else ""
        inputs.append(("Main energy driver", s,
                       f"The stock follows the {m['driver_label']} {follow}{inverse}; the driver has been {direction} for 6 months."))
    return inputs


def event_weight(ev, asof):
    start = date.fromisoformat(ev["date"])
    if start > asof:
        return 0.0
    review = date.fromisoformat(ev["review_date"]) if ev.get("review_date") else start + timedelta(days=180)
    if asof <= review:
        w = 1.0
    elif asof <= review + timedelta(days=90):
        w = 0.5
    else:
        return 0.0
    return w * LIKELIHOOD.get(ev.get("likelihood", "likely"), 0.5)


def event_effects(ticker, subsector, events, asof, pillar):
    """Return [(event, effect, weighted_impact)] for events touching this stock in this pillar."""
    out = []
    for ev in events:
        ev_pillar = "policy" if ev.get("type") in POLICY_TYPES else "outside"
        if ev_pillar != pillar:
            continue
        w = event_weight(ev, asof)
        if w == 0:
            continue
        for eff in ev.get("effects", []):
            if ticker in eff.get("tickers", []) or subsector in eff.get("subsectors", []):
                if ticker in eff.get("exclude", []):
                    continue
                out.append((ev, eff, eff["impact"] * w))
                break
    return out


def policy_pillar(ticker, subsector, events, asof):
    effs = event_effects(ticker, subsector, events, asof, "policy")
    score = clip(50 + 10 * sum(x for _, _, x in effs))
    why = _events_sentence(effs, "No live policy or regulation events are logged for this company.")
    return score, why, effs


def outside_pillar(ticker, subsector, exposure, events, asof):
    nat = exposure.get("natural", 0)
    sup = exposure.get("supply_chain", 0)
    effs = event_effects(ticker, subsector, events, asof, "outside")
    score = clip(50 - 5 * nat - 5 * sup + 10 * sum(x for _, _, x in effs))
    base = []
    if nat:
        base.append(f"natural hazard exposure {nat} of 3")
    if sup:
        base.append(f"supply chain concentration {sup} of 3")
    standing = ("Standing risks: " + ", ".join(base) + ". ") if base else ""
    why = standing + _events_sentence(effs, "No live geopolitical, cyber or natural events are logged for this company.")
    return score, why, effs


def _events_sentence(effs, empty):
    if not effs:
        return empty
    effs = sorted(effs, key=lambda e: -abs(e[2]))[:3]
    parts = []
    for ev, eff, x in effs:
        sign = "helps" if x > 0 else "hurts"
        parts.append(f"{ev['title']} ({sign})")
    return "Live events: " + "; ".join(parts) + "."


# --- combine ------------------------------------------------------------

def band_for(score):
    if score is None:
        return "Not enough data"
    if score >= 70:
        return "Strong"
    if score >= 50:
        return "Fair"
    if score >= 40:
        return "Weak"
    return "Broken"


def ownership(pillars, weights):
    """Weighted average over the pillars that have a score. Needs at least half the weight."""
    total_w = sum(weights.values())
    used = {p: weights[p] for p in PILLARS if pillars.get(p) is not None}
    if not used or sum(used.values()) < 0.5 * total_w:
        return None, sum(used.values()) / total_w if total_w else 0
    score = sum(pillars[p] * w for p, w in used.items()) / sum(used.values())
    return score, sum(used.values()) / total_w


def hard_fails(m, regulated, early, policy_effects):
    fails = []
    runway = m.get("runway")
    if runway is not None and runway < 1:
        fails.append(("weak", "Cash runway is under 1 year."))
    lev = m.get("leverage")
    limit = 8 if regulated else 6
    if not early and lev is not None and lev != float("inf") and lev > limit:
        fails.append(("cap_fair", f"Net debt is above {limit} times cash earnings."))
    for ev, eff, x in policy_effects:
        if eff.get("impact") == -2 and ev.get("likelihood") == "happening" and eff.get("core"):
            fails.append(("cap_fair", f"Core business hit by: {ev['title']}."))
    return fails


def apply_fails(score, fails):
    if score is None:
        return None
    for kind, _ in fails:
        if kind == "weak":
            score = min(score, 45.0)
        elif kind == "cap_fair":
            score = min(score, 69.0)
    return score


def fair_value(m, peers, early):
    if early:
        return None, []
    views = []
    eps, pe_med = m.get("eps"), m.get("pe_median")
    if eps and eps > 0 and pe_med:
        views.append(("Earnings view", eps * pe_med))
    fcf_ps, med_y = m.get("fcf_per_share"), peers.get("fcf_yield_median")
    if fcf_ps and fcf_ps > 0 and med_y and med_y > 0:
        views.append(("Cash view", fcf_ps / med_y))
    if not views:
        return None, []
    return sum(v for _, v in views) / len(views), views


POSITIONS = [(0.75, "Deep discount"), (0.90, "Buy zone"), (1.10, "Fair"), (1.30, "Full"), (float("inf"), "Stretched")]


def price_position(price, fv):
    if price is None or fv is None or fv <= 0:
        return None, None
    r = price / fv
    for limit, name in POSITIONS:
        if r < limit:
            return name, r
    return "Stretched", r


GRID = {
    "Strong": {"Deep discount": "Buy, check the news", "Buy zone": "Buy", "Fair": "Hold", "Full": "Hold", "Stretched": "Trim"},
    "Fair": {"Deep discount": "Buy small", "Buy zone": "Buy small", "Fair": "Hold", "Full": "Hold", "Stretched": "Trim"},
    "Weak": {"Deep discount": "Avoid", "Buy zone": "Avoid", "Fair": "Hold if owned, review", "Full": "Trim", "Stretched": "Sell"},
    "Broken": {p: "Sell" for _, p in POSITIONS},
}


def action_for(band, position, early, tech):
    if band == "Not enough data":
        return "Not enough data"
    if early:
        if band in ("Weak", "Broken"):
            return "Avoid" if band == "Weak" else "Sell"
        # No fair value for early-stage companies: use the chart only.
        if tech.get("below_ma200"):
            return "Buy small, 3% cap"
        return "Watch"
    if position is None:
        return {"Strong": "Hold", "Fair": "Hold", "Weak": "Avoid", "Broken": "Sell"}[band]
    return GRID[band][position]


ACTION_RANK = {"Buy, check the news": 0, "Buy": 1, "Buy small": 2, "Buy small, 3% cap": 3, "Hold": 4,
               "Hold if owned, review": 5, "Watch": 6, "Trim": 7, "Avoid": 8, "Sell": 9, "Not enough data": 10}


def score_stock(m, peers, subsector, regulated, early, weights, events, exposure, asof, include_manual=True):
    """Score one stock. `m` is its metrics, `peers` its group's medians and lists."""
    result = {"pillars": {}}
    v_in = value_pillar(m, peers, early)
    s_in = strength_pillar(m, regulated, early)
    g_in = growth_pillar(m, peers, early)
    pillar_scores = {"value": avg([x[1] for x in v_in]), "strength": avg([x[1] for x in s_in]),
                     "growth": avg([x[1] for x in g_in])}
    details = {"value": v_in, "strength": s_in, "growth": g_in}
    policy_effects = []
    if include_manual:
        ps, pwhy, policy_effects = policy_pillar(m["ticker"], subsector, events, asof)
        os_, owhy, outside_effects = outside_pillar(m["ticker"], subsector, exposure, events, asof)
        pillar_scores["policy"], pillar_scores["outside"] = ps, os_
        details["policy"] = [("Events in the log", ps, pwhy)]
        details["outside"] = [("Standing exposure and live events", os_, owhy)]
        result["event_ids"] = sorted({ev["id"] for ev, _, _ in policy_effects + outside_effects})
    for p in PILLARS:
        if p not in details:
            continue
        sc = pillar_scores.get(p)
        result["pillars"][p] = {
            "label": PILLAR_LABELS[p],
            "score": round(sc, 1) if sc is not None else None,
            "weight": weights[p],
            "inputs": [{"name": n, "score": round(s, 1), "why": w} for n, s, w in details[p]],
        }
    w_used = {p: weights[p] for p in details}
    raw, coverage = ownership(pillar_scores, w_used)
    fails = hard_fails(m, regulated, early, policy_effects)
    score = apply_fails(raw, fails)
    band = band_for(score)
    fv, views = fair_value(m, peers, early)
    position, ratio = price_position(m.get("price"), fv)
    tech = m.get("tech", {})
    action = action_for(band, position, early, tech)
    zone = [round(0.75 * fv, 2), round(0.90 * fv, 2)] if fv else None
    result.update({
        "score": round(score, 1) if score is not None else None,
        "raw_score": round(raw, 1) if raw is not None else None,
        "coverage": round(coverage, 2),
        "band": band,
        "hard_fails": [t for _, t in fails],
        "fair_value": round(fv, 2) if fv else None,
        "fair_value_views": [{"name": n, "value": round(v, 2)} for n, v in views],
        "position": position,
        "price_to_fair": round(ratio, 3) if ratio else None,
        "buy_zone": zone,
        "add_more": round(zone[0] * 0.9, 2) if zone else None,
        "action": action,
    })
    return result
