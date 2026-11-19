import "./globals.css";
import Nav from "@/components/Nav";
import { getScores } from "@/lib/data";
import { date } from "@/lib/format";

export const metadata = {
  title: "Energy Buy Zones",
  description: "A long-term scoring model for US-listed energy stocks: quality, price, policy and outside pressure, refreshed every weekday from free public data.",
};

// Runs before paint so a saved theme choice never flashes.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  const data = getScores();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Nav />
        <main className="shell">
          {children}
          <footer className="footer">
            <span>
              {data ? `Data as of ${date(data.asof)} · built ${date(data.generated_at)}` : "Waiting for the first data run"}
              {" · "}Prices: {data?.sources?.prices || "Twelve Data or Stooq"} · Filings: SEC EDGAR · Drivers: EIA, FRED
            </span>
            <span>A research model, not financial advice.</span>
          </footer>
        </main>
      </body>
    </html>
  );
}
