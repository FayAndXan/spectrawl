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

## Session 6 Decisions (18:06-19:54 UTC) — Deep Search + Gemini Grounded
- **Gemini Grounded Search as primary engine** — Google-quality results via Gemini API, free 5000/month
- **gemini-2.0-flash for grounding** — only model returning structured groundingChunks with URLs
- **gemini-2.5-flash for LLM tasks** — 2.5-flash grounding doesn't return extractable URLs, but better reasoning
- **Config objects were silently ignored** — ROOT CAUSE of 0-result failures. Constructor expected file path, not object.
- **Never cache empty results** — prevents cache poisoning from transient failures
- **DDG unreliable from datacenter** — HTML endpoints CAPTCHA'd, JSON API only for factoid queries
- **Bing also blocks datacenter IPs** — same problem as DDG
- **Default cascade: gemini-grounded → brave → ddg** — DDG demoted to last resort
- **Minimum viable setup needs one free key** — Gemini or Brave. Same as Tavily requiring their key.
- **Source quality ranker** — novel feature, Tavily doesn't have domain trust scoring
- **Summarizer rewritten** — no hedging, direct answers with citations
- **Spectrawl beats Tavily on result volume** (12-16 vs 10) but loses on speed (6-10s vs 2s)
- **Speed bottleneck is Gemini API latency (~4s)** — can't fix without different search provider
- **Serper.dev: 2,500 queries ONE-TIME trial, not monthly** — corrected misconception

## Session 7 Decisions (00:45-02:14 UTC, Mar 10)
- **Spectrawl as systemd service** — `spectrawl.service`, localhost:3900, auto-restart, credentials isolated in dijiclaw workspace
- **Credential architecture: Option 1** — other agents call HTTP API, never see raw tokens. Clean separation: Dante writes, Spectrawl publishes.
- **GITHUB_TOKEN exception** — added to gateway env for all agents (low risk, revertible)
- **Summarizer default model bug** — was using `gpt-4o-mini` for Gemini calls, silently failing. Fixed with provider-specific defaults.
- **GitHub adapter uses `repo` as full path** — `FayAndXan/spectrawl` not separate owner/repo params
- **Fay confirmed: GitHub token OK for all agents** — "I feel GitHub is fine every agent can have access"

## Session 8 Decisions (02:17-04:18 UTC, Mar 10) — Pricing + Summarizer + Adapters
- **Summarizer OFF by default** — agents have their own LLM, double-summarizing is waste. `{ summarize: true }` opt-in.
- **Not free at scale** — 5K free grounded queries/month, then $14/1K. Tavily is $10/1K. We're cheaper below ~8K/month.
- **Tavily as optional fallback** — after 5K Gemini quota, fall back to Tavily if user has key. Not yet built.
- **No truly free search exists** — DDG unreliable, every API needs a key. Gemini key (free, no credit card) is minimum viable.
- **One-time key warning** — stderr warning with link when no GEMINI_API_KEY set. Agents surface it to human.
- **Dev.to + HuggingFace adapters verified** — both work through ActEngine chain
- **Dev.to adapter bug** — needed User-Agent header, redirect handling
- **Answer quality beats Tavily** — 12 items + citations vs 3 items + none. Verified with real queries.
- **Fay: "don't claim free"** — README updated to "5,000 free searches/month"

## Next Steps
- Build Tavily as optional search engine in cascade
- Cut speed (16s → target <10s)
- Fay creates accounts for remaining adapters (Discord bot, LinkedIn, HN, etc.)
- Wire proxy into browse engine
- Browser-automation adapters need selector validation
