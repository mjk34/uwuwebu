---
name: dep-vet
description: Vet an npm package before proposing its installation. Produces a go/no-go recommendation based on Socket score, publisher, age, maintainer count, transitive dependencies, and known CVEs. Use BEFORE any `npm install` of a package not already in package.json.
---

# dep-vet

Blocks every new npm dependency behind an evidence-based go/no-go gate. If you catch yourself about to suggest `npm install <anything>` and `<anything>` isn't already in `package.json`, stop and run this skill first.

## When to use

**Required** before:
- Any `npm install <new-package>` (whether `-D`, `-g`, or runtime)
- Any `npm update <package>` that brings in a major version bump
- Accepting a code snippet from the user or a doc that imports from an unfamiliar module
- Any time you'd be tempted to "just install X real quick"

**Not required for:**
- Packages already pinned in `package.json` (trust already established)
- Local-only files under `node_modules/` that came from an existing install

## Workflow

Run these checks in order. **Any FAIL → stop, report, ask the user.** Do not install.

### 1. Sanity — is this the package you think it is?

Fetch the npm registry entry directly (avoid shell + local npm state):

```
WebFetch https://registry.npmjs.org/<package-name>
```

Extract and report:
- Exact name (typosquat check against intended name — character-by-character)
- `description`, `homepage`, `repository.url`
- `author`, `maintainers` (list all usernames)
- `time.created` (first publish)
- `time.modified` (last publish)
- `license`

**FAIL conditions:**
- Name doesn't match what the user/doc asked for (typosquat suspected)
- No repository URL, or repo is 404
- `time.created` is less than 6 months ago AND downloads are low (see step 3)
- Single unknown maintainer with no public GitHub presence

### 2. Socket score

```bash
socket package score npm <package-name>
```

(Or with version pin: `socket package score npm <package-name>@<version>`.)

**FAIL conditions:**
- Supply-chain risk flagged (obfuscated code, install scripts, suspicious network calls, known typosquat)
- Maintenance score below 60
- Any "critical" or "high" severity finding

See `references/socket-thresholds.md` for the full scoring rubric.

### 3. Popularity and age

Fetch weekly downloads from the npm downloads API:

```
WebFetch https://api.npmjs.org/downloads/point/last-week/<package-name>
```

**Heuristics, not hard gates:**
- `>100k` weekly downloads → widely-used, lower risk (but not zero — see `event-stream`, `ua-parser-js`)
- `1k–100k` → niche but legit territory, require a good reason to adopt
- `<1k` → high scrutiny; escalate to user with a strong justification
- Package age `>2 years` + steady downloads = mature
- Package age `<6 months` + low downloads = very high risk

### 4. Transitive surface area

```
WebFetch https://registry.npmjs.org/<package-name>/latest
```

Report the `dependencies` object. Every transitive dep is a package you're also trusting. Flag:
- Any transitive over 10 direct deps
- Any transitive with a name starting with `node-` or a deprecated-looking package
- Transitives that conflict with something already in `package.json`

### 5. Known CVEs

After install (if you get that far), run `npm audit --omit=dev` and report any findings. Do not claim the install is complete until audit is clean or the user has explicitly accepted the risk.

## Report format

After running the checks, produce a short markdown report:

```
## dep-vet: <package>@<version>

**Recommendation:** GO / NO-GO / ESCALATE

| Check | Result |
|-------|--------|
| Name match     | ✓ exact match |
| Publisher      | ✓ github.com/foo/bar, 3 maintainers |
| Age            | ✓ 4 years, last publish 2 weeks ago |
| Socket score   | ⚠ supply-chain: 72, flagged install script |
| Weekly downloads | ✓ 450k/wk |
| Transitives    | ⚠ 14 deps, including `xyz` flagged for maintenance |
| Audit (post)   | — (not installed yet) |

**Notes:** <anything that needs human attention>
**Alternatives considered:** <lighter or zero-dep options>
```

Present this to the user **before** running `npm install`. Wait for explicit approval.

## Gotchas

- **Don't trust weekly downloads alone.** `event-stream` had millions of weekly downloads when it was compromised. Downloads are a popularity proxy, not a safety proxy.
- **`feross`, `sindresorhus`, `tj`, `isaacs`, etc. are strong positive signals** — known community figures. But even their packages can be compromised if their npm account is. Don't treat publisher identity as a free pass.
- **Transitive deps compound.** A package with 3 direct deps that each have 10 transitives is effectively a 30+ dep trust surface.
- **Types packages** (`@types/*`) are generally safe — published by DefinitelyTyped maintainers — but still worth checking for typosquats.
- **Install scripts are the #1 malware vector.** `.npmrc` in this project has `ignore-scripts=true` as default. If a package genuinely needs scripts to function, document why in the report and install with `--foreground-scripts` so the user sees what runs.
- **Chicken-and-egg for Socket itself:** if Socket CLI isn't installed, fall back to manual npm-registry checks (steps 1, 3, 4) and flag that Socket scoring was unavailable.
- **Scoped packages (`@org/name`) get typosquatted too.** Check that the `@org` actually owns other packages and the org isn't newly-created.
- **Don't bypass this skill "just for dev deps."** Build-time packages run code on your machine too (`node_modules/.bin/*` scripts, webpack/rollup/vite plugins) and are a top attack vector.
- **`npm install -g` lives outside `.npmrc`** — global installs ignore project-level `ignore-scripts=true`. Check Socket explicitly for any `-g` install.
