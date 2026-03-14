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

## Session 9 Decisions (05:30-05:47 UTC, Mar 10) — Speed + Tavily
- **Tavily engine built and integrated** — `src/search/engines/tavily.js`, in default cascade
- **Speed: 16s → ~10s** — skip DDG when Gemini has enough, 5s scrape timeout
- **New modes**: `snippets` (6s, no scraping), `fast` (5s, no scraping or summary)
- **5s scrape timeout** — Fay chose quality over speed (was 3s, bumped to 5s)
- **Spectrawl = for agents, not scripts** — agents need rich sources, not pre-chewed answers. Tavily is better for scripts.
- **Compaction model set to Sonnet** — Opus was timing out on 167K context compaction

## Session 10 Decisions (05:52-06:19 UTC, Mar 10) — Browse Validation + CAPTCHA
- **Camoufox verified** — installed, browse works, anti-detect confirmed (spoofs Mac UA on Linux)
- **Auth flow E2E** — full cycle tested: add cookies → retrieve → browse → update → remove
- **Form filler works** — smartFill on real httpbin form, auto-detects input type
- **CAPTCHA strategy: 3-tier** — stealth bypass → Gemini Vision (image CAPTCHAs) → report unsolvable (token-based)
- **No free CAPTCHA token solving** — reCAPTCHA/hCaptcha need 2captcha ($3/1K)
- **No free proxy rotation** — all free lists are dead/flagged. Tor blocked.
- **Installer 5-method extraction** — unzip → 7z → bsdtar → jar → python3 (fixes zip64 bug)

## Next Steps
- README update with browse tiers, CAPTCHA docs, speed benchmarks
- Test remaining 17 untested adapters (need accounts)
- Wire proxy rotation (when Fay gets ProxyCheap or similar)
- Battle-test CAPTCHA solver on real protected sites
- Streaming answers for perceived speed improvement

## Session 11 — Tone + Launch (Mar 10, ~07:00-07:56 UTC)
- Xan's feedback: own the speed tradeoff, drop aggressive Tavily framing
- Decision: "Different tools for different needs" positioning
- DDG removed from default cascade
- Full launch push: Reddit (4 subs), Dev.to, OpenClaw Discussions, Discord
- HN blocked (toonew) — karma builder cron set, post retry cron set
- Adapter count: 19 individual + 1 generic = 20, covering 24+ platforms
- Missing: Peerlist, Stacker News, ~8 generic directory selectors

## Session 12 — Awesome Lists + Glama (Mar 10, ~08:50-09:55 UTC)
- Submitted 4 awesome list PRs (82K+7.8K+26K+65K = 180K+ combined stars)
- awesome-selfhosted (279K) locked to collaborators — can't submit
- awesome-mcp-servers requires Glama listing — Fay submitted for review
- Added Dockerfile, .dockerignore, GitHub Release v0.3.20
- Added 10 GitHub topics including mcp-server, model-context-protocol
- Glama has no API — browser-only GitHub OAuth submission
- Published spectrawl@0.3.20
- Pending: Glama approval → update MCP PR with Glama URL

## Session 13 — Crawl Engine v2 (Mar 12, ~04:48-05:52 UTC)
- Rebuilt crawl engine: removed Jina Reader, Camoufox-only
- Fixed scope filtering bug (undefined opts overriding defaults via spread)
- Added: includePatterns/excludePatterns, merge mode, async jobs
- Added auto-parallel: detects system RAM, calculates safe concurrency
- Added fastMode to browse engine (reduced stealth delays for crawling)
- GET /crawl/capacity endpoint for system estimates
- Published 0.4.1 → 0.4.2 → 0.4.3
- Repo made public (was private, CI checkout failing)
- Decision: don't chase Cloudflare on throughput — our edge is stealth + free + no dependencies
- Decision: Opus set as default model (was Sonnet)
- Tweet drafted: honest CF vs Spectrawl comparison
- RFC 9457 structured errors added to all API endpoints
- Block page detection for 8 anti-bot services (CF, Akamai, AWS WAF, Imperva, DataDome, PerimeterX, hCaptcha, generic)
- Crawl auto-retries with full stealth when block detected
- Published v0.5.0
- Memory cleanup: trimmed all daily notes (41K→8K), MEMORY.md (3.1K→1.6K)
- System cron for memory maintenance (not heartbeat — saves Opus tokens)
- Heartbeats turned off
