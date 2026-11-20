import Dashboard from "@/components/Dashboard";
import Pending from "@/components/Pending";
import { getScores } from "@/lib/data";
import { date } from "@/lib/format";

export default function Home() {
  const data = getScores();
  const head = (
    <div className="page-head">
      <div>
        <h1>Which energy stocks are worth buying, and at what price?</h1>
        <p className="muted">
          {data
            ? `${data.stocks.length} US-listed energy stocks, checked every weekday for long-term investors. Prices as of ${date(data.asof)}.`
            : "US-listed energy stocks, checked every weekday for long-term investors."}
        </p>
      </div>
    </div>
  );
  if (!data) return <>{head}<Pending /></>;
  // The table does not need price history; leave it out so the page stays light.
  const rows = data.stocks.map(({ history, pillars, financials, fair_value_views, sec_check, ...s }) => s);
  const tracked = data.tracked.map(({ history, ...t }) => t);
  return (
    <>
      {head}
      <Dashboard rows={rows} tracked={tracked} drivers={data.drivers} subsectors={data.subsectors} sample={data.sources?.sample} />
    </>
  );
}
