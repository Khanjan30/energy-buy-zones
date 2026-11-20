import "@fontsource-variable/archivo/standard.css";
import "./globals.css";
import Shell from "@/components/Shell";
import { getScores } from "@/lib/data";
import { date } from "@/lib/format";

export const metadata = {
  title: "Energy Buy Zones",
  description: "Research for long-term energy investors: a quality score, a good price to buy, and one clear suggestion for 56 US-listed energy stocks, refreshed every weekday.",
};

// Runs before paint: a saved choice wins, otherwise follow the system setting.
const themeScript = `try{var t=localStorage.getItem('theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.setAttribute('data-theme',t||'light')}catch(e){}`;

export default function RootLayout({ children }) {
  const data = getScores();
  const stocks = (data?.stocks || []).map((s) => ({ ticker: s.ticker, name: s.name, price: s.tech?.price }));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Shell stocks={stocks} asof={data ? date(data.asof) : null}>
          {children}
          <footer className="footer">
            <span>Prices from {data?.sources?.prices || "Twelve Data"}, company filings from SEC EDGAR, oil and gas prices from the EIA (Energy Information Administration).</span>
            <span>A research tool, not financial advice.</span>
          </footer>
        </Shell>
      </body>
    </html>
  );
}
