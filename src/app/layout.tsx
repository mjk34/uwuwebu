import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import IntroGate from "@/components/intro/IntroGate";
import TopStrip from "@/components/chrome/TopStrip";
import SideMenuToggle from "@/components/chrome/SideMenuToggle";
import SideMenu from "@/components/chrome/SideMenu";
import CustomCursor from "@/components/chrome/CustomCursor";
import BgMusic from "@/components/home/BgMusic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// World dashboard + NewsDetailModal typography. Loaded once at the root so
// every route that needs JetBrains Mono resolves via the CSS var without a
// render-blocking @import.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "UwUversity",
  description:
    "UwUversity — non-accredited companion terminal for the professor-rs uplink. Leveled Education & Achievement Ranking Network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-screen flex-col bg-bg-deep text-fg">
        <CustomCursor />
        <IntroGate />
        <BgMusic />
        <SideMenuToggle />
        <SideMenu />
        <TopStrip />
        {children}
        <footer className="relative z-[50] mt-auto border-t border-fg-dim/20 bg-bg-deep px-4 py-2 font-mono text-[8px] uppercase tracking-[0.15em] text-fg-dim sm:px-14 sm:py-3 sm:text-[10px] sm:tracking-[0.3em] lg:px-20">
          {"// UWUVERSITY / 2026"}
        </footer>
      </body>
    </html>
  );
}
