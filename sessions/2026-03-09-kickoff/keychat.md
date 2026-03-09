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

## Next Steps
- IH browser automation
- Tests
- README
- npm publish
- End-to-end testing with live accounts
