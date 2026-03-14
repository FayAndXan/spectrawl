# Spectrawl — Project Context

## What
Self-hosted Node.js package — unified web layer for AI agents. One API for search, browse, crawl, auth, and platform actions. 5,000 free searches/month via Gemini Grounded Search. Open source, MIT, npm installable.

## Status: v0.5.0 — RFC 9457 errors + block detection shipped
Crawl engine rebuilt: Camoufox-only (no Jina), auto-parallel based on RAM, async jobs, fast mode. Repo now public. Published on npm.

## Repo
**github.com/FayAndXan/spectrawl** (public)
- npm: `spectrawl@0.4.3`
- Dockerfile: node:22-slim, port 3900

## Infrastructure
- **Spectrawl systemd service**: `spectrawl.service`, localhost:3900, auto-restart
- WorkingDirectory: `/root/.openclaw/workspace-dijiclaw/projects/spectrawl`
- GITHUB_TOKEN + GEMINI_API_KEY in service env

## Crawl Engine (v2 — March 12 2026)
- Uses own Camoufox engine exclusively (removed Jina Reader dependency)
- Auto-detects system RAM → calculates safe concurrency (~250MB per tab)
- fastMode for crawling: 400ms wait + instant scroll (vs 800-2200ms in normal browse)
- Async job mode: POST with `async:true`, poll GET `/crawl/{jobId}`
- GET `/crawl/capacity` — shows system estimates
- Pattern filtering: includePatterns/excludePatterns
- Merge mode: combine all pages into single document
- Scope: domain (default), prefix, any
- Performance on 8GB server: 10 pages in 14s, ~200 pages in 3 min, ~1K in 15 min
- Known bottleneck: shared browser pipeline (single Playwright browser instance)
- Multi-browser pool would help but RAM-expensive

### Bug fixed
- Scope filtering: `{ ...DEFAULT_OPTS, ...opts }` with undefined opts values overriding defaults. Fixed with `Object.fromEntries(Object.entries(opts).filter(([_, v]) => v !== undefined))`.

## vs Cloudflare /crawl API
- CF: massive scale (100K pages), global edge, managed infra, needs account/API key/pricing
- Spectrawl: free, local, stealth anti-bot (including bypassing CF itself), no dependencies
- CF wins at 10K+ pages. Spectrawl wins at 50-200 pages with stealth + zero cost.

## What's Built & Validated
- Search: 8 engines, deep search, source ranking, scraping
- Browse: 3-tier stealth (Playwright → Camoufox → Remote)
- Crawl: parallel, async jobs, RAM-aware, fast mode
- HTTP Server: /search, /browse, /crawl, /act, /status, /health, /crawl/capacity, /crawl/jobs
- MCP Server: stdio transport, 5 tools
- Auth: SQLite cookies, expiry detection, refresher
- CAPTCHA: stealth bypass → Gemini Vision → unsolvable
- Adapters: 24 total
- Rate limiter + dedup, Form filler

## Launch Status
See keychat.md for full launch tracker. Key: Reddit (4 subs), Dev.to, Hashnode, OpenClaw, npm. HN pending karma build. Awesome list PRs pending.

## Key Files
- `src/crawl.js` — crawl engine v2 (parallel, async, RAM-aware)
- `src/browse/index.js` — browse engine (Camoufox, fastMode)
- `src/search/index.js` — search engine, deepSearch
- `src/server.js` — HTTP server (port 3900)
- `src/mcp.js` — MCP server (stdio)
- `src/act/adapters/*.js` — 24 platform adapters
