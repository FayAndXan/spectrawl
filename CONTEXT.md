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

## What's NOT Built
- playwright-extra stealth plugin (so npm install works standalone without Camoufox)
- IH actual browser automation (stub — no API exists)
- End-to-end tests with real accounts

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
