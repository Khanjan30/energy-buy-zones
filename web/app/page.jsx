import Dashboard from "@/components/Dashboard";
import Pending from "@/components/Pending";
import { getScores } from "@/lib/data";
import { date } from "@/lib/format";

export default function Home() {
  const data = getScores();
  if (!data) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Energy stocks, scored for long-term owners</h1>
            <p className="muted">Quality, price, policy and outside pressure, combined into one decision per stock.</p>
          </div>
        </div>
        <Pending />
      </>
    );
  }
  // The table does not need price history; leave it out so the page stays light.
  const rows = data.stocks.map(({ history, pillars, financials, fair_value_views, ...s }) => ({
    ...s,
    pillarScores: Object.fromEntries(Object.entries(pillars || {}).map(([k, v]) => [k, v.score])),
  }));
  const tracked = data.tracked.map(({ history, ...t }) => t);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Energy stocks, scored for long-term owners</h1>
          <p className="muted">
            {data.stocks.length} US-listed energy companies across {Object.keys(data.subsectors).length} groups. Each gets an
            Ownership score from five pillars, a fair value from its own filings, and one action from the decision grid.
            Data as of {date(data.asof)}.
          </p>
        </div>
      </div>
      <Dashboard rows={rows} tracked={tracked} drivers={data.drivers} subsectors={data.subsectors} missing={data.sources?.missing_keys || []} sample={data.sources?.sample} />
    </>
  );
}
