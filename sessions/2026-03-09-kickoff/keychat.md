# Keychat — Spectrawl (Mar 9, 2026)

## Key Decisions
- **Name: Spectrawl** (spectra + crawl) — Fay chose from options
- **Open-source infra, not product** — distribution play for xanOS
- **Self-hosted only** — no cloud, no billing
- **SearXNG as primary search** — one dependency, 70+ engines, replaces cascade
- **Dual scraper** — Jina Reader first, markdown readability fallback (from tavily-open)
- **Camoufox optional, not required** — need playwright-extra stealth for standalone npm
- **6 platform adapters** — X (GraphQL+OAuth), Reddit (Cookie OAuth), Dev.to, Hashnode, LinkedIn, IH
- **Rate limiter in SQLite** — per-platform limits, dedup, dead letter queue
- **Form filler auto-detection** — smartFill() for contentEditable/React/shadow DOM
- **MCP server for distribution** — any agent framework gets native access
- **Fay feedback: always research** — never say "no more research needed"
- **Fay feedback: don't pump up what we build** — be honest about gaps

## Architecture
- Node.js, Playwright, Camoufox (optional), SQLite
- HTTP server + MCP server (stdio)
- CLI: init, search, status, serve, mcp
- Config: spectrawl.json

## Session 3 Decisions (16:03-16:22 UTC)
- **Three-tier stealth model** — auto-detect best browser, no config needed
- **Camoufox as binary download, not dependency** — same model as Playwright downloading Chromium
- **Don't fork Firefox** — use Camoufox's prebuilt binaries (Apache 2.0). Hard part already done.
- **Fay correction: "why did you say no"** — I was wrong to dismiss forking/bundling Camoufox. The binary download model was obvious.

## Session 4 Decisions (16:22-17:10 UTC)
- **Rate limit before auth** — no point checking cookies if rate limited or duplicate
- **Reddit OAuth API works from any IP** — no proxy needed for Reddit
- **X cookie API blocked from datacenter** — Error 226, needs residential proxy or OAuth 1.0a
- **Proxy server built** — rotating gateway, any tool on server uses localhost:8080
- **npm published** — spectrawl@0.1.2 live, fay_ account, automation token

## Session 5 Decisions (17:10-18:06 UTC)
- **24 adapters total** — went from 6 to 24 in one session
- **Generic directory adapter** — one adapter handles 14+ directories with custom selectors each
- **Tier system for directories** — T1 (build dedicated), T2 (generic adapter), T3 (skip/email)
- **Full automation loop** — XanLens audits → xanOS generates → Spectrawl publishes (confirmed architecture)
- **v0.2.0 published** — major version bump for adapter expansion
- **XanLens audit platforms** all covered: Wikipedia (manual), Crunchbase, GitHub, LinkedIn, X, Product Hunt, G2, Discord, Medium, YouTube, Reddit, PitchBook (manual), StackShare + HuggingFace, npm, PyPI, Dev.to (industry)

## Next Steps
- Wire proxy server into browse engine automatically
- Test X posting through residential proxy
- Live testing of new adapters (Medium, GitHub, Discord, PH, HN, YouTube)
- Browser-automation adapters need real-world selector validation (Quora, AlternativeTo, SaaSHub, DevHunt)
- GitHub README badges (npm version, CI status, license)
- npm/PyPI adapters (publish packages programmatically)
