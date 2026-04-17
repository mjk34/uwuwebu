import type { Metadata } from "next";
import DailyBriefingDashboard from "@/components/world/DailyBriefingDashboard";

export const metadata: Metadata = {
  title: "UwU - News",
  description: "News dashboard — uplink feeds, bulletins, and ops channel.",
};

export default function WorldPage() {
  return (
    <main className="fixed inset-0 z-0 overflow-hidden">
      <DailyBriefingDashboard />
    </main>
  );
}
