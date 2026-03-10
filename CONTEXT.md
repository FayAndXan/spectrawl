# Spectrawl — Project Context

## What
Self-hosted Node.js package — unified web layer for AI agents. One API for search, browse, auth, and platform actions. 5,000 free searches/month via Gemini Grounded Search. Open source, MIT, npm installable.

## Status: v0.3.16 — Speed optimized, Camoufox verified, CAPTCHA solver, Tavily fallback
Answer quality beats Tavily. Summarizer opt-in (not default). 7 adapters live tested.

## Repo
**github.com/FayAndXan/spectrawl** (public, 30+ commits)

## Published
- npm: `spectrawl@0.3.16` (account: fay_)

## Infrastructure
- **Spectrawl systemd service**: `spectrawl.service`, localhost:3900, auto-restart
- **GITHUB_TOKEN in gateway env**: all agents can use it
- **Credential architecture**: HTTP service holds credentials. Other agents call `localhost:3900/act`.

## Pricing (honest)
| Volume | Spectrawl | Tavily |
|--------|-----------|--------|
| <5K/month | **Free** | $40 |
| 10K/month | $80 | $90 |
| 50K/month | $720 | **$490** |

- Grounding: $0 under 5K/mo, $14/1K after
- Summarizer (opt-in): ~$0.002/query extra
- Crossover: ~8K queries/month

## Key Design Decisions
- **Summarizer OFF by default** — agents have their own LLM. Double-summarizing = double cost. `{ summarize: true }` opt-in.
- **One-time key warning** — when no GEMINI_API_KEY, prints helpful message with link
- **No truly free search at scale** — every API costs something. Gemini free tier is the best deal.
- **Tavily as fallback engine** — built and integrated, in default cascade
- **Speed optimized** — 16s → ~10s full, ~6s snippets mode
- **5s scrape timeout** — quality over speed (Fay's call)
- **For agents, not scripts** — rich sources > pre-chewed answers

## What's Built & Validated

### Search ✅
- Gemini Grounded (primary), Brave, DDG, Bing, Serper, Google CSE, Jina, SearXNG
- Deep search: parallel Gemini+DDG → dedup → source ranking → scraping → sources returned
- Source quality ranker: boost GitHub/SO/HN, penalize SEO farms

### Answer Quality (verified)
- Spectrawl: 10 sources, full page content scraped, inline [1][2][3] citations (with summarizer)
- Tavily: 10 sources, snippets only, no citations
- Speed: ~10s full / ~6s snippets vs Tavily's 2s
- Modes: `full` (~10s), `snippets` (~6s), `fast` (~5s)

### HTTP Server ✅
- All 5 endpoints tested: /health, /status, /search, /browse, /act

### MCP Server ✅
- Initialize + tool listing (5 tools) + web_search — all working

### Auth Manager ✅
- SQLite cookie store, expiry detection, cookie refresher events

### Platform Adapters — 7 live tested
| Platform | Status | Account |
|----------|--------|---------|
| GitHub | ✅ LIVE | FeyDeFi |
| Reddit | ✅ LIVE | EntrepreneurSharp538 |
| Dev.to | ✅ LIVE | fay_ |
| HuggingFace | ✅ LIVE | fayface |
| X | ✅ reads, ❌ writes (datacenter blocked) | @fayandxan |
| IH | stored cookies | akmanfuoco33 |
| 18 others | code exists, untested | need accounts |

### Rate Limiter + Dedup ✅
### Stealth Browse ✅
- Tier 1: Playwright + stealth plugin (default, npm install)
- Tier 2: Camoufox binary (installed, verified, spoofs Mac UA on Linux)
- Tier 3: Remote Camoufox service (config only)
- CAPTCHA: stealth bypass → Gemini Vision (image) → unsolvable (token-based)

### Auth Manager ✅ (E2E tested)
- Full cycle: add → getCookies → browse with cookies → update → remove
- Form filler: smartFill tested on real httpbin form

## Accounts Fay Still Needs
- **Quick wins**: Discord bot
- **Browser cookies**: LinkedIn, HN, Quora, AlternativeTo, SaaSHub, DevHunt
- **OAuth**: Medium, Product Hunt, YouTube

## API Key Status
- Gemini (`AIzaSyDwZ5...`): ✅
- MiniMax: ❌ expired
- xAI: ❌ credits exhausted
- Dev.to: ✅
- HuggingFace: ✅

## Next Steps
1. README update — browse tiers, CAPTCHA docs, speed benchmarks, modes
2. Test remaining 17 untested adapters (need accounts from Fay)
3. Wire proxy rotation (need ProxyCheap or similar)
4. Battle-test CAPTCHA solver on real protected sites
5. Streaming answers for perceived speed improvement
6. Browser-automation adapter selector validation

## Key Files
- `src/search/index.js` — search engine, deepSearch (summarizer opt-in)
- `src/search/engines/gemini-grounded.js` — primary search
- `src/search/summarizer.js` — multi-provider, opt-in only
- `src/search/source-ranker.js` — domain trust scoring
- `src/search/scraper.js` — Jina + readability + Playwright fallback
- `src/server.js` — HTTP server (port 3900)
- `src/mcp.js` — MCP server (stdio)
- `src/act/adapters/*.js` — 24 platform adapters
- `src/auth/index.js` — SQLite auth manager
