import HeroSection from "@/components/home/HeroSection";
import ParallaxDots from "@/components/home/ParallaxDots";
import UwuGlobe from "@/components/home/UwuGlobe";

export default function HomePage() {
  return (
    <main className="relative flex w-full flex-1 flex-col overflow-hidden">
      <ParallaxDots />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-radial-glow" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-radial-accent" />
      <HeroSection />
      <UwuGlobe />
    </main>
  );
}
