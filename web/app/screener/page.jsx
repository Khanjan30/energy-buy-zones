import Pending from "@/components/Pending";
import Screener from "@/components/Screener";
import { getScores, slim } from "@/lib/data";

export const metadata = { title: "Screener · Energy Buy Zones" };

export default function ScreenerPage() {
  const data = getScores();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stock screener</h1>
          <p>Filter all {data?.stocks?.length || 56} energy stocks by quality, price, trend and momentum. Start from a ready-made screen or build your own, then download the list.</p>
        </div>
      </div>
      {data ? <Screener rows={data.stocks.map(slim)} subsectors={data.subsectors} asof={data.asof} /> : <Pending />}
    </>
  );
}
