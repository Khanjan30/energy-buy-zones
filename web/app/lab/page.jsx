import Lab, { SkillBar } from "@/components/Lab";
import Pending from "@/components/Pending";
import Sparkline from "@/components/Sparkline";
import { getResearch } from "@/lib/data";
import { date, stamp } from "@/lib/format";

export const metadata = { title: "Strategy lab · Energy Buy Zones" };

const FAMILY_ORDER = [
  ["value", "Fundamentals: value"], ["strength", "Fundamentals: strength"], ["growth", "Fundamentals: growth"],
  ["technical", "Technicals"], ["politics", "Politics, laws, geopolitics and disasters"], ["macro", "Rates, oil and gas"], ["current", "Current formula"],
];
const MACRO_ORDER = ["gpr", "epu", "cpu", "reg_epa", "reg_ferc", "reg_nrc", "reg_doe", "reg_interior", "fema", "us10y"];

function signalVerdict(f) {
  const a = f.train?.skill, b = f.test?.skill;
  if (a == null || b == null) return ["Not enough data", "none"];
  if (a > 0.02 && b > 0.02) return ["Works in both periods", "buy"];
  if (b > 0.02) return ["Worked recently only", "hold"];
  if (a > 0.02) return ["Stopped working", "trim"];
  return ["No edge", "sell"];
}

export default function LabPage() {
  const data = getResearch();
  if (!data) return (<><div className="page-head"><h1>Strategy lab</h1></div><Pending what="strategy lab results" /></>);
  const best = [...data.strategies].sort((a, b) => (b.test?.skill ?? -9) - (a.test?.skill ?? -9))[0];
  const v1 = data.strategies.find((s) => s.id === "v1");
  const ok = (data.data_status || []).filter((s) => s.ok).length;
  const weights = Object.entries(data.learned_weights || {}).slice(0, 10);
  const fname = Object.fromEntries(data.factors.map((f) => [f.key, f.name]));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Strategy lab</h1>
          <p>
            Which formula would have picked the best energy stocks? Here {data.strategies.length} formulas compete. They are built from {data.factors.length} signals across fundamentals, technicals, politics, laws, geopolitics, disasters, interest rates and commodity prices. Each is tested the same way: score every stock each quarter using only what was known then, and see what happened next.
          </p>
        </div>
      </div>

      {data.sample && <div className="banner warn" style={{ marginBottom: 16 }}>Sample data for a local preview, not real results.</div>}

      <div className="pulse">
        <div><div className="pulse-k">Formulas tested</div><div className="pulse-v">{data.strategies.length}</div><div className="pulse-s">From {data.factors.length} signals in 6 families</div></div>
        <div><div className="pulse-k">History</div><div className="pulse-v" style={{ fontSize: 20, marginTop: 6 }}>{date(data.train_period?.[0])} to {date(data.test_period?.[1])}</div><div className="pulse-s">{data.dates} quarters, {data.observations.toLocaleString()} stock checks</div></div>
        <div><div className="pulse-k">Best on unseen years</div><div className="pulse-v" style={{ fontSize: 19, marginTop: 6 }}>{best?.name}</div><div className="pulse-s">Skill {best?.test?.skill?.toFixed(3)}, against {v1?.test?.skill?.toFixed(3)} for today&apos;s formula</div></div>
        <div><div className="pulse-k">Data sources loaded</div><div className="pulse-v">{ok} of {(data.data_status || []).length}</div><div className="pulse-s">Run {stamp(data.generated_at)}</div></div>
      </div>

      <div className="panel section">
        <div className="panel-head"><h2>How to read this</h2></div>
        <div className="cols-3">
          <div><h3>Skill</h3><p className="small muted" style={{ marginTop: 4 }}>How closely a formula&apos;s ranking matched what each stock actually did over the next 12 months. Zero is a coin flip. Around 0.05 is useful, and above 0.10 is strong; professional stock-picking models often live between 0.02 and 0.08. It is measured across all stocks and inside each sector, and the two are averaged.</p></div>
          <div><h3>Training and test years</h3><p className="small muted" style={{ marginTop: 4 }}>Quarters before {date(data.test_period?.[0])} are training years; the rest are test years. The learned formula picks its weights from training years only, so the test years show how it does on data it never saw. A formula that only shines in training was probably fitted to luck.</p></div>
          <div><h3>Top 10 portfolio</h3><p className="small muted" style={{ marginTop: 4 }}>Each quarter, buy the 10 best-scored stocks in equal amounts and hold for three months, then repeat. This is compared with owning all 56 equally. Price returns only, before trading costs and taxes.</p></div>
        </div>
      </div>

      <div className="section"><Lab data={data} /></div>

      <div className="panel flush section">
        <div className="panel-head" style={{ padding: "16px 18px 0" }}><h2>Which signals work on their own</h2><span className="small faint">Every signal tested alone, the same way</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Signal</th><th>What a high score means</th><th>Training years</th><th>Test years</th><th>Result</th></tr></thead>
            {FAMILY_ORDER.map(([fk, label]) => {
              const fs = data.factors.filter((f) => f.family === fk);
              if (!fs.length) return null;
              return (
                <tbody key={fk}>
                  <tr><td colSpan={5} style={{ background: "var(--surface-2)", fontWeight: 650, fontSize: 13 }}>{label}</td></tr>
                  {fs.map((f) => {
                    const [v, cls] = signalVerdict(f);
                    return (
                      <tr key={f.key}>
                        <td style={{ fontWeight: 600 }}>{f.name}</td>
                        <td className="small muted" style={{ maxWidth: 360 }}>{f.plain}</td>
                        <td><SkillBar v={f.train?.skill} /></td>
                        <td><SkillBar v={f.test?.skill} /></td>
                        <td><span className={`tag ${cls}`}><span className="dot" aria-hidden />{v}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>

      <div className="cols-2 section" style={{ alignItems: "start" }}>
        <div className="panel">
          <div className="panel-head"><h2>Politics, laws, geopolitics and disasters: the data</h2><span className="small faint">Latest month, with six years of history</span></div>
          <div className="macro-grid">
            {MACRO_ORDER.filter((k) => data.macro?.[k]).map((k) => {
              const m = data.macro[k];
              const chg = m.year_ago ? m.value / m.year_ago - 1 : null;
              return (
                <div key={k} className="macro-card">
                  <div className="small muted">{m.label}</div>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
                    <div>
                      <div className="driver-v">{k === "us10y" ? `${m.value.toFixed(2)}%` : Math.round(m.value).toLocaleString()}</div>
                      <div className="tiny faint">{m.last_month}{chg != null && k !== "us10y" ? `, ${chg >= 0 ? "+" : ""}${Math.round(chg * 100)}% on a year ago` : ""}</div>
                    </div>
                    <Sparkline values={m.history.map((h) => h[1])} width={120} height={34} color="var(--s1)" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h2>What the learned formula leans on</h2></div>
            {weights.length === 0 ? <p className="small muted">No signal had positive skill in the training years.</p> : (
              <ul className="mini-list">{weights.map(([k, w]) => <li key={k}><span>{fname[k] || k}</span><span className="num">{Math.round(w * 100)}%</span></li>)}</ul>
            )}
            <p className="small faint" style={{ marginTop: 8 }}>Weights come only from the training years. Signals that did not help then get zero.</p>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Data sources</h2></div>
            <ul className="mini-list">
              {(data.data_status || []).map((s) => (
                <li key={s.name}><span>{s.label}</span><span className={`small ${s.ok ? "up" : "down"}`}>{s.ok ? `${s.first} to ${s.last}` : s.using_cache ? "Using last good copy" : "Not loaded"}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="panel section">
        <div className="panel-head"><h2>Limits to keep in mind</h2></div>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {(data.notes || []).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
    </>
  );
}
