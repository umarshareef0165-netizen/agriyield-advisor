import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriYield Advisor — اردو میں کسان کا AI مشیر",
  description:
    "An Urdu-first AI data agent for Pakistan's smallholder farmers: live weather, soil, market prices, yield forecasts and a sowing/irrigation plan — every number cited. DATANOVA 2026 Global Data-thon, AI/ML track.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ur" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
