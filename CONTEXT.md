# Spectrawl — Project Context

## What
Self-hosted Node.js package — unified web layer for AI agents. One API for search, browse, auth, and platform actions. 5,000 free searches/month via Gemini Grounded Search. Open source, MIT, npm installable.

## Status: v0.3.13 — Sources-only default, honest pricing
Answer quality beats Tavily. Summarizer opt-in (not default). 7 adapters live tested.

## Repo
**github.com/FayAndXan/spectrawl** (public, 30+ commits)

## Published
- npm: `spectrawl@0.3.13` (account: fay_)

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
- **Tavily as optional fallback** — decided, not yet built

## What's Built & Validated

### Search ✅
- Gemini Grounded (primary), Brave, DDG, Bing, Serper, Google CSE, Jina, SearXNG
- Deep search: parallel Gemini+DDG → dedup → source ranking → scraping → sources returned
- Source quality ranker: boost GitHub/SO/HN, penalize SEO farms

### Answer Quality (verified)
- Spectrawl: 19 sources, 12 items named, inline [1][2][3] citations
- Tavily: 10 sources, 3 items named, no citations
- Speed: 12-17s vs Tavily's 2s (Gemini API latency)

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
### Stealth Browse (Playwright) ✅

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
1. Build Tavily as optional search engine in cascade
2. Cut speed (16s → target <10s)
3. Test remaining adapters as accounts come in
4. Wire proxy into browse engine

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
