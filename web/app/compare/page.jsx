import Compare from "@/components/Compare";
import Pending from "@/components/Pending";
import { getScores, slim } from "@/lib/data";

export const metadata = { title: "Compare · Energy Buy Zones" };

export default function ComparePage() {
  const data = getScores();
  // One year of weekly closes per stock is enough for the comparison chart.
  const histories = Object.fromEntries((data?.stocks || []).map((s) => [s.ticker, (s.history || []).slice(-53).map((r) => [r[0], r[1]])]));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compare stocks</h1>
          <p>Put up to four energy stocks side by side: price moves, the shape of their quality score, and the numbers that matter for a buy decision.</p>
        </div>
      </div>
      {data ? <Compare stocks={data.stocks.map(slim)} histories={histories} /> : <Pending />}
    </>
  );
}
