import Link from "next/link";
import ActionTag from "@/components/ActionTag";
import Heatmap from "@/components/Heatmap";
import Freshness from "@/components/Freshness";
import NewsFeed from "@/components/NewsFeed";
import MiniRange from "@/components/MiniRange";
import Pending from "@/components/Pending";
import Sparkline from "@/components/Sparkline";
import { getNews, getScores, getSignals, slim } from "@/lib/data";
import { ACTION_GROUP, date, money, num, pct } from "@/lib/format";
import { goodRange } from "@/lib/plain";

function signalChanges(sig, stocks) {
  const days = Object.keys(sig?.days || {}).sort();
  if (days.length < 2) return { since: null, items: [] };
  const [prev, now] = [sig.days[days[days.length - 2]], sig.days[days[days.length - 1]]];
  const names = Object.fromEntries(stocks.map((s) => [s.ticker, s.name]));
  const items = [];
  for (const [t, [score, action]] of Object.entries(now)) {
    const was = prev[t];
    if (!was) continue;
    if (was[1] !== action) items.push({ ticker: t, name: names[t], from: was[1], to: action, score, delta: score != null && was[0] != null ? score - was[0] : null });
  }
  const rank = (a) => ({ buy: 0, sell: 1, trim: 2, hold: 3 })[ACTION_GROUP[a]] ?? 4;
  items.sort((a, b) => rank(a.to) - rank(b.to));
  return { since: days[days.length - 2], items };
}

export default function Overview() {
  const data = getScores();
  if (!data) return (<><div className="page-head"><h1>Energy market overview</h1></div><Pending /></>);
  const stocks = data.stocks.filter((s) => s.tech).map(slim);
  const ch = stocks.map((s) => s.tech?.change_pct).filter((v) => v != null);
  const avg = ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : null;
  const up = ch.filter((v) => v > 0).length;
  const counts = { buy: 0, hold: 0, trim: 0, sell: 0 };
  stocks.forEach((s) => { const g = ACTION_GROUP[s.action]; if (g in counts) counts[g]++; });
  const groups = Object.entries(data.subsectors).map(([k, label]) => {
    const g = stocks.filter((s) => s.subsector === k && s.tech?.change_pct != null);
    return { k, label, avg: g.length ? g.reduce((a, b) => a + b.tech.change_pct, 0) / g.length : null };
  }).filter((g) => g.avg != null).sort((a, b) => b.avg - a.avg);
  const movers = [...stocks].filter((s) => s.tech?.change_pct != null).sort((a, b) => b.tech.change_pct - a.tech.change_pct);
  const gainers = movers.slice(0, 5), losers = movers.slice(-5).reverse();
  const ideas = stocks.filter((s) => ACTION_GROUP[s.action] === "buy" && goodRange(s)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 4);
  const sig = signalChanges(getSignals(), stocks);
  const events = (data.events || []).slice(0, 4);
  const news = getNews();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Energy market overview</h1>
          <p>Where energy stocks stand today for a long-term buyer: what moved, what changed, and which names look worth buying at today&apos;s price. Prices from the {date(data.asof)} close.</p>
        </div>
        <Freshness updated={data.generated_at} variant="badge" />
      </div>

      <div className="pulse">
        <div>
          <div className="pulse-k">Energy stocks today</div>
          <div className={`pulse-v ${avg >= 0 ? "up" : "down"}`}>{avg != null ? pct(avg / 100, 2, true) : "n/a"}</div>
          <div className="pulse-s">Average move; {up} of {ch.length} rose</div>
        </div>
        <div>
          <div className="pulse-k">Strongest sector</div>
          <div className="pulse-v" style={{ fontSize: 19, marginTop: 6 }}>{groups[0]?.label}</div>
          <div className="pulse-s">{groups[0] && pct(groups[0].avg / 100, 2, true)} today, weakest: {groups[groups.length - 1]?.label} {groups.length && pct(groups[groups.length - 1].avg / 100, 2, true)}</div>
        </div>
        <div>
          <div className="pulse-k">Buy signals</div>
          <div className="pulse-v">{counts.buy}</div>
          <div className="pulse-s">Out of {stocks.length} stocks; {counts.trim + counts.sell} say trim, sell or avoid</div>
        </div>
        <div>
          <div className="pulse-k">Brent crude oil</div>
          <div className="pulse-v">{data.drivers?.brent?.latest != null ? money(data.drivers.brent.latest) : "n/a"}</div>
          <div className="pulse-s">Henry Hub gas {data.drivers?.henry_hub?.latest != null ? money(data.drivers.henry_hub.latest) : "n/a"}</div>
        </div>
      </div>

      <div className="panel section">
        <Heatmap stocks={stocks} groups={data.subsectors} />
      </div>

      <div className="cols-2 section" style={{ alignItems: "start" }}>
        <div className="panel">
          <div className="panel-head"><h2>Energy news</h2><span className="small faint">Latest headlines by topic</span></div>
          <NewsFeed topics={news?.topics} tickers={stocks.map((x) => x.ticker)} fetched={news?.fetched} />
        </div>
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2>What changed</h2>
              <span className="small faint">{sig.since ? `Suggestions that changed since ${date(sig.since)}` : "Updated after every weekday run"}</span>
            </div>
            {!sig.since && <p className="muted small">This feed starts with the next weekday run. It will list every stock whose suggestion changes, such as a move from Hold to Buy, so you can see what is new at a glance.</p>}
            {sig.since && sig.items.length === 0 && <p className="muted small">No suggestions changed in the last run. Every stock kept its call.</p>}
            {sig.items.map((it) => (
              <div className="feed-item" key={it.ticker}>
                <Link href={`/stock/${it.ticker}/`} className="ticker">{it.ticker}</Link>
                <div>
                  <div className="small muted">{it.name}</div>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}><ActionTag action={it.from} /><span className="arrow" aria-label="changed to">to</span><ActionTag action={it.to} /></div>
                </div>
                <span className="small faint num">{it.delta != null && Math.abs(it.delta) >= 0.5 ? `Quality ${it.delta > 0 ? "+" : ""}${it.delta.toFixed(1)}` : ""}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Biggest moves today</h2><Link className="small" href="/screener/">Open the screener</Link></div>
            <div className="cols-even" style={{ gap: 20 }}>
              {[["Up", gainers], ["Down", losers]].map(([label, list]) => (
                <div key={label}>
                  <div className="small muted" style={{ marginBottom: 4 }}>{label}</div>
                  {list.map((s) => (
                    <Link key={s.ticker} href={`/stock/${s.ticker}/`} className="mover" style={{ color: "inherit", textDecoration: "none", gridTemplateColumns: "50px minmax(0, 1fr) 56px" }}>
                      <span className="ticker">{s.ticker}</span>
                      <Sparkline values={s.spark} width={56} height={22} />
                      <span className={`r num ${s.tech.change_pct >= 0 ? "up" : "down"}`}>{pct(s.tech.change_pct / 100, 1, true)}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {ideas.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Best ideas right now</h2><Link className="small" href="/screener/?preset=quality-discount">See all buy signals</Link></div>
          <div className="ideas">
            {ideas.map((s) => {
              const r = goodRange(s);
              return (
                <Link key={s.ticker} href={`/stock/${s.ticker}/`} className="idea">
                  <div className="idea-top"><span className="ticker">{s.ticker}</span><span className="num">{money(s.tech?.price)}</span></div>
                  <div className="name" style={{ maxWidth: "none" }}>{s.name}</div>
                  <MiniRange price={s.tech?.price} range={r} />
                  <span className="small muted num">Good price {money(r.low, 0)} to {money(r.high, 0)}</span>
                  <div className="idea-foot"><ActionTag action={s.action} /><span className="small faint">Quality {num(s.score, 0)}</span></div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="cols-2 section">
        <div className="panel">
          <div className="panel-head"><h2>Latest events</h2><Link className="small" href="/events/">Full event log</Link></div>
          {events.map((e) => (
            <div className="event" key={e.id}>
              <div className="event-meta"><span className="pill">{e.type}</span><span>{date(e.date)}</span></div>
              <h3 style={{ marginTop: 6 }}>{e.title}</h3>
              <p className="small muted" style={{ marginTop: 3 }}>
                Affects {e.effects.flatMap((x) => [...(x.tickers || []), ...(x.subsectors || []).map((k) => data.subsectors[k] || k)]).slice(0, 6).join(", ")}
              </p>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Market drivers</h2><span className="small faint">The prices that move whole sectors</span></div>
          <div className="stack" style={{ gap: 14 }}>
            {["brent", "henry_hub", "us10y", "uranium"].map((k) => {
              const d = data.drivers?.[k];
              if (!d || d.latest == null) return (
                <div key={k} className="driver-card"><div><div className="small muted">{({ us10y: "10-year Treasury yield", uranium: "Uranium price" })[k] || k}</div><div className="small faint">{k === "us10y" ? "Needs the free FRED key in GitHub settings" : "Not available yet"}</div></div></div>
              );
              const series = (d.history || []).slice(-52).map((r) => r[1]);
              return (
                <div key={k} className="driver-card">
                  <div>
                    <div className="small muted">{d.label}</div>
                    <div className="driver-v">{d.is_rate ? `${d.latest.toFixed(2)}%` : money(d.latest)}</div>
                    {d.change_6m != null && <div className="small faint">{d.change_6m > 0 ? "+" : ""}{d.change_6m.toFixed(2)} over 6 months</div>}
                  </div>
                  <Sparkline values={series} width={150} height={40} color="var(--s1)" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
