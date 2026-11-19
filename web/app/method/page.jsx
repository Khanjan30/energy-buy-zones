export const metadata = { title: "Method · Energy Buy Zones" };

export default function Method() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>How the score works</h1>
          <p className="muted">Version 1 of the formula. Built for owners who hold for years, not traders.</p>
        </div>
      </div>
      <div className="card prose">
        <h2 style={{ marginTop: 0 }}>Two questions, asked separately</h2>
        <p>First: is this a business worth owning? That is the Ownership score, from 0 to 100. Second: is today&apos;s price a good one? That is the price position against fair value. The decision grid combines the two into one action.</p>

        <h2>The five pillars</h2>
        <ul>
          <li><strong>Value.</strong> Price to earnings against the stock&apos;s own five-year median, value to cash earnings against peers, and free cash flow yield ranked against peers.</li>
          <li><strong>Strength.</strong> Debt against cash earnings, how easily interest is covered, and how many of the last five years produced free cash. Early-stage companies are judged on years of cash left instead.</li>
          <li><strong>Growth.</strong> Three-year growth in revenue and earnings per share, plus how the business tends to move with its main driver (oil, gas, rates or uranium) and where that driver is heading.</li>
          <li><strong>Policy.</strong> Government decisions, rule changes, new governments, trade moves and interest rates, from the event log.</li>
          <li><strong>Outside pressure.</strong> Standing exposure to storms, wildfire and single-country supply chains, plus live events such as conflicts, cyber attacks and natural disasters.</li>
        </ul>
        <p>Weights change by group. Utilities lean on Policy; oil producers lean on Value and Growth; early-stage companies lean on Strength.</p>
        <table>
          <thead><tr><th>Band</th><th>Score</th></tr></thead>
          <tbody>
            <tr><td>Strong</td><td>70 and above</td></tr>
            <tr><td>Fair</td><td>50 to 69</td></tr>
            <tr><td>Weak</td><td>40 to 49</td></tr>
            <tr><td>Broken</td><td>below 40</td></tr>
          </tbody>
        </table>

        <h2>Hard fails</h2>
        <ul>
          <li>Less than one year of cash left caps the score at 45.</li>
          <li>Debt above 6 times cash earnings (8 times for regulated utilities and pipelines) caps the score at 69.</li>
          <li>A −2 event that is already happening and hits the core business caps the score at 69.</li>
          <li>A pending takeover pauses scoring; the stock moves to the tracked list.</li>
        </ul>

        <h2>Fair value and the buy zone</h2>
        <p>Fair value is the average of two views: earnings per share times the stock&apos;s own five-year median P/E (price to earnings), and free cash flow per share divided by the group&apos;s median free cash flow yield. The buy zone is 75% to 90% of fair value. Buy in thirds: one third in the zone, one third if it drops another 10%, one third after the next earnings report confirms the story.</p>
        <table>
          <thead><tr><th>Price as a share of fair value</th><th>Position</th></tr></thead>
          <tbody>
            <tr><td>Under 75%</td><td>Deep discount</td></tr>
            <tr><td>75% to 90%</td><td>Buy zone</td></tr>
            <tr><td>90% to 110%</td><td>Fair</td></tr>
            <tr><td>110% to 130%</td><td>Full</td></tr>
            <tr><td>Over 130%</td><td>Stretched</td></tr>
          </tbody>
        </table>

        <h2>The decision grid</h2>
        <table>
          <thead><tr><th></th><th>Deep discount</th><th>Buy zone</th><th>Fair</th><th>Full</th><th>Stretched</th></tr></thead>
          <tbody>
            <tr><td>Strong</td><td>Buy, check the news</td><td>Buy</td><td>Hold</td><td>Hold</td><td>Trim</td></tr>
            <tr><td>Fair</td><td>Buy small</td><td>Buy small</td><td>Hold</td><td>Hold</td><td>Trim</td></tr>
            <tr><td>Weak</td><td>Avoid</td><td>Avoid</td><td>Hold if owned, review</td><td>Trim</td><td>Sell</td></tr>
            <tr><td>Broken</td><td>Sell</td><td>Sell</td><td>Sell</td><td>Sell</td><td>Sell</td></tr>
          </tbody>
        </table>
        <p>Early-stage companies have no fair value. If they score Fair or better and trade under their 200-day average, the action is Buy small with a 3% portfolio cap; otherwise Watch.</p>

        <h2>Events</h2>
        <p>Each event scores −2 to +2 per stock and is weighted by likelihood: happening counts fully, likely counts half, early signals count a quarter. After its review date an event counts half for 90 days, then drops out. Policy starts at 50 and moves 10 points per full-weight step. Outside pressure starts at 50, loses 5 points per level of standing exposure, and moves 10 points per full-weight event step.</p>

        <h2>Data, all free</h2>
        <ul>
          <li>Prices: Twelve Data, with Stooq as a fallback.</li>
          <li>Financials: SEC EDGAR company facts, used only from the date each filing became public.</li>
          <li>Drivers: Brent crude and Henry Hub gas from the EIA (Energy Information Administration), the 10-year Treasury yield from FRED (Federal Reserve Economic Data), uranium entered by hand monthly.</li>
        </ul>
        <p>A research model, not financial advice. It will be wrong, sometimes badly. Check the reasons behind every score before acting on it.</p>
      </div>
    </>
  );
}
