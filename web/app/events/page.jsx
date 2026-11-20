import EventsList from "@/components/EventsList";
import Pending from "@/components/Pending";
import { getScores, REPO } from "@/lib/data";

export const metadata = { title: "Events · Energy Buy Zones" };

export default function EventsPage() {
  const data = getScores();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Event log</h1>
          <p className="muted">
            Government decisions, rule changes, new governments, trade moves, interest rates, conflicts, cyber attacks and
            natural disasters. Each event scores from −2 to +2 for the stocks it touches, weighted by how likely it is, and fades
            after its review date.
          </p>
        </div>
        <a className="btn" style={{ display: "inline-flex", alignItems: "center" }} href={`https://github.com/${REPO}/edit/main/data/events.json`}>
          Edit events on GitHub
        </a>
      </div>
      {data ? <EventsList events={data.events || []} /> : <Pending what="events" />}
    </>
  );
}
