# Spectrawl — Project Context

## What
Self-hosted Node.js package — unified web layer for AI agents. One API for search, browse, auth, and platform actions. Open source, MIT, npm installable.

## Status: v0.3.2 — Deep Search + Gemini Grounded
Google-quality search via Gemini Grounded, 24 platform adapters, stealth browsing. Published on npm.

## Repo
**github.com/FayAndXan/spectrawl** (public)

## Stack
Node.js 20+, Playwright, Camoufox (optional), SQLite (better-sqlite3)

## What's Built

### Search
- **Gemini Grounded Search** — primary engine, Google-quality results via Gemini API (free, 5000/month)
- DDG fallback (free, unlimited)
- 6 engines wired: SearXNG → DDG → Brave → Serper → Google CSE → Jina
- **Deep search pipeline:** query expansion → parallel search → rerank → scrape → AI summarize with citations
- **Fast mode:** snippet-only, ~6s (no scraping)
- **Deep mode:** full content extraction, ~7-14s
- Reranker (Gemini Flash, scores 0-1)
- Query expander (variant queries, skipped for Gemini Grounded)
- Parallel Gemini + DDG for 15-20 results combined

### Scraping
- Dual engine: Jina Reader → markdown readability fallback
- Parallel scraping with per-URL hard timeout
- Redirect URL resolution for Gemini grounding chunks

### Browse
- Playwright → Camoufox auto-escalation, human-like timing
- Three-tier stealth: stealth Playwright → Camoufox binary → remote Camoufox

### Auth
- SQLite cookie store, multi-account, refresh cron, event hooks

### Platform Adapters (24 total)
**API-based (14):** X, Reddit, LinkedIn, Dev.to, Hashnode, Medium, GitHub, Discord, Product Hunt, YouTube, HuggingFace, BetaList + IH (browser), HN (cookie form)
**Browser automation (5):** Quora, AlternativeTo, SaaSHub, DevHunt, IH
**Generic directory (1 adapter, 14 sites):** MicroLaunch, Uneed, Peerlist, Fazier, BetaPage, etc.

### Infrastructure
- MCP server (stdio, 5 tools)
- HTTP server (/search, /browse, /act, /status, /health) port 3900
- CLI (init, search, status, serve, mcp, version)
- Events, rate limiter, dedup, dead letter queue, form filler, proxy server

## Published
- npm: `spectrawl@0.3.2` (account: fay_)
- GitHub: github.com/FayAndXan/spectrawl (16+ commits)

## Performance vs Tavily
| | Tavily | Spectrawl |
|---|---|---|
| Speed (fast) | ~2s | ~6s |
| Speed (deep) | ~2s | ~7-14s |
| Quality | Google index | Google via Gemini ✅ |
| Results | 20+ | 10-20 ✅ |
| Citations | ✅ | ✅ |
| Cost | $0.01/query | **Free** |
| Stealth browse | ❌ | ✅ |

## Key Requirement
- Best experience requires `GEMINI_API_KEY` (free signup)
- Without Gemini: DDG-only search, no AI features (still functional)
- Only Gemini models have grounding (built-in Google Search) — no other LLM provider offers this
- Summarizer supports any LLM: OpenAI, Anthropic, MiniMax, xAI, Ollama, Gemini

## What's NOT Built / Remaining
- Speed gap: 6s vs Tavily's 2s (Gemini API latency ~4s, can't fix)
- Reranker scoring all 1.0 — should skip when Gemini Grounded provides confidence scores
- Wire proxy into browse engine automatically
- Test X posting through residential proxy
- Live test new adapters (Medium, GitHub, Discord, PH, HN, YouTube)
- Browser automation selectors need validation
- Make reranker/expander provider-agnostic (not just Gemini)
- Auto-fallback to Playwright when readability extraction returns <200 chars

## Relationship to xanOS
Open-source infra that xanOS uses internally. XanLens audits → xanOS generates → Spectrawl publishes.

## Key Files
- `src/search/engines/gemini-grounded.js` — Gemini Grounded Search
- `src/search/index.js` — search engine + deepSearch
- `src/search/reranker.js`, `src/search/query-expander.js`, `src/search/summarizer.js`
- `src/search/scraper.js` — Jina + readability, parallel
- `src/browse/` — Playwright + Camoufox
- `src/act/adapters/*.js` — 24 platform adapters
- `src/mcp.js`, `src/server.js`, `src/cli.js`
