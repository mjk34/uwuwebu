import HeroSection from "@/components/home/HeroSection";
import GameDemoCarousel from "@/components/home/GameDemoCarousel";
import ParallaxDots from "@/components/home/ParallaxDots";
import { mockGameDemos } from "@/lib/mock";

export default function HomePage() {
  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden">
      <ParallaxDots />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 50%, transparent 50%, var(--bg-deep) 100%)",
        }}
      />
      <HeroSection />
      <GameDemoCarousel demos={mockGameDemos} />
      <footer className="relative z-[2] mt-auto border-t border-fg-dim/20 px-8 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim sm:px-14 lg:px-20">
        {"// UWUVERSITY / NON-ACCREDITED / 2026"}
      </footer>
    </main>
  );
}
