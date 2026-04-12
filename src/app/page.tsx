import HeroSection from "@/components/home/HeroSection";
import ParallaxDots from "@/components/home/ParallaxDots";

export default function HomePage() {
  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden">
      <ParallaxDots />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(25,30,50,0.5) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: "radial-gradient(ellipse 70% 65% at 50% 50%, transparent 60%, rgba(13,14,20,0.45) 100%)",
        }}
      />
      <HeroSection />
      <footer className="relative z-[2] mt-auto border-t border-fg-dim/20 px-8 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim sm:px-14 lg:px-20">
        {"// UWUVERSITY / NON-ACCREDITED / 2026"}
      </footer>
    </main>
  );
}
