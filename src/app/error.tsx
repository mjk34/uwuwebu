"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-deep font-mono text-fg">
      <h1 className="text-2xl text-danger">something broke</h1>
      <p className="text-sm text-fg-muted">the uplink hit a snag</p>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-accent/50 px-4 py-2 text-sm text-accent transition-colors hover:border-accent hover:shadow-[0_0_12px_rgba(0,240,255,0.3)]"
      >
        retry
      </button>
    </main>
  );
}
