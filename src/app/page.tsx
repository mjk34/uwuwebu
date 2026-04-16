import BgMusic from "@/components/home/BgMusic";
import HeroSection from "@/components/home/HeroSection";
import ParallaxDots from "@/components/home/ParallaxDots";
import UwuGlobe from "@/components/home/UwuGlobe";

export default function HomePage() {
  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden">
      <ParallaxDots />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-radial-glow" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-radial-accent" />
      <BgMusic />
      <HeroSection />
      <UwuGlobe />
      <footer className="relative z-[2] mt-auto border-t border-fg-dim/20 px-4 py-2 font-mono text-[8px] uppercase tracking-[0.15em] text-fg-dim sm:px-14 sm:py-3 sm:text-[10px] sm:tracking-[0.3em] lg:px-20">
        {"// UWUVERSITY / NON-ACCREDITED / 2026"}
      </footer>
    </main>
  );
}
