# Socket score interpretation

Socket's `socket package score npm <pkg>` returns several dimensions. Rubric for go/no-go decisions on uwuwebu:

## Categories

Socket reports scores across these dimensions (0–100, higher is better):

| Dimension          | What it measures                                              |
|--------------------|---------------------------------------------------------------|
| **Supply chain**   | Known malicious behavior, obfuscation, install scripts, network calls at install/runtime, typosquat indicators |
| **Quality**        | Test coverage, CI presence, type definitions, linting, build hygiene |
| **Maintenance**    | Commit recency, issue response time, release cadence, maintainer count |
| **Vulnerability**  | Known CVEs in the package or its transitives                  |
| **License**        | License presence, compatibility, copyleft flags               |

## Thresholds

### Auto-approve (GO)

All of:
- Supply chain ≥ 90
- Quality ≥ 70
- Maintenance ≥ 75
- Vulnerability ≥ 90 (no known criticals/highs)
- License score ≥ 80 (MIT / Apache-2.0 / BSD / ISC)

### Auto-reject (NO-GO)

Any of:
- Supply chain < 60 → stop, report, never install
- **Any** "critical" severity finding (malware, known-bad behavior, unpatched RCE)
- Install-time network calls flagged as unexpected
- Obfuscated source flagged
- License is unknown, proprietary, or AGPL (AGPL is fine for some projects; flag for user decision)

### Escalate to user (AMBIGUOUS)

Anything in between. Report findings, note which thresholds failed, and let the user make the call with full information.

## Specific flags to always surface

Even if the overall score is high, always mention if Socket reports:

- `install_script` — runs code on `npm install` (can be legit but worth explicit consent)
- `native_code` — uses node-gyp or ffi (higher attack surface, slower installs)
- `unusual_permissions` — writes outside its own tree, touches `~`, etc.
- `telemetry` — phones home on import or install
- `shell_access` — spawns shells
- `dynamic_require` — obscures what it actually imports
- `deprecated` — package is deprecated by its maintainer

## What Socket misses

Socket is signature/heuristic-based. It will not catch:

- Brand-new zero-day malicious packages (first-hour window)
- Social engineering where a maintainer goes rogue and releases a clean-looking but semantically malicious update
- Vulnerabilities in native binaries the package downloads
- Typosquats that are visually identical (homoglyph attacks)

For those, the layered defenses in `SKILL.md` (publisher check, age check, transitive review, `--ignore-scripts`) are the fallback.

## Chicken-and-egg

If Socket CLI itself is not yet installed (fresh project), fall back to:

1. Check publisher + age + maintainers via `registry.npmjs.org/<pkg>` (WebFetch)
2. Check weekly downloads via `api.npmjs.org/downloads/point/last-week/<pkg>` (WebFetch)
3. Visit socket.dev/npm/package/<pkg> in the user's browser for a manual read
4. Note "Socket scoring not available — fallback checks passed" in the report
