"""Company financials from the SEC's free XBRL "company facts" data. No key needed.

Raw company-facts files are large, so only the handful of line items the
formula uses are kept, each with its period and the date it was filed.
Keeping the filing date is what lets the backtest avoid using information
before it was public.
"""
import time
from datetime import datetime, timedelta

import requests

from .. import config

TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
REFRESH_DAYS = 7

# Line items and the tags that can carry them, in order of preference.
GAAP = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet",
                "RegulatedAndUnregulatedOperatingRevenue", "ElectricUtilityRevenue"],
    "net_income": ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic",
                   "NetIncomeLossAllocatedToLimitedPartners"],
    "operating_income": ["OperatingIncomeLoss"],
    "pretax_income": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
                      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
    "dna": ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
            "DepreciationAmortizationAndAccretionNet", "Depreciation"],
    "cfo": ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
              "PaymentsToAcquireOilAndGasPropertyAndEquipment", "PaymentsToAcquireOilAndGasProperty",
              "PaymentsForCapitalImprovements"],
    "interest": ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt", "InterestPaidNet"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue",
             "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"],
    "debt_total": ["LongTermDebt", "DebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"],
    "debt_noncurrent": ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
    "debt_current": ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    "short_debt": ["ShortTermBorrowings", "CommercialPaper"],
    "shares": ["WeightedAverageNumberOfDilutedSharesOutstanding",
               "WeightedAverageNumberOfSharesOutstandingBasic"],
}
IFRS = {
    "revenue": ["Revenue", "RevenueFromContractsWithCustomers"],
    "net_income": ["ProfitLoss", "ProfitLossAttributableToOwnersOfParent"],
    "operating_income": ["ProfitLossFromOperatingActivities"],
    "pretax_income": ["ProfitLossBeforeTax"],
    "dna": ["DepreciationAndAmortisationExpense", "DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss"],
    "cfo": ["CashFlowsFromUsedInOperatingActivities"],
    "capex": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfPropertyPlantAndEquipment"],
    "interest": ["FinanceCosts", "InterestExpense"],
    "cash": ["CashAndCashEquivalents"],
    "debt_total": ["Borrowings"],
    "debt_noncurrent": ["NoncurrentBorrowings", "LongtermBorrowings"],
    "debt_current": ["CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings", "CurrentBorrowings"],
    "short_debt": ["ShorttermBorrowings"],
    "shares": ["WeightedAverageNumberOfOrdinarySharesOutstandingDiluted", "WeightedAverageShares"],
}
SHARE_UNITS = ("shares",)
DEI_SHARES = "EntityCommonStockSharesOutstanding"
GOOD_FORMS = {"10-K", "10-Q", "20-F", "40-F", "10-K/A", "10-Q/A", "20-F/A", "40-F/A", "10-KT"}


def _headers():
    return {"User-Agent": config.sec_user_agent(), "Accept-Encoding": "gzip, deflate"}


def ticker_to_cik(log=print):
    path = config.FIN_CACHE / "_ticker_map.json"
    cached = config.load_json(path)
    if cached and cached.get("fetched") and \
            datetime.fromisoformat(cached["fetched"]) > datetime.utcnow() - timedelta(days=30):
        return cached["map"]
    try:
        r = requests.get(TICKER_MAP_URL, headers=_headers(), timeout=30)
        r.raise_for_status()
        m = {v["ticker"].upper(): int(v["cik_str"]) for v in r.json().values()}
        config.save_json(path, {"fetched": datetime.utcnow().isoformat(), "map": m}, compact=True)
        return m
    except (requests.RequestException, ValueError) as e:
        log(f"  SEC ticker map: {e}")
        return (cached or {}).get("map", {})


def _pick_series(tax_facts, tags, money=True):
    """Return (tag, unit, entries) for the first tag that has data."""
    for tag in tags:
        node = tax_facts.get(tag)
        if not node:
            continue
        units = node.get("units", {})
        if money:
            # Prefer USD; otherwise take the first currency and flag it.
            unit = "USD" if "USD" in units else next((u for u in units if "/" not in u and u not in SHARE_UNITS), None)
        else:
            unit = next((u for u in units if u in SHARE_UNITS), None)
        if not unit:
            continue
        entries = [e for e in units[unit] if e.get("form") in GOOD_FORMS and "val" in e and "end" in e and "filed" in e]
        if entries:
            return tag, unit, entries
    return None, None, []


def extract(facts_json):
    facts = facts_json.get("facts", {})
    gaap = facts.get("us-gaap", {})
    ifrs = facts.get("ifrs-full", {})
    taxonomy, tagmap = (gaap, GAAP) if len(gaap) >= len(ifrs) else (ifrs, IFRS)
    out = {"taxonomy": "us-gaap" if taxonomy is gaap else "ifrs-full", "items": {}, "currency": None}
    for item, tags in tagmap.items():
        tag, unit, entries = _pick_series(taxonomy, tags, money=(item != "shares"))
        if not entries:
            continue
        if item != "shares" and unit:
            out["currency"] = out["currency"] or unit
        out["items"][item] = {
            "tag": tag,
            "unit": unit,
            "facts": [[e.get("start"), e["end"], e["val"], e["filed"], e.get("form")] for e in entries],
        }
    if "shares" not in out["items"]:
        dei = facts.get("dei", {}).get(DEI_SHARES, {}).get("units", {}).get("shares", [])
        if dei:
            out["items"]["shares"] = {"tag": DEI_SHARES, "unit": "shares",
                                      "facts": [[None, e["end"], e["val"], e["filed"], e.get("form")] for e in dei
                                                if "val" in e and "filed" in e]}
    return out


def update(ticker, cik, log=print):
    path = config.FIN_CACHE / f"{ticker}.json"
    cached = config.load_json(path)
    if cached and cached.get("fetched") and \
            datetime.fromisoformat(cached["fetched"]) > datetime.utcnow() - timedelta(days=REFRESH_DAYS):
        return cached
    try:
        r = requests.get(FACTS_URL.format(cik=cik), headers=_headers(), timeout=60)
        if r.status_code == 404:
            log(f"  SEC {ticker}: no XBRL company facts")
            return cached
        r.raise_for_status()
        rec = extract(r.json())
        rec.update({"ticker": ticker, "cik": cik, "fetched": datetime.utcnow().isoformat()})
        config.save_json(path, rec, compact=True)
        return rec
    except (requests.RequestException, ValueError) as e:
        log(f"  SEC {ticker}: {e}")
        return cached


def update_all(tickers, log=print):
    cik_map = ticker_to_cik(log)
    out = {}
    for t in tickers:
        cik = cik_map.get(t.upper())
        if not cik:
            log(f"  SEC {t}: ticker not found in the SEC list")
            out[t] = config.load_json(config.FIN_CACHE / f"{t}.json")
            continue
        out[t] = update(t, cik, log)
        time.sleep(0.15)  # well under the SEC's 10 requests a second
    return out
