# Spectrawl

The unified web layer for AI agents. Search, browse, authenticate, and act on platforms — one package, self-hosted.

**5,000 free searches/month** via Gemini Grounded Search. Full page scraping, stealth browsing, 19 platform adapters.

## What It Does

AI agents need to interact with the web — searching, browsing pages, logging into platforms, posting content. Today you wire together Playwright + a search API + cookie managers + platform-specific scripts. Spectrawl is one package that does all of it.

```
npm install spectrawl
```

## How It Works

Spectrawl searches via Gemini Grounded Search (Google-quality results), scrapes the top pages for full content, and returns everything to your agent. Your agent's LLM reads the actual sources and forms its own answer — no pre-chewed summaries.

## Quick Start

```bash
npm install spectrawl
export GEMINI_API_KEY=your-free-key  # Get one at aistudio.google.com
```

```js
const { Spectrawl } = require('spectrawl')
const web = new Spectrawl()

// Deep search — returns sources for your agent/LLM to process
const result = await web.deepSearch('how to build an MCP server in Node.js')
console.log(result.sources)   // [{ title, url, content, score }]

// With AI summary (opt-in — uses extra Gemini call)
const withAnswer = await web.deepSearch('query', { summarize: true })
console.log(withAnswer.answer)  // AI-generated answer with [1] [2] citations

// Fast mode — snippets only, skip scraping
const fast = await web.deepSearch('query', { mode: 'fast' })

// Basic search — raw results
const basic = await web.search('query')
```

> **Why no summary by default?** Your agent already has an LLM. If we summarize AND your agent summarizes, you're paying two LLMs for one answer. We return rich sources — your agent does the rest.

## Spectrawl vs Tavily

Different tools for different needs.

| | Tavily | Spectrawl |
|---|---|---|
| Speed | ~2s | ~6-10s |
| Free tier | 1,000/month | 5,000/month |
| Returns | Snippets + AI answer | Full page content + snippets |
| Self-hosted | No | Yes |
| Stealth browsing | No | Yes (Camoufox + Playwright) |
| Platform posting | No | 19 adapters |
| Auth management | No | Cookie store + auto-refresh |
| Cached repeats | No | <1ms |

**Tavily** is fast and simple — great for agents that need quick answers. **Spectrawl** returns richer data and does more (browse, auth, post) — but it's slower. Choose based on your use case.

## Search

Default cascade: **Gemini Grounded → Tavily → Brave**

Gemini Grounded Search gives you Google-quality results through the Gemini API. Free tier: 5,000 grounded queries/month.

| Engine | Free Tier | Key Required | Default |
|--------|-----------|-------------|---------|
| **Gemini Grounded** | 5,000/month | `GEMINI_API_KEY` | ✅ Primary |
| Tavily | 1,000/month | `TAVILY_API_KEY` | ✅ 1st fallback |
| Brave | 2,000/month | `BRAVE_API_KEY` | ✅ 2nd fallback |
| DuckDuckGo | Unlimited | None | Available |
| Bing | Unlimited | None | Available |
| Serper | 2,500 trial | `SERPER_API_KEY` | Available |
| Google CSE | 100/day | `GOOGLE_CSE_KEY` | Available |
| Jina Reader | Unlimited | None | Available |
| SearXNG | Unlimited | Self-hosted | Available |

### Deep Search Pipeline

```
Query → Gemini Grounded + DDG (parallel)
  → Merge & deduplicate (12-19 results)
  → Source quality ranking (boost GitHub/SO/Reddit, penalize SEO spam)
  → Parallel scraping (Jina → readability → Playwright fallback)
  → Returns sources to your agent (AI summary opt-in with summarize: true)
```

### What you get without any keys

DDG-only search, raw results, no AI answer. Works from home IPs. Datacenter IPs get rate-limited by DDG — recommend at minimum a free Gemini key.

## Browse

Stealth browsing with anti-detection. Three tiers (auto-detected):

1. **playwright-extra + stealth plugin** — default, works immediately
2. **Camoufox binary** — engine-level anti-fingerprint (`npx spectrawl install-stealth`)
3. **Remote Camoufox** — for existing deployments

```js
const page = await web.browse('https://example.com')
console.log(page.content)       // extracted text/markdown
console.log(page.screenshot)    // PNG buffer (if requested)
```

Auto-fallback: if Jina and readability return too little content (<200 chars), Spectrawl renders the page with Playwright and extracts from the rendered DOM. Tavily can't do this — they fail on JS-heavy pages.

## Auth

Persistent cookie storage (SQLite), multi-account management, automatic expiry detection.

```js
// Add account
await web.auth.add('x', { account: '@myhandle', method: 'cookie', cookies })

// Check health
const accounts = await web.auth.getStatus()
// [{ platform: 'x', account: '@myhandle', status: 'valid', expiresAt: '...' }]
```

Cookie refresh cron fires `cookie_expiring` and `cookie_expired` events before accounts go stale.

## Act — 19 Platform Adapters

Post to 19 platforms with one API:

```js
await web.act('github', 'create-issue', { repo: 'user/repo', title: 'Bug report', body: '...' })
await web.act('reddit', 'post', { subreddit: 'node', title: '...', text: '...' })
await web.act('devto', 'post', { title: '...', body: '...', tags: ['ai'] })
await web.act('huggingface', 'create-repo', { name: 'my-model', type: 'model' })
```

**Live tested:** GitHub ✅, Reddit ✅, Dev.to ✅, HuggingFace ✅, X (reads) ✅, Hashnode ✅, Discord ✅, Product Hunt ✅

| Platform | Auth Method | Actions |
|----------|-------------|---------|
| X/Twitter | Cookie + OAuth 1.0a | post |
| Reddit | Cookie API | post, comment, delete |
| Dev.to | REST API key | post, update |
| Hashnode | GraphQL API | post |
| LinkedIn | Cookie API (Voyager) | post |
| IndieHackers | Browser automation | post, comment |
| Medium | REST API | post |
| GitHub | REST v3 | repo, file, issue, release |
| Discord | Bot API | send, thread |
| Product Hunt | GraphQL v2 | launch, comment |
| Hacker News | Cookie API | submit, comment |
| YouTube | Data API v3 | comment |
| Quora | Browser automation | answer |
| HuggingFace | Hub API | repo, model card, upload |
| BetaList | REST API | submit |
| AlternativeTo | Cookie session | submit, claim |
| DevHunt | Supabase auth | submit, upvote |
| SaaSHub | Generic adapter | submit |
| **Generic Directory** | Configurable | submit |

Built-in rate limiting, content dedup (MD5, 24h window), and dead letter queue for retries.

## Source Quality Ranking

Spectrawl ranks results by domain trust — something Tavily doesn't do:

- **Boosted:** GitHub, StackOverflow, HN, Reddit, MDN, arxiv, Wikipedia
- **Penalized:** SEO farms, thin content sites, tag/category pages
- **Customizable:** bring your own domain weights

```js
const web = new Spectrawl({
  sourceRanker: {
    boost: ['github.com', 'news.ycombinator.com'],
    block: ['spamsite.com']
  }
})
```

## HTTP Server

```bash
npx spectrawl serve --port 3900
```

```
POST /search   { "query": "...", "summarize": true }
POST /browse   { "url": "...", "screenshot": true }
POST /act      { "platform": "github", "action": "create-issue", ... }
GET  /status   — auth account health
GET  /health   — server health
```

## MCP Server

Works with any MCP-compatible agent (Claude, Cursor, OpenClaw, LangChain):

```bash
npx spectrawl mcp
```

5 tools: `web_search`, `web_browse`, `web_act`, `web_auth`, `web_status`.

## CLI

```bash
npx spectrawl init              # create spectrawl.json
npx spectrawl search "query"    # search from terminal
npx spectrawl status            # check auth health
npx spectrawl serve             # start HTTP server
npx spectrawl mcp               # start MCP server
npx spectrawl install-stealth   # download Camoufox browser
```

## Configuration

`spectrawl.json`:

```json
{
  "search": {
    "cascade": ["gemini-grounded", "tavily", "brave"],
    "scrapeTop": 5
  },
  "cache": {
    "searchTtl": 3600,
    "scrapeTtl": 86400
  },
  "rateLimit": {
    "x": { "postsPerHour": 3 },
    "reddit": { "postsPerHour": 5 }
  }
}
```

## Environment Variables

```
GEMINI_API_KEY      Free — primary search + summarization (aistudio.google.com)
BRAVE_API_KEY       Brave Search (2,000 free/month)
SERPER_API_KEY      Serper.dev (2,500 trial queries)
GITHUB_TOKEN        For GitHub adapter
DEVTO_API_KEY       For Dev.to adapter
HF_TOKEN            For HuggingFace adapter
OPENAI_API_KEY      Alternative LLM for summarization
ANTHROPIC_API_KEY   Alternative LLM for summarization
```

## License

MIT

## Part of xanOS

Spectrawl is the web layer for [xanOS](https://github.com/FayAndXan/xanOS) — the autonomous content engine. Use it standalone or as part of the full stack.
