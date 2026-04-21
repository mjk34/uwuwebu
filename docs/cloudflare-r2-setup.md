# Cloudflare R2 + custom domain setup — resume checkpoint

Started 2026-04-20. Goal: bind the uwuwebu-pipeline R2 bucket (which serves
`news.json`) to `news.uwuversity.org` so the browser can `fetch()` it without
the CORS block we hit on the default `pub-*.r2.dev` URL.

## Why this matters

The `pub-*.r2.dev` URL **ignores bucket CORS policy** — documented Cloudflare
limitation. No amount of CORS rules on the bucket will fix it while we're on
that hostname. The only working fix is to bind the bucket to a custom domain
on a Cloudflare-managed zone.

Until that's done, the dashboard falls back to `public/news.json` (bundled
simulated data) and the LIVE dot shows solid orange to signal the staleness.

## Where I left off

Waiting on Cloudflare ↔ Namecheap nameserver propagation for `uwuversity.org`.

## Resume checklist

### 1. Confirm Cloudflare has activated `uwuversity.org`
- Wait for the "Site is now active" email from Cloudflare, OR
- Check Cloudflare dashboard → site list → status should be "Active"
- DNS check: `dig NS uwuversity.org` should return Cloudflare nameservers

### 2. Bind R2 bucket to `news.uwuversity.org`
- Cloudflare dashboard → R2 → (the news bucket) → Settings → Custom Domains
- Click **Connect Domain**
- Enter: `news.uwuversity.org`
- Cloudflare auto-creates the CNAME record + provisions an SSL cert
- Wait for status to flip from "Initializing" → "Active" (1–5 min)

### 3. Apply CORS policy on the bucket
Same panel: R2 → bucket → Settings → CORS Policy → Add CORS Policy

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://mjk34.github.io"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

When the main site moves off `mjk34.github.io` to `https://uwuversity.org`,
add that origin too (or replace).

### 4. Verify CORS actually works on the new domain
From a terminal:
```
curl -sI -H "Origin: http://localhost:3000" https://news.uwuversity.org/news.json | grep -i access-control
```
Expected: at least `access-control-allow-origin: http://localhost:3000`.
If empty → CORS didn't apply yet (wait 1 min, retry) or the domain isn't
fully propagated (check status panel).

### 5. Update `.env.local`
```
NEXT_PUBLIC_NEWS_URL=https://news.uwuversity.org/news.json
```
Restart `npm run dev` (env changes don't hot-reload).

### 6. Confirm in the browser
- Reload the `/world` page
- Open DevTools → Network → look for `news.json` request → should be 200
  with the new domain
- LIVE dot should turn **green + pulsing** (not orange)
- If it's still orange: open Console — there's a `[news] R2 ...` warn line
  explaining why R2 fetch failed

## File touchpoints

- `.env.local` — `NEXT_PUBLIC_NEWS_URL` (gitignored — won't survive
  cloning the repo on a new machine)
- `src/lib/news.ts` — fetch logic (R2 first, bundled fallback on error,
  `source: "live" | "fallback"` flag)
- `src/components/world/DailyBriefingDashboard.jsx` — consumes
  `feed.source` to color the LIVE dot
- `public/news.json` — bundled fallback fixture (1.4MB, 343 headlines:
  30 real + 313 synthetic templated from real headlines)
- `/tmp/sim_news.py` — generator for the fallback fixture (ephemeral —
  recreate from the project memory `r2_cors_origins` if needed)

## Future cutover (when site moves to apex domain)

When the main website moves from `https://mjk34.github.io/uwuwebu/` to
`https://uwuversity.org`:

1. Add `https://uwuversity.org` to the R2 CORS allow-list (step 3 above)
2. Drop `basePath: "/uwuwebu"` from `next.config.ts`
3. Drop `NEXT_PUBLIC_BASE_PATH` from the env block in `next.config.ts`
   (the fallback URL in `news.ts` reads this — if you keep basePath empty
   for prod, the `${BASE_PATH}/news.json` resolves to `/news.json`,
   which is correct)
4. Deploy target shifts from GH Pages to wherever `uwuversity.org` is
   served — could be Cloudflare Pages, Vercel, or keep GH Pages with
   custom-domain CNAME to `mjk34.github.io`
