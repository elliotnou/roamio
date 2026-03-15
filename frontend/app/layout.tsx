import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roamio — Your Agentic Wellness Travel Companion",
  description:
    "Roamio adapts your travel itinerary in real time based on how you feel. Check in, get energy-aware suggestions, and travel at your own pace.",
  keywords: ["travel", "wellness", "itinerary", "AI", "travel planner"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#FAF8F5] text-[#1A1A1A]">{children}</body>
    </html>
  );
}
