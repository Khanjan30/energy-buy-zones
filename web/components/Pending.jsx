import { REPO } from "@/lib/data";

export default function Pending({ what = "scores" }) {
  return (
    <div className="card stack" style={{ marginTop: 24 }}>
      <h2>Waiting for the first data run</h2>
      <p className="muted">
        The {what} appear here after the nightly GitHub Actions job runs once. It pulls prices, SEC filings and market drivers,
        scores every stock, commits the results, and Vercel rebuilds this site.
      </p>
      <p className="muted">
        To start it now, open{" "}
        <a href={`https://github.com/${REPO}/actions/workflows/update-data.yml`}>the Update data workflow</a> and choose
        Run workflow.
      </p>
    </div>
  );
}
