// Adapter from uwuwebu-pipeline news.json (cluster-shaped) to the flat
// per-card shape the dashboard renders. One pipeline headline = one card.
//
// Data flow: pipeline → Cloudflare R2 (public bucket) → fetched at runtime
// from the browser. Site is statically exported so there is no server-side
// proxy — the R2 bucket must have CORS configured to allow our origins.
//
// Scale conversions:
//   - bias: pipeline emits Ad Fontes -42..+42; UI BiasBar expects -1..+1
//   - rel:  pipeline emits Ad Fontes 0..64;    UI badge expects 0..100

export type Cat = "world" | "investments" | "cyber" | "science";

export type PipelineClaim = {
  type: "fact" | "analysis" | "opinion" | string;
  claim: string;
};

export type PipelineArticle = {
  id: string;
  src: string;
  srcTier: "wire" | "mainstream" | "specialty";
  srcUrl: string;
  // logoUrl is emitted by the pipeline but intentionally not typed here —
  // it points at google.com/s2/favicons which our current CSP blocks. When
  // the modal starts rendering source favicons, widen img-src in
  // public/_headers and re-add the field.
  title: string;
  dateTs: number;
  readTimeSec: number;
  bias: number;
  biasBucket: "left" | "center" | "right";
  rel: number;
  bullets: string[];
  summary: string;
  tags: string[];
  place: string | null;
  lat: number | null;
  lng: number | null;
  /** Optional per-article claim breakdown surfaced in the detail modal. */
  claims?: PipelineClaim[];
};

export type PipelineHeadline = {
  id: string;
  clusterId: string;
  cat: Cat;
  title: string;
  framing: string;
  dateTs: number;
  lastTs: number;
  tags: string[];
  place: string | null;
  lat: number | null;
  lng: number | null;
  sourceCount: number;
  biasMedian: number;
  relAvg: number;
  articles: PipelineArticle[];
};

export type PipelinePayload = {
  generatedAt: number;
  headlines: PipelineHeadline[];
};

// Disputed / divergence / coverage / narrative shapes from the pipeline.
// Kept as `unknown` here because the schema is still evolving — the modal
// pattern-matches on shape rather than holding tight types.
export type DisputedItem = { claim: string; positions?: { who: string; claim: string }[] };
export type DivergenceItem = { topic: string } & Record<string, unknown>;
export type Narrative = { framing: string } | null;
export type CoverageBreakdown = { left: number; center: number; right: number };
export type SourceDiversity = { wire: number; mainstream: number; specialty: number };

export type NewsCard = {
  id: string;
  // Stable across pipeline runs; the slug `id` may change if a cluster's
  // title evolves. Use this as the persistence key for bookmarks/read state.
  clusterId: string;
  cat: Cat;
  tags: string[];
  title: string;
  src: string;
  bias: number;     // -1..+1
  rel: number;      // 0..100
  lat: number | null;
  lng: number | null;
  dateTs: number;
  place: string | null;
  summary: string;          // headline.framing — short editorial summary
  sourceCount: number;
  articles: PipelineArticle[];
  // Rich fields surfaced in the detail modal. All optional because older
  // payloads or partial pipelines may omit them.
  established?: string[];
  reported?: string[];
  disputed?: DisputedItem[];
  blindspotNote?: string | null;
  divergence?: DivergenceItem[];
  narratives?: { left?: Narrative; center?: Narrative; right?: Narrative };
  coverage?: CoverageBreakdown;
  sourceDiversity?: SourceDiversity;
  coverageMode?: string;
  biasMedian?: number;      // pipeline raw -42..+42
  biasSpread?: number;
  newDevelopment?: boolean;
  lastDevelopmentTs?: number;
};

const BIAS_DIVISOR = 42;
const REL_DIVISOR = 64;

function pickPrimarySource(articles: PipelineArticle[]): string {
  if (articles.length === 0) return "—";
  const wire = articles.find(a => a.srcTier === "wire");
  return (wire ?? articles[0]).src;
}

export function headlineToCard(h: PipelineHeadline): NewsCard {
  // Pipeline payload may carry extra fields not enumerated in PipelineHeadline
  // (the type only covers the minimum the dashboard needs). Read them through
  // a loose cast so the modal can surface them when present.
  const raw = h as unknown as Record<string, unknown>;
  return {
    id: h.id,
    clusterId: h.clusterId,
    cat: h.cat,
    tags: h.tags,
    title: h.title,
    src: pickPrimarySource(h.articles),
    bias: Math.max(-1, Math.min(1, h.biasMedian / BIAS_DIVISOR)),
    rel: Math.round(Math.max(0, Math.min(100, (h.relAvg / REL_DIVISOR) * 100))),
    lat: h.lat,
    lng: h.lng,
    dateTs: h.lastTs,
    place: h.place,
    summary: h.framing,
    sourceCount: h.sourceCount,
    articles: h.articles,
    established: raw.established as string[] | undefined,
    reported: raw.reported as string[] | undefined,
    disputed: raw.disputed as DisputedItem[] | undefined,
    blindspotNote: raw.blindspotNote as string | null | undefined,
    divergence: raw.divergence as DivergenceItem[] | undefined,
    narratives: raw.narratives as NewsCard["narratives"],
    coverage: raw.coverage as CoverageBreakdown | undefined,
    sourceDiversity: raw.sourceDiversity as SourceDiversity | undefined,
    coverageMode: raw.coverageMode as string | undefined,
    biasMedian: h.biasMedian,
    biasSpread: raw.biasSpread as number | undefined,
    newDevelopment: raw.newDevelopment as boolean | undefined,
    lastDevelopmentTs: raw.lastDevelopmentTs as number | undefined,
  };
}

export type NewsSource = "live" | "fallback";

export type NewsFeed = {
  generatedAt: number;
  cards: NewsCard[];
  // "live" = fetched from R2 successfully; "fallback" = bundled public/news.json
  // because R2 was unreachable (typically CORS on pub-*.r2.dev). UI uses this
  // to signal staleness.
  source: NewsSource;
};

// Inlined into the client bundle at build time. Keep in `.env.local` (gitignored)
// so the bucket URL stays out of source. NEXT_PUBLIC_ prefix is required since
// this fetch runs in the browser.
const R2_NEWS_URL = process.env.NEXT_PUBLIC_NEWS_URL;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Bundled fallback served from public/. Used when R2 fetch fails — typically
// because the pub-*.r2.dev URL ignores CORS policy. Once the custom domain
// (news.uwuversity.org) is live with CORS configured, R2 wins on every load
// and this file just sits dormant as an offline/outage backstop.
const FALLBACK_URL = `${BASE_PATH}/news.json`;

// Drop cards with mock-LLM placeholder synthesis — these can sneak in when
// Stage 6 falls back to the mock client (no fixture for a given cluster).
// Belt-and-suspenders so a half-failed run can't leak "Cluster synthesis
// placeholder headline." into the UI.
function isPlaceholder(n: NewsCard): boolean {
  const t = (n.title || "").toLowerCase();
  const s = (n.summary || "").toLowerCase();
  return t.includes("placeholder") || s.includes("placeholder");
}

// Minimal shape check — verifies the top-level payload has the two fields we
// need before we start mapping headlines. Doesn't deep-check per-headline
// fields (those default gracefully in headlineToCard), but guards against
// wildly malformed responses (HTML error pages, empty bodies, etc).
function isPipelinePayload(x: unknown): x is PipelinePayload {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Partial<PipelinePayload>;
  return typeof p.generatedAt === "number" && Array.isArray(p.headlines);
}

function adaptPayload(payload: unknown, source: NewsSource): NewsFeed {
  if (!isPipelinePayload(payload)) {
    throw new Error("news payload failed shape check (expected { generatedAt: number, headlines: [] })");
  }
  return {
    generatedAt: payload.generatedAt,
    cards: payload.headlines.map(headlineToCard).filter(c => !isPlaceholder(c)),
    source,
  };
}

export async function fetchNews(): Promise<NewsFeed> {
  // Only fetch the configured R2 URL if it's explicitly https:// — guards
  // against a misconfigured/tampered env var pointing at http:// or a
  // non-web scheme. Build-time surface only, but the check is free.
  if (R2_NEWS_URL && /^https:\/\//i.test(R2_NEWS_URL)) {
    try {
      const res = await fetch(R2_NEWS_URL, { cache: "no-store" });
      if (res.ok) return adaptPayload(await res.json(), "live");
      console.warn(`[news] R2 returned ${res.status}; using bundled fallback`);
    } catch (err) {
      console.warn("[news] R2 fetch failed; using bundled fallback", err);
    }
  }
  const res = await fetch(FALLBACK_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`news fallback fetch failed: ${res.status}`);
  return adaptPayload(await res.json(), "fallback");
}
