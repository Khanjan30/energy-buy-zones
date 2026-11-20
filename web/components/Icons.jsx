// Small line icons, drawn on a 20px grid with a 1.6 stroke.
const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 20 20", "aria-hidden": true };

export const Icon = {
  bolt: <svg {...p} width="15" height="15"><path d="M11 2 4.5 11H10l-1 7 6.5-9H10l1-7Z" fill="currentColor" stroke="none" /></svg>,
  overview: <svg {...p}><rect x="2.5" y="2.5" width="6.5" height="8" rx="1" /><rect x="11" y="2.5" width="6.5" height="4.5" rx="1" /><rect x="11" y="9" width="6.5" height="8.5" rx="1" /><rect x="2.5" y="12.5" width="6.5" height="5" rx="1" /></svg>,
  screener: <svg {...p}><path d="M3 4h14M5.5 10h9M8 16h4" /></svg>,
  compare: <svg {...p}><path d="M3 15.5 7.5 9l3.5 3.5L17 5" /><path d="M3 11.5 7.5 13l3.5-6 6 2.5" opacity=".55" /></svg>,
  portfolio: <svg {...p}><rect x="2.5" y="6" width="15" height="10.5" rx="1.5" /><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6M2.5 10.5h15" /></svg>,
  watch: <svg {...p}><path d="m10 2.8 2.2 4.5 4.9.7-3.5 3.5.8 4.9-4.4-2.3-4.4 2.3.8-4.9L2.9 8l4.9-.7L10 2.8Z" /></svg>,
  events: <svg {...p}><path d="M10 2.5 18 16.5H2L10 2.5Z" /><path d="M10 8v4M10 14.2v.1" /></svg>,
  backtest: <svg {...p}><path d="M3 3v14h14" /><path d="M6 13l3-4 3 2 4-6" /></svg>,
  method: <svg {...p}><circle cx="10" cy="10" r="7.5" /><path d="M8 7.8a2.2 2.2 0 1 1 3 2c-.6.3-1 .8-1 1.5v.4M10 14.3v.1" /></svg>,
  search: <svg {...p} width="16" height="16"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>,
  plus: <svg {...p} width="16" height="16"><path d="M10 4v12M4 10h12" /></svg>,
  download: <svg {...p} width="16" height="16"><path d="M10 3v10M6 9l4 4 4-4M4 16.5h12" /></svg>,
};
