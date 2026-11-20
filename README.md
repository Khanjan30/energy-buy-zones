# Energy Buy Zones

A long-term scoring model for US-listed energy stocks. Every weekday it pulls prices, company filings and market drivers from free public sources, scores about 55 companies, and publishes the results as a static website.

Each stock gets two answers, kept separate on purpose:

1. **Is this a business worth owning?** An Ownership score from 0 to 100, built from five pillars: Value, Strength, Growth, Policy and Outside pressure.
2. **Is today's price a good one?** Price against a fair value worked out from the company's own filings, with a buy zone at 75% to 90% of fair value.

A decision grid turns the two into one action: Buy, Buy small, Hold, Trim, Avoid or Sell.

> A research project and portfolio piece. Not financial advice.

## Features

- **Market overview.** A map of every stock grouped by sector and sized by company value, colored by today's move, price against its good buying range, or quality. Also a feed of suggestions that changed since the last run, the day's biggest moves, the best ideas, the latest events, and oil, gas, rates and uranium prices.
- **Screener.** Six ready-made screens (for example "Good business, good price" and "Strong but oversold") plus filters for sector, suggestion, price against range, trend, momentum and quality. Sort any column and download the list as CSV.
- **Stock pages.** A plain-language answer, a price scale, two buying ranges (from the company's numbers and from the chart), a price chart with 50-day and 200-day averages, technical analysis, the shape of the quality score, five years of score history, peers, and the events that touch the company.
- **Portfolio.** Add or paste your holdings to see value, gain, today's move, average quality, sector split, concentration warnings, and what the model would trim, sell or add to.
- **Watchlist.** Star stocks and track how far each is from a good price to buy.
- **Compare.** Up to four stocks side by side, with a one-year chart starting each at 100 and their quality shapes overlaid.
- **Quick search.** Press Cmd K or Ctrl K anywhere.

Watchlist and portfolio are saved in your browser only. There are no accounts yet.

## What makes it different

- **Energy-specific.** Weights change by group (oil producers, pipelines, utilities, power, nuclear fuel, grid equipment, solar and storage, early-stage). Each group is tied to its main driver: Brent crude, Henry Hub gas, the 10-year Treasury yield or uranium.
- **An event log for the real world.** Government decisions, rule changes, new governments, trade moves, interest rates, conflicts, cyber attacks and natural disasters. One event can touch many stocks. Each scores from −2 to +2, is weighted by how likely it is, and fades after a review date. See [`data/events.json`](data/events.json).
- **Honest backtest.** Five years, scored quarterly, using only filings that were public on each test date. It reports when the formula fails, not just when it works.
- **Every score explains itself.** Each pillar shows its inputs and a plain-English reason.

## How it runs

```
GitHub Actions (weekdays, 22:37 UTC)
  └─ python -m pipeline.run
       ├─ prices      Twelve Data (Stooq fallback)
       ├─ filings     SEC EDGAR company facts
       ├─ drivers     EIA (Energy Information Administration), FRED (Federal Reserve Economic Data)
       └─ writes      web/data/scores.json, web/data/backtest.json
  └─ commits web/data  →  Vercel rebuilds the static Next.js site
```

## Setup

1. Add repository secrets under **Settings → Secrets and variables → Actions**:
   - `TWELVE_DATA_API_KEY` (free at twelvedata.com)
   - `EIA_API_KEY` (free at eia.gov/opendata)
   - `FRED_API_KEY` (free at fred.stlouisfed.org)
2. Add a repository variable `SEC_CONTACT_EMAIL`. The SEC asks automated users to identify themselves.
3. Run the **Update data** workflow once from the Actions tab. The first run downloads full histories and takes longer.
4. Import the repo into Vercel with **Root Directory** set to `web`.

Missing keys are handled: the matching inputs are skipped and the remaining pillar weights are scaled up.

## Local development

```bash
pip install -r requirements.txt
python -m pytest -q pipeline/tests          # unit and end-to-end tests on synthetic data
python -m pipeline.preview /tmp/preview      # made-up sample data for a UI preview
cd web && npm install && DATA_DIR=/tmp/preview npm run dev
```

## Editing the model

| File | What it controls |
|---|---|
| `config/universe.json` | Stocks, groups, drivers, tracked names (deals pending, benchmarks) |
| `config/weights.json` | Pillar weights per group |
| `config/exposure.json` | Standing storm, wildfire and supply-chain exposure per stock |
| `config/uranium.json` | Monthly uranium price, entered by hand |
| `data/events.json` | The event log |

## Known limits of version 1

- Price returns only in the backtest; dividends are left out.
- Companies that report in a foreign currency skip the valuation inputs that compare price with earnings.
- The stock list was chosen in 2026, so the backtest has survivorship bias.
- Policy and Outside pressure cannot be backtested, because the event log is kept by hand.
