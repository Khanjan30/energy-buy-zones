import Pending from "@/components/Pending";
import Watchlist from "@/components/Watchlist";
import { getScores, slim } from "@/lib/data";

export const metadata = { title: "Watchlist · Energy Buy Zones" };

export default function WatchlistPage() {
  const data = getScores();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Watchlist</h1>
          <p>Stocks you are waiting on. Each row shows how far today&apos;s price is from a good price to buy.</p>
        </div>
      </div>
      {data ? <Watchlist stocks={data.stocks.map(slim)} /> : <Pending />}
    </>
  );
}
