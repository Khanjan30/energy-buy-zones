from datetime import date

from pipeline import backtest, engine, output, scoring
from pipeline.financials import Financials, build_item
from pipeline.tests import fixtures


def test_year_to_date_totals_become_quarters():
    facts = [
        ["2024-01-01", "2024-03-31", 100, "2024-05-01", "10-Q"],
        ["2024-01-01", "2024-06-30", 250, "2024-08-01", "10-Q"],
        ["2024-01-01", "2024-09-30", 380, "2024-11-01", "10-Q"],
        ["2024-01-01", "2024-12-31", 500, "2025-02-20", "10-K"],
    ]
    it = build_item(facts)
    assert it.quarters["2024-03-31"][0] == 100
    assert it.quarters["2024-06-30"][0] == 150
    assert it.quarters["2024-09-30"][0] == 130
    assert it.quarters["2024-12-31"][0] == 120
    assert it.annual["2024-12-31"][0] == 500


def test_figures_are_only_used_after_they_were_filed():
    fin = Financials({"currency": "USD", "items": {"cfo": {"facts": [
        ["2024-01-01", "2024-12-31", 500, "2025-02-20", "10-K"],
        ["2025-01-01", "2025-12-31", 900, "2026-02-20", "10-K"],
    ]}}})
    assert fin.ttm("cfo", date(2025, 6, 1))[0] == 500
    assert fin.ttm("cfo", date(2026, 3, 1))[0] == 900
    assert fin.ttm("cfo", date(2025, 1, 1))[0] is None


def test_ttm_sums_four_quarters():
    fin = Financials(fixtures.company(seed=3))
    v, end = fin.ttm("revenue", date(2026, 9, 1))
    assert end == "2026-06-30"
    assert v > 0


def test_score_scales():
    assert scoring.vs_median(6, 10) == 100
    assert scoring.vs_median(10, 10) == 50
    assert scoring.vs_median(14, 10) == 0
    assert scoring.interp(3, [(1.5, 0), (2, 20), (4, 60), (8, 100)]) == 40
    assert scoring.band_for(72) == "Strong" and scoring.band_for(55) == "Fair"
    assert scoring.band_for(45) == "Weak" and scoring.band_for(30) == "Broken"


def test_decision_grid():
    assert scoring.action_for("Strong", "Buy zone", False, {}) == "Buy"
    assert scoring.action_for("Strong", "Stretched", False, {}) == "Trim"
    assert scoring.action_for("Weak", "Deep discount", False, {}) == "Avoid"
    assert scoring.action_for("Broken", "Fair", False, {}) == "Sell"
    assert scoring.action_for("Fair", None, True, {"below_ma200": True}) == "Buy small, 3% cap"


def test_ownership_skips_missing_pillars_but_needs_half_the_weight():
    w = {"value": 25, "strength": 20, "growth": 25, "policy": 10, "outside": 20}
    s, cov = scoring.ownership({"value": 80, "strength": 60, "growth": 70}, w)
    assert round(s, 2) == round((80 * 25 + 60 * 20 + 70 * 25) / 70, 2)
    s, cov = scoring.ownership({"policy": 50, "outside": 50}, w)
    assert s is None


def test_hard_fail_short_runway_forces_weak():
    fails = scoring.hard_fails({"runway": 0.5}, False, True, [])
    assert scoring.apply_fails(80, fails) <= 45


def test_event_decay_and_likelihood():
    ev = {"id": "x", "date": "2026-01-01", "review_date": "2026-06-30", "likelihood": "likely", "type": "Rule change",
          "title": "Test", "effects": [{"tickers": ["AAA"], "impact": 2}]}
    assert scoring.event_weight(ev, date(2026, 3, 1)) == 0.5
    assert scoring.event_weight(ev, date(2026, 8, 1)) == 0.25
    assert scoring.event_weight(ev, date(2026, 12, 1)) == 0.0
    score, why, effs = scoring.policy_pillar("AAA", "oil_gas", [ev], date(2026, 3, 1))
    assert score == 60


def test_engine_scores_universe_end_to_end():
    uni, fin_recs, price_recs, drv_recs = fixtures.small_data()
    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, drv_recs)
    events = [{"id": "e1", "date": "2026-11-04", "review_date": "2027-05-01", "likelihood": "happening",
               "type": "Government change", "title": "New governor", "effects": [{"subsectors": ["utilities"], "impact": -1}]}]
    asof = date(2026, 11, 18)
    res, peers = engine.score_universe(asof, uni, fins, prices, drivers, fixtures.small_weights(), events, {})
    assert set(res) == {s["ticker"] for s in uni["stocks"]}
    for t, r in res.items():
        assert r["band"] in {"Strong", "Fair", "Weak", "Broken", "Not enough data"}
        assert r["action"] in scoring.ACTION_RANK
    oil = res["OIL4"]
    assert oil["fair_value"] and oil["buy_zone"][0] < oil["buy_zone"][1]
    assert res["UTL0"]["pillars"]["policy"]["score"] < 50
    assert res["NEW0"]["fair_value"] is None
    data = output.build(asof, uni, res, prices, fins, drivers, events, {"prices": "test"})
    assert data["tracked"][0]["deal_upside_pct"] is not None
    assert len(data["stocks"]) == 13


def test_backtest_runs_and_reports_tests():
    uni, fin_recs, price_recs, drv_recs = fixtures.small_data()
    fins, prices, drivers = engine.load_inputs(uni, fin_recs, price_recs, drv_recs)
    bt = backtest.run(uni, fins, prices, drivers, fixtures.small_weights(), today=date(2026, 11, 18), log=lambda m: None)
    assert bt["dates"] >= 12
    assert bt["observations"] > 100
    assert {t["name"] for t in bt["tests"]} == {"Strong beats Weak", "Buying in the zone beats buying rich"}
