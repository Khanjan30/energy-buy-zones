import Pending from "@/components/Pending";
import Portfolio from "@/components/Portfolio";
import { getScores, slim } from "@/lib/data";

export const metadata = { title: "Portfolio · Energy Buy Zones" };

export default function PortfolioPage() {
  const data = getScores();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your portfolio</h1>
          <p>See your energy holdings the way the model sees them: what they are worth, how much you have made, and which ones it would trim, sell or add to.</p>
        </div>
      </div>
      {data ? <Portfolio stocks={[...data.stocks.map(slim), ...(data.tracked || []).map((t) => ({ ...slim(t), tracked: true, note: t.note, status: t.status }))]} subsectors={data.subsectors} /> : <Pending />}
    </>
  );
}
