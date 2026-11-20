import { money } from "@/lib/format";

// A horizontal price scale: where today's price sits against the buying ranges and fair value.
export default function PriceLadder({ price, zone, fair, addMore, techZone }) {
  if (price == null) return null;
  const pts = [price, zone?.[0], zone?.[1], fair, addMore, techZone?.[0], techZone?.[1], fair ? fair * 1.3 : null].filter((v) => v != null);
  const lo = Math.min(...pts) * 0.92;
  const hi = Math.max(...pts) * 1.05;
  const x = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="ladder">
      <div className="ladder-track">
        {zone && <div className="ladder-band num-zone" style={{ left: `${x(zone[0])}%`, width: `${x(zone[1]) - x(zone[0])}%` }} />}
        {fair && <div className="ladder-band rich" style={{ left: `${x(fair * 1.1)}%`, width: `${x(Math.min(hi, fair * 1.3)) - x(fair * 1.1)}%` }} />}
        {fair && <div className="ladder-tick" style={{ left: `${x(fair)}%` }}><span>Fair value<br />{money(fair, 0)}</span></div>}
        {techZone && <div className="ladder-band chart-zone" style={{ left: `${x(techZone[0])}%`, width: `${x(techZone[1]) - x(techZone[0])}%` }} />}
        <div className="ladder-price" style={{ left: `${x(price)}%` }}><span>Today<br />{money(price)}</span></div>
      </div>
      <div className="legend">
        {zone && <span><i className="swatch" style={{ background: "var(--zone-strong)" }} /> Good buying range from the company&apos;s numbers: {money(zone[0])} to {money(zone[1])}</span>}
        {techZone && <span><i className="swatch chart-swatch" /> Good buying range from the chart: {money(techZone[0])} to {money(techZone[1])}</span>}
        {fair && <span><i className="swatch" style={{ background: "var(--rich)" }} /> Expensive: 10% to 30% above fair value</span>}
        {addMore && <span className="faint">Add more if it falls below {money(addMore)}</span>}
      </div>
    </div>
  );
}
