import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import IntroGate from "@/components/intro/IntroGate";
import TopStrip from "@/components/chrome/TopStrip";
import SideMenuToggle from "@/components/chrome/SideMenuToggle";
import SideMenu from "@/components/chrome/SideMenu";
import CustomCursor from "@/components/chrome/CustomCursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full bg-bg-deep text-fg">
        <CustomCursor />
        <IntroGate />
        <SideMenuToggle />
        <SideMenu />
        <TopStrip />
        {children}
      </body>
    </html>
  );
}
