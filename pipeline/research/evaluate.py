"""Score every strategy on the panel and measure how well each one did.

Measures, for training years and the later test years separately:
- skill (rank correlation between the score and the next 12 months' return), across all stocks
  and inside each sector; 0 means no skill, 0.05 to 0.10 is useful, above 0.10 is strong
- hit rate: share of dates where skill was above zero
- top third minus bottom third: next-12-month return gap between the best and worst scored
- a portfolio of the 10 best-scored stocks, rebalanced every quarter, against owning all of them
"""
import math
from statistics import mean, pstdev

from .strategies import FACTOR_FAMILY, FACTORS, STRATEGIES

TRAIN_END = "2020-01-01"
TOP_N = 10


def ranks(values):
    """Percentile ranks 0..1 with ties averaged. values: {key: number}."""
    items = sorted(values.items(), key=lambda kv: kv[1])
    n = len(items)
    out, i = {}, 0
    while i < n:
        j = i
        while j + 1 < n and items[j + 1][1] == items[i][1]:
            j += 1
        r = (i + j) / 2 / (n - 1) if n > 1 else 0.5
        for k in range(i, j + 1):
            out[items[k][0]] = r
        i = j + 1
    return out


def spearman(xs, ys):
    if len(xs) < 5:
        return None
    rx, ry = ranks(dict(enumerate(xs))), ranks(dict(enumerate(ys)))
    a, b = [rx[i] for i in range(len(xs))], [ry[i] for i in range(len(ys))]
    sa, sb = pstdev(a), pstdev(b)
    if not sa or not sb:
        return None
    ma, mb = mean(a), mean(b)
    return mean((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb)


def by_date(rows):
    out = {}
    for r in rows:
        out.setdefault(r["date"], []).append(r)
    return dict(sorted(out.items()))


def factor_ranks(day_rows):
    """For one date: {factor: {ticker: percentile}} across all stocks with a value."""
    out = {}
    for k, *_ in FACTORS:
        vals = {r["ticker"]: r[k] for r in day_rows
                if isinstance(r.get(k), (int, float)) and not isinstance(r[k], bool) and math.isfinite(r[k])}
        if len(vals) >= 5:
            out[k] = ranks(vals)
    return out


def combine(fr, tickers, factors=None, families=None, weights=None):
    """Average of available percentile ranks; needs at least half the weight present."""
    out = {}
    if families:
        groups = {f: [k for k in fr if FACTOR_FAMILY.get(k) == f] for f in families}
        for t in tickers:
            fam_scores = []
            for f, ks in groups.items():
                xs = [fr[k][t] for k in ks if t in fr[k]]
                if xs and len(xs) * 2 >= len(ks):
                    fam_scores.append(mean(xs))
            if fam_scores and len(fam_scores) * 2 >= len(families):
                out[t] = mean(fam_scores)
        return out
    w = weights or {k: 1.0 for k in factors}
    total = sum(w.values())
    if not total:
        return out
    for t in tickers:
        have = [(w[k], fr[k][t]) for k in w if w[k] > 0 and k in fr and t in fr[k]]
        got = sum(x for x, _ in have)
        if have and got * 2 >= total:
            out[t] = sum(x * v for x, v in have) / got
    return out


def skill(day_rows, scores, horizon="f12"):
    """(across all stocks, inside sectors) rank correlation for one date."""
    pts = [(scores[r["ticker"]], r[horizon], r["sub"]) for r in day_rows if r["ticker"] in scores and r.get(horizon) is not None]
    overall = spearman([p[0] for p in pts], [p[1] for p in pts])
    subs, num, den = {}, 0.0, 0
    for s, f, sub in pts:
        subs.setdefault(sub, []).append((s, f))
    for sub, xs in subs.items():
        if len(xs) >= 5:
            c = spearman([x[0] for x in xs], [x[1] for x in xs])
            if c is not None:
                num += c * len(xs)
                den += len(xs)
    return overall, (num / den if den else None)


def spread(day_rows, scores, horizon="f12"):
    pts = sorted(((scores[r["ticker"]], r[horizon]) for r in day_rows if r["ticker"] in scores and r.get(horizon) is not None))
    if len(pts) < 9:
        return None
    third = len(pts) // 3
    return mean(p[1] for p in pts[-third:]) - mean(p[1] for p in pts[:third])


def summarize(per_date, dates):
    xs = [per_date[d] for d in dates if d in per_date]
    def agg(key):
        v = [x[key] for x in xs if x.get(key) is not None]
        if not v:
            return None, None, 0
        m = mean(v)
        t = m / (pstdev(v) / math.sqrt(len(v))) if len(v) > 2 and pstdev(v) else None
        return m, t, len(v)
    ic, ic_t, n = agg("ic_all")
    ics, ics_t, _ = agg("ic_sector")
    sp, _, _ = agg("spread")
    both = [(x["ic_all"] + x["ic_sector"]) / 2 for x in xs if x.get("ic_all") is not None and x.get("ic_sector") is not None]
    hit = [v > 0 for v in both]
    sk = [v for v in (ic, ics) if v is not None]
    return {"skill": mean(sk) if sk else None, "ic_all": ic, "ic_all_t": ic_t, "ic_sector": ics, "ic_sector_t": ics_t, "spread": sp,
            "hit": (sum(hit) / len(hit)) if hit else None, "dates": n}


def portfolio(by_d, score_by_date, dates):
    """Top 10 by score, equal weight, rebalanced each quarter, held 3 months."""
    curve, bench, value, bvalue, beats, rets, brets = [], [], 1.0, 1.0, 0, [], []
    for d in dates:
        rows = [r for r in by_d[d] if r.get("f3") is not None]
        sc = score_by_date.get(d, {})
        ranked = sorted((r for r in rows if r["ticker"] in sc), key=lambda r: sc[r["ticker"]], reverse=True)
        if len(ranked) < TOP_N or not rows:
            continue
        pr = mean(r["f3"] for r in ranked[:TOP_N])
        br = mean(r["f3"] for r in rows)
        value *= 1 + pr
        bvalue *= 1 + br
        beats += pr > br
        rets.append(pr)
        brets.append(br)
        curve.append([d, round(value * 100, 2)])
        bench.append([d, round(bvalue * 100, 2)])
    n = len(rets)
    if not n:
        return None
    def cagr(v):
        return v ** (4 / n) - 1
    def max_dd(c):
        peak, dd = 0, 0
        for _, v in c:
            peak = max(peak, v)
            dd = min(dd, v / peak - 1)
        return dd
    return {"quarters": n, "cagr": cagr(value), "bench_cagr": cagr(bvalue), "excess_cagr": cagr(value) - cagr(bvalue),
            "beat_rate": beats / n, "max_drawdown": max_dd(curve), "bench_max_drawdown": max_dd(bench),
            "curve": curve, "bench_curve": bench}


def verdict(train, test):
    """Plain call on whether a strategy has an edge, judged on the test years it was not built on.

    Skill is the average of the across-all and inside-sector rank correlations.
    """
    a, b = (train or {}).get("skill"), (test or {}).get("skill")
    if b is None:
        return "Not enough data"
    hit = (test or {}).get("hit") or 0
    if b > 0.05 and (a or 0) > 0 and hit >= 0.6:
        return "Clear edge"
    if b > 0.02 and (a or 0) > 0:
        return "Some edge"
    if b > 0:
        return "Weak or unproven"
    return "No edge"


def run(rows, log=print):
    by_d = by_date([r for r in rows if not r.get("live")])
    live = by_date([r for r in rows if r.get("live")])
    all_dates = list(by_d)
    train_dates = [d for d in all_dates if d < TRAIN_END]
    test_dates = [d for d in all_dates if d >= TRAIN_END]
    franks = {d: factor_ranks(v) for d, v in by_d.items()}
    live_ranks = {d: factor_ranks(v) for d, v in live.items()}

    # How well each single signal worked.
    factor_report = []
    for k, f, name, plain in FACTORS:
        per = {}
        for d, day in by_d.items():
            if k in franks[d]:
                a, s = skill(day, franks[d][k])
                per[d] = {"ic_all": a, "ic_sector": s, "spread": spread(day, franks[d][k])}
        factor_report.append({"key": k, "family": f, "name": name, "plain": plain,
                              "train": summarize(per, train_dates), "test": summarize(per, test_dates)})

    # Weights for the learned formula: training-years skill only, negatives dropped.
    learned_w = {}
    for fr in factor_report:
        if fr["family"] == "current":
            continue
        tr = fr["train"]
        vals = [x for x in (tr.get("ic_all"), tr.get("ic_sector")) if x is not None]
        learned_w[fr["key"]] = max(0.0, mean(vals)) if vals else 0.0
    if not any(learned_w.values()):
        learned_w = {k: 1.0 for k in learned_w}

    results = []
    for st in STRATEGIES:
        def scores_for(fr, day_rows):
            tickers = [r["ticker"] for r in day_rows]
            if st.get("learned"):
                return combine(fr, tickers, weights=learned_w)
            if st.get("families"):
                return combine(fr, tickers, families=st["families"])
            return combine(fr, tickers, factors=st["factors"])
        sc_by_d, per = {}, {}
        for d, day in by_d.items():
            sc = scores_for(franks[d], day)
            sc_by_d[d] = sc
            if len(sc) >= 5:
                a, s = skill(day, sc)
                per[d] = {"ic_all": a, "ic_sector": s, "spread": spread(day, sc)}
        tr, te = summarize(per, train_dates), summarize(per, test_dates)
        port_all = portfolio(by_d, sc_by_d, all_dates)
        port_test = portfolio(by_d, sc_by_d, test_dates)
        picks = []
        for d, day in live.items():
            sc = scores_for(live_ranks[d], day)
            picks = [{"ticker": t, "score": round(v * 100, 1)} for t, v in sorted(sc.items(), key=lambda kv: -kv[1])[:10]]
        families = sorted({FACTOR_FAMILY[k] for k in (st.get("factors") or [])} | set(st.get("families") or []) |
                          ({FACTOR_FAMILY[k] for k, w in learned_w.items() if w > 0} if st.get("learned") else set()))
        results.append({
            "id": st["id"], "name": st["name"], "plain": st["plain"], "families": families,
            "factors": st.get("factors") or ([k for k, w in learned_w.items() if w > 0] if st.get("learned") else
                                             [k for k in FACTOR_FAMILY if FACTOR_FAMILY[k] in (st.get("families") or [])]),
            "train": tr, "test": te, "verdict": verdict(tr, te),
            "portfolio": port_all, "portfolio_test": ({k: v for k, v in port_test.items() if k not in ("curve", "bench_curve")} if port_test else None),
            "picks": picks,
        })
        log(f"  strategy {st['id']}: test skill {te.get('ic_sector')}")
    total_w = sum(learned_w.values()) or 1
    return {
        "train_period": [train_dates[0] if train_dates else None, train_dates[-1] if train_dates else None],
        "test_period": [test_dates[0] if test_dates else None, test_dates[-1] if test_dates else None],
        "dates": len(all_dates), "observations": sum(len(v) for v in by_d.values()),
        "factors": factor_report,
        "strategies": results,
        "learned_weights": {k: round(v / total_w, 4) for k, v in sorted(learned_w.items(), key=lambda kv: -kv[1]) if v > 0},
    }
