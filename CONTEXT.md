# Spectrawl — Project Context

## What
Self-hosted Node.js package — unified web layer for AI agents. One API for search, browse, auth, and platform actions. Open source, MIT, npm installable.

## Status: v0.1.0 — Feature Complete (not battle-tested)
All core features built and pushed. Needs real-world testing with live accounts.

## Repo
**github.com/FayAndXan/spectrawl** (public)

## Stack
Node.js 20+, Playwright, Camoufox (optional), SQLite (better-sqlite3)

## What's Built
- **Search:** SearXNG → DDG → Brave → Serper → Google CSE → Jina (6 engines)
- **Scrape:** Jina Reader → markdown readability (dual engine)
- **Summarize:** OpenAI, Anthropic, MiniMax, xAI, Ollama
- **Browse:** Playwright → Camoufox auto-escalation, human-like timing
- **Auth:** SQLite cookie store, multi-account, refresh cron, event hooks
- **Act:** X, Reddit, Dev.to, Hashnode, LinkedIn, IH (6 adapters)
- **Infra:** MCP server, HTTP server, CLI, events, rate limiter, dedup, dead letter queue
- **Form filler:** contentEditable, React, shadow DOM

## Published
- npm: `spectrawl@0.2.1` (account: fay_)
- GitHub: github.com/FayAndXan/spectrawl (14 commits)

## Platform Adapters (24 total)
### API-based (14)
X, Reddit, LinkedIn, Dev.to, Hashnode, Medium, GitHub, Discord, Product Hunt, YouTube, HuggingFace, BetaList + IH (browser), HN (cookie form)

### Browser automation (5)
Quora, AlternativeTo, SaaSHub, DevHunt, IH

### Generic directory (1 adapter, 14 sites)
MicroLaunch, Uneed, Peerlist, Fazier, BetaPage, LaunchingNext, StartupStash, SideProjectors, TAIFT, Futurepedia, Crunchbase, G2, StackShare, AppSumo

## What's NOT Built / Remaining
- Wire proxy into browse engine automatically
- Test X posting through residential proxy
- Live test new adapters (Medium, GitHub, Discord, PH, HN, YouTube)
- Browser automation selectors need validation (Quora, AlternativeTo, SaaSHub, DevHunt)
- GitHub README badges
- npm/PyPI publish adapters (programmatic package publishing)

## Relationship to xanOS
Open-source infra that xanOS uses internally. Distribution funnel: Spectrawl users discover xanOS.

## Competitors
- Browserbase (YC, cloud, per-second billing)
- Hyperbrowser (YC, cloud, CAPTCHA solving)
- Steel.dev (open source, partial session persistence)
- Tavily (search only, paid)
- Crawl4AI (scraping only, Python)
- tavily-open (search only, Python)

## Key Files
- `ARCHITECTURE.md` — full architecture
- `src/index.js` — main entry
- `src/search/` — search engines + scraper + summarizer
- `src/browse/` — Playwright + Camoufox client
- `src/auth/` — cookie store + refresh cron
- `src/act/` — platform adapters + form filler + rate limiter
- `src/mcp.js` — MCP server
- `src/server.js` — HTTP server
- `src/cli.js` — CLI
