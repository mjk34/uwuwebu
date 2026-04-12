import type { MockGameDemo } from "@/lib/mock";
import DecryptLink from "@/components/chrome/DecryptLink";

type DemoCardProps = {
  demo: MockGameDemo;
};

export default function DemoCard({ demo }: DemoCardProps) {
  return (
    <article
      aria-labelledby={`demo-${demo.id}-title`}
      className="group relative grid w-full grid-cols-1 gap-0 overflow-hidden rounded border border-fg-dim/30 bg-bg-raised transition-colors hover:border-accent/60 md:grid-cols-[1.6fr_1fr]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg-deep md:aspect-auto md:h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={demo.heroSrc}
          alt={`${demo.title} key art`}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">
          {demo.code}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-5">
        <h3
          id={`demo-${demo.id}-title`}
          className="text-xl font-black uppercase leading-tight tracking-tight text-fg"
        >
          {demo.title}
        </h3>
        <p className="flex-1 text-xs text-fg-muted">{demo.tagline}</p>
        <div className="pt-1">
          <DecryptLink
            label="LAUNCH"
            onClick={() => {}}
            className="inline-flex items-center rounded-sm border border-accent/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-accent transition-colors hover:bg-accent hover:text-bg-deep focus-visible:bg-accent focus-visible:text-bg-deep focus-visible:outline-none"
          />
        </div>
      </div>
    </article>
  );
}
