import math
import random
from datetime import date, datetime

from pipeline import engine
from pipeline.research import evaluate, panel
from pipeline.research.strategies import STRATEGIES
from pipeline.sources import macro
from pipeline.tests import fixtures


def fake_macro():
    rng = random.Random(3)
    months = [f"{y:04d}-{m:02d}" for y in range(2010, 2027) for m in range(1, 13)]
    walk = lambda base, vol: {k: base * math.exp(sum(rng.gauss(0, vol) for _ in range(1))) for k in months}
    out = {k: {"series": walk(100, 0.2)} for k in ("gpr", "epu", "cpu")}
    out["us10y"] = {"series": {k: 2 + rng.random() for k in months}}
    for a in macro.AGENCIES:
        out[f"reg_{a}"] = {"series": {k: rng.randint(5, 40) for k in months}}
    out["fema"] = {"series": {}, "records": [["TX", "2025-09-10", "Hurricane"], ["CA", "2024-01-05", "Fire"]]}
    return out


def small():
    uni, fin_recs, price_recs, drv_recs = fixtures.small_data()
    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, drv_recs)
    return uni, fins, prices, drivers


def test_panel_rows_have_every_family_and_no_future_outcomes():
    uni, fins, prices, drivers = small()
    rows = panel.build(uni, fins, prices, drivers, fixtures.small_weights(), fake_macro(), start=date(2020, 1, 1),
                       today=date(2026, 11, 18), log=lambda m: None)
    assert rows and any(r["live"] for r in rows)
    live = [r for r in rows if r["live"]]
    assert all(r["f12"] is None and r["f3"] is None for r in live)
    r = next(r for r in rows if r["date"] == "2023-01-01" and r["ticker"] == "OIL1")
    for k in ("v_pe_own", "q_leverage", "g_rev", "t_mom_12_1", "t_low_vol", "m_gpr", "m_epu", "m_reg", "m_rates", "m_oil", "f12"):
        assert k in r
    assert r["m_gpr"] is not None and r["t_mom_12_1"] is not None and r["f12"] is not None


def test_every_strategy_is_scored_and_learned_weights_use_training_only():
    uni, fins, prices, drivers = small()
    rows = panel.build(uni, fins, prices, drivers, fixtures.small_weights(), fake_macro(), start=date(2019, 1, 1),
                       today=date(2026, 11, 18), log=lambda m: None)
    res = evaluate.run(rows, log=lambda m: None)
    assert [s["id"] for s in res["strategies"]] == [s["id"] for s in STRATEGIES]
    assert res["train_period"][1] < evaluate.TRAIN_END <= res["test_period"][0]
    for s in res["strategies"]:
        assert s["verdict"] in {"Clear edge", "Some edge", "Weak or unproven", "No edge", "Not enough data"}
    assert abs(sum(res["learned_weights"].values()) - 1) < 1e-6
    mom = next(s for s in res["strategies"] if s["id"] == "momentum")
    assert mom["picks"] and mom["portfolio"]["quarters"] > 4


def test_ranks_and_spearman():
    assert evaluate.ranks({"a": 1, "b": 2, "c": 2, "d": 3}) == {"a": 0.0, "b": 0.5, "c": 0.5, "d": 1.0}
    assert round(evaluate.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 6) == 1.0
    assert round(evaluate.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), 6) == -1.0


def test_macro_parsers():
    rows = [["title"], ["month", "GPR", "GPRT"], [datetime(2024, 1, 1), 101.5, 90], [datetime(2024, 2, 1), 120.0, 95]]
    assert macro.parse_gpr_rows(rows) == {"2024-01": 101.5, "2024-02": 120.0}
    csv_text = "date,cpu_index\n2024-01-01,150.2\n2024-02-01,160\n"
    assert macro.parse_monthly_csv(csv_text, ("date",), ("cpu_index",)) == {"2024-01": 150.2, "2024-02": 160.0}
    tsy = "Date,1 Mo,10 Yr\n11/20/2026,4.1,4.35\n11/19/2026,4.1,4.31\n"
    assert macro.parse_treasury_csv(tsy) == {"2026-11-20": 4.35, "2026-11-19": 4.31}
    assert macro.month_end_mean({"2026-11-20": 4.0, "2026-11-19": 5.0}) == {"2026-11": 4.5}


def test_beta_learns_a_known_reaction():
    keys = [f"2020-{m:02d}" for m in range(1, 13)] + [f"2021-{m:02d}" for m in range(1, 13)] + [f"2022-{m:02d}" for m in range(1, 13)]
    rng = random.Random(1)
    xs = {k: rng.gauss(0, 1) for k in keys}
    ys = {k: 0.02 * xs[k] for k in keys}
    b = panel.beta(ys, xs, keys)
    assert b > 0.015



def test_panel_values_are_plain_numbers():
    from pipeline.research.strategies import FACTORS
    uni, fins, prices, drivers = small()
    rows = panel.build(uni, fins, prices, drivers, fixtures.small_weights(), fake_macro(), start=date(2020, 1, 1),
                       today=date(2026, 11, 18), log=lambda m: None)
    for r in rows:
        for k, *_ in FACTORS:
            v = r.get(k)
            assert v is None or (isinstance(v, (int, float)) and not isinstance(v, bool)), (k, v)
    assert any(r.get("q_fcf_years") is not None for r in rows)


def test_climate_policy_spreadsheet_parser():
    import io
    import openpyxl
    from pipeline.sources.macro import parse_cpu_xlsx
    wb = openpyxl.Workbook()
    wb.active.title = "readme"
    ws = wb.create_sheet("data")
    ws.append(["date", "cpu_index_narrow", "cpu_index_broad"])
    ws.append(["2026M03", 369.5, 300.0])
    ws.append(["2026M04", 365.1, 297.9])
    ws.append(["2026M05", None, None])
    buf = io.BytesIO()
    wb.save(buf)
    assert parse_cpu_xlsx(buf.getvalue()) == {"2026-03": 369.5, "2026-04": 365.1}
