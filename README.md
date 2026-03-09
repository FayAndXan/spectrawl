# Spectrawl

The unified web layer for AI agents. Search, browse, authenticate, and act on platforms — one tool, self-hosted, free.

**Free Tavily alternative** with Google-quality results via Gemini Grounded Search.

## What It Does

AI agents need to interact with the web. That means searching, browsing pages, logging into platforms, and posting content. Today you duct-tape together Playwright + Tavily + cookie managers + platform-specific scripts. Spectrawl replaces all of that.

```
npm install spectrawl
```

## Quick Start

```bash
npm install spectrawl
export GEMINI_API_KEY=your-free-key  # Get one at aistudio.google.com
```

```js
const { Spectrawl } = require('spectrawl')
const web = new Spectrawl()

// Deep search — like Tavily but free
const result = await web.deepSearch('best AI agent frameworks 2025')
console.log(result.answer)    // AI-generated answer with citations
console.log(result.sources)   // [{ title, url, content, score }]

// Fast mode — snippets only, ~6s
const fast = await web.deepSearch('query', { mode: 'fast' })

// Basic search — raw results, no AI
const basic = await web.search('query')
```

### vs Tavily

| | Tavily | Spectrawl |
|---|---|---|
| Speed | ~2s | ~6-9s |
| Search quality | Google index | Google via Gemini ✅ |
| Results per query | 10 | 12-16 ✅ |
| Citations | ✅ | ✅ |
| Cost | $0.01/query | **Free** ✅ |
| Self-hosted | No | **Yes** ✅ |
| Stealth scraping | No | **Yes** ✅ |
| Auth + posting | No | **24 adapters** ✅ |
| Cached repeats | No | **<1ms** ✅ |

## Search

Default cascade: **Gemini Grounded → Brave → DDG**

Gemini Grounded Search gives you Google-quality results through the Gemini API. Free tier: 5,000 grounded queries/month.

| Engine | Free Tier | Key Required | Default |
|--------|-----------|-------------|---------|
| **Gemini Grounded** | 5,000/month | `GEMINI_API_KEY` | ✅ Primary |
| Brave | 2,000/month | `BRAVE_API_KEY` | ✅ Fallback |
| DuckDuckGo | Unlimited | None | ✅ Last resort |
| Bing | Unlimited | None | Available |
| Serper | 2,500 trial | `SERPER_API_KEY` | Available |
| Google CSE | 100/day | `GOOGLE_CSE_KEY` | Available |
| Jina Reader | Unlimited | None | Available |
| SearXNG | Unlimited | Self-hosted | Available |

### Deep Search Pipeline

```
Query → Gemini Grounded + DDG (parallel)
  → Merge & deduplicate (12-16 results)
  → Source quality ranking (boost GitHub/SO/Reddit, penalize SEO spam)
  → Parallel scraping (Jina → readability → Playwright fallback)
  → AI summarization with [1] [2] citations
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

// With screenshot
const page = await web.browse('https://example.com', { screenshot: true })
```

Auto-fallback: if Jina and readability return too little content (<200 chars), Spectrawl renders the page with Playwright and extracts from the rendered DOM. Tavily can't do this — they fail on JS-heavy pages.

## Auth

Persistent cookie storage (SQLite), multi-account management, automatic refresh.

```js
// Store cookies
await web.auth.setCookies('x', '@myhandle', cookies)

// Check health
const accounts = await web.status()
// [{ platform: 'x', account: '@myhandle', status: 'valid', expiresAt: '...' }]
```

## Act — 24 Platform Adapters

Post to 30+ platforms with one API:

```js
await web.act('x', 'post', { text: 'Hello from Spectrawl', account: '@myhandle' })
await web.act('reddit', 'post', { subreddit: 'node', title: '...', text: '...' })
await web.act('github', 'create-repo', { name: 'my-repo', description: '...' })
```

| Platform | Auth Method | Actions |
|----------|-------------|---------|
| X/Twitter | GraphQL Cookie + OAuth 1.0a | post |
| Reddit | Cookie API (oauth.reddit.com) | post, comment |
| Dev.to | REST API | post |
| Hashnode | GraphQL API | post |
| LinkedIn | Cookie API (Voyager) | post |
| IndieHackers | Browser automation | post, comment, upvote |
| Medium | REST API | post (markdown) |
| GitHub | REST v3 | repo, file, issue, release |
| Discord | Bot API + webhooks | send, thread |
| Product Hunt | GraphQL v2 | launch, comment, upvote |
| Hacker News | Cookie/form POST | submit, comment, upvote |
| YouTube | Data API v3 | comment, playlist |
| Quora | Browser automation | answer, question |
| HuggingFace | Hub API | repo, model card, upload |
| BetaList | REST API | submit |
| AlternativeTo | Browser automation | submit |
| SaaSHub | Browser automation | submit |
| DevHunt | Browser automation | submit |
| **14 Directories** | Generic adapter | submit |

Built-in rate limiting, content dedup (MD5, 24h window), and dead letter queue for retries.

## Source Quality Ranking

Spectrawl ranks results by domain trust — something Tavily doesn't do:

- **Boosted:** GitHub, StackOverflow, HN, Reddit, MDN, arxiv, Wikipedia
- **Penalized:** SEO farms, thin content sites, tag/category pages
- **Customizable:** bring your own domain weights

```js
const web = new Spectrawl({
  search: {
    sourceRanker: {
      boost: ['github.com', 'news.ycombinator.com'],
      block: ['spamsite.com']
    }
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
POST /act      { "platform": "x", "action": "post", "params": { ... } }
GET  /status
GET  /health
```

## MCP Server

Works with any MCP-compatible agent framework (Claude, OpenAI, etc.):

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
    "cascade": ["gemini-grounded", "brave", "ddg"],
    "scrapeTop": 3
  },
  "cache": {
    "searchTtl": 3600,
    "scrapeTtl": 86400
  },
  "proxy": {
    "localPort": 8080,
    "strategy": "round-robin",
    "upstreams": [
      { "url": "http://user:pass@proxy.example.com:8080" }
    ]
  },
  "rateLimit": {
    "x": { "postsPerHour": 3 },
    "reddit": { "postsPerHour": 5 }
  }
}
```

## Environment Variables

```
GEMINI_API_KEY      Gemini API key (free — primary search + summarization)
BRAVE_API_KEY       Brave Search API key (2,000 free/month)
SERPER_API_KEY      Serper.dev API key
GOOGLE_CSE_KEY      Google Custom Search API key
GOOGLE_CSE_CX       Google Custom Search engine ID
JINA_API_KEY        Jina Reader API key (optional)
OPENAI_API_KEY      For LLM summarization (alternative to Gemini)
ANTHROPIC_API_KEY   For LLM summarization (alternative to Gemini)
```

## License

MIT

## Part of xanOS

Spectrawl is the web layer for [xanOS](https://github.com/FayAndXan/xanOS) — the autonomous content engine. Use it standalone or as part of the full stack.
