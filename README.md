# Spectrawl

The unified web layer for AI agents. Search, browse, authenticate, and act on platforms — one package, self-hosted.

**5,000 free searches/month** via Gemini Grounded Search. Full page scraping, stealth browsing, 24 platform adapters.

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

// Basic search — raw results, no scraping
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
| Platform posting | No | 24 adapters |
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

### Search vs Deep Search

| Method | JS API | HTTP API | What it does |
|--------|--------|----------|--------------|
| **Search** | `web.search(query)` | `POST /search` | Cascade through engines, return snippets + URLs |
| **Deep Search** | `web.deepSearch(query)` | `POST /search { mode: "deep" }` | Search + scrape top results for full content |

**Search response:**

```json
{
  "results": [
    {
      "title": "How to build an MCP server",
      "url": "https://example.com/mcp-guide",
      "snippet": "A step-by-step guide...",
      "source": "gemini-grounded",
      "confidence": 0.95
    }
  ],
  "cached": false
}
```

**Deep Search response:**

```json
{
  "sources": [
    {
      "title": "How to build an MCP server",
      "url": "https://example.com/mcp-guide",
      "snippet": "A step-by-step guide...",
      "fullContent": "# How to Build an MCP Server\n\nThe Model Context Protocol...",
      "confidence": 0.95
    }
  ],
  "answer": "To build an MCP server... [1] [2]",
  "cached": false
}
```

> `answer` is `null` unless `summarize: true` is passed.

### What you get without any keys

DDG-only search, raw results, no AI answer. Works from home IPs. Datacenter IPs get rate-limited by DDG — recommend at minimum a free Gemini key.

## Browse

Stealth browsing with anti-detection. Three tiers (auto-escalation):

1. **Playwright + stealth plugin** — default, works immediately
2. **Camoufox binary** — engine-level anti-fingerprint (`npx spectrawl install-stealth`)
3. **Remote Camoufox** — for existing deployments

**Auto-escalation:** If Playwright gets blocked (CAPTCHA, Cloudflare, 403), Spectrawl automatically retries with Camoufox if installed. No config needed.

```js
const page = await web.browse('https://example.com')
console.log(page.content)       // extracted text/markdown
console.log(page.title)         // page title
console.log(page.url)           // final URL (after redirects)
```

### Browse Options

```js
const page = await web.browse('https://example.com', {
  screenshot: true,    // capture PNG screenshot
  fullPage: true,      // full page screenshot (not just viewport)
  html: true,          // return raw HTML in addition to markdown
  auth: 'reddit',      // use stored auth cookies for this platform
  stealth: true,       // force stealth browser mode
  camoufox: true,      // force Camoufox engine (skip Playwright)
  noCache: true        // bypass cache, always fetch fresh
})
```

### Browse Response

```json
{
  "content": "# Example Domain\n\nThis domain is for use in documentation...",
  "url": "https://example.com/",
  "title": "Example Domain",
  "statusCode": 200,
  "engine": "camoufox",
  "cached": false,
  "screenshot": "iVBORw0KGgo... (base64 PNG, only if requested)",
  "html": "<html>... (only if html: true)"
}
```

Auto-fallback: if Jina and readability return too little content (<200 chars), Spectrawl renders the page with Playwright and extracts from the rendered DOM. Tavily can't do this — they fail on JS-heavy pages.

## Screenshots

Take screenshots of any page with anti-detection:

**HTTP:**
```bash
curl -X POST http://localhost:3900/browse \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "screenshot": true}'
```

Response includes `screenshot` as a **base64-encoded PNG string**.

**JS:**
```js
const page = await web.browse('https://example.com', { screenshot: true })
// page.screenshot is a Buffer (Node.js) — write to file or encode
fs.writeFileSync('screenshot.png', page.screenshot)
```

**Full page screenshot:**
```js
const page = await web.browse('https://example.com', {
  screenshot: true,
  fullPage: true  // captures entire scrollable page, not just viewport
})
```

> Screenshots bypass the cache — a fresh page load is always performed.

## Anti-Bot Detection

Spectrawl handles bot detection automatically:

```
Request → Playwright + stealth plugin
  → Blocked? → Retry with Camoufox (if installed)
  → Still blocked? → Error with actionable hint
```

**Detection triggers:** CAPTCHA, Cloudflare challenges, 403 Forbidden, "Access Denied", bot detection pages.

**Stealth features:**
- Randomized viewport sizes (1920×1080, 1536×864, 1440×900, 1366×768)
- Human-like delays (500-2000ms between actions)
- Scroll behavior simulation
- Camoufox engine-level anti-fingerprinting (when installed)
- Proxy support for residential IPs

**Install Camoufox for maximum stealth:**
```bash
npx spectrawl install-stealth
```

## CAPTCHA Solving

Built-in CAPTCHA solver using Gemini Vision (free tier: 1,500 req/day):

- Detects image CAPTCHAs, text CAPTCHAs, and simple challenges automatically
- Uses `gemini-2.0-flash` by default
- Does **not** handle reCAPTCHA v2/v3, hCaptcha, or Cloudflare Turnstile (those require token solving services)

The solver is used automatically when a CAPTCHA is detected during browsing. No configuration needed if `GEMINI_API_KEY` is set.

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

## Proxy Support

Configure a proxy for all browse requests:

**spectrawl.json:**
```json
{
  "browse": {
    "proxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "username": "user",
      "password": "pass"
    }
  }
}
```

**Rotating proxy server** (built-in):
```bash
npx spectrawl proxy --port 8080
```

The proxy is applied to all Playwright and Camoufox browser contexts automatically.

## Act — 24 Platform Adapters

Post to 24+ platforms with one API:

```js
await web.act('github', 'create-issue', { repo: 'user/repo', title: 'Bug report', body: '...' })
await web.act('reddit', 'post', { subreddit: 'node', title: '...', text: '...' })
await web.act('devto', 'post', { title: '...', body: '...', tags: ['ai'] })
await web.act('huggingface', 'create-repo', { name: 'my-model', type: 'model' })
```

**Live tested:** GitHub ✅, Reddit ✅, Dev.to ✅, HuggingFace ✅, X (reads) ✅

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
| **14 Directories** | Generic adapter | submit |

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

## Events

Spectrawl emits events for auth state changes and rate limiting. Useful for agents that need to react to credential issues:

```js
const web = new Spectrawl()

web.on('cookie_expiring', (data) => {
  console.log(`⚠️ ${data.platform} cookies expiring soon`)
})

web.on('cookie_expired', (data) => {
  console.log(`❌ ${data.platform} cookies expired — re-auth needed`)
})

web.on('rate_limited', (data) => {
  console.log(`🚫 Rate limited on ${data.platform}`)
})

// Wildcard handler — catch all events
web.on('*', ({ event, ...data }) => {
  console.log(`Event: ${event}`, data)
})
```

**Available events:**

| Event | When |
|-------|------|
| `cookie_expiring` | Stored cookies approaching expiry |
| `cookie_expired` | Cookies have expired |
| `auth_failed` | Authentication attempt failed |
| `auth_refreshed` | Cookies successfully refreshed |
| `rate_limited` | Platform rate limit hit |
| `action_failed` | Platform action (post, comment) failed |
| `action_success` | Platform action succeeded |
| `health_check` | Periodic auth health check completed |

## HTTP Server

```bash
npx spectrawl serve --port 3900
```

### Endpoints

#### `POST /search`

Search the web.

```json
{
  "query": "best headless browsers 2026",
  "summarize": true,
  "scrapeTop": 5,
  "minResults": 5
}
```

**Response:**
```json
{
  "sources": [
    {
      "title": "Best Headless Browsers",
      "url": "https://example.com/article",
      "snippet": "A comparison of...",
      "fullContent": "# Best Headless Browsers\n\n...",
      "source": "gemini-grounded",
      "confidence": 0.96
    }
  ],
  "answer": "The best headless browsers in 2026 are... [1]",
  "cached": false
}
```

#### `POST /browse`

Browse a URL with stealth anti-detection.

```json
{
  "url": "https://example.com",
  "screenshot": true,
  "fullPage": false,
  "html": false,
  "auth": "reddit",
  "stealth": true
}
```

**Response:**
```json
{
  "content": "# Example Domain\n\nThis domain is for use in...",
  "url": "https://example.com/",
  "title": "Example Domain",
  "statusCode": 200,
  "engine": "camoufox",
  "cached": false,
  "screenshot": "iVBORw0KGgoAAAANSUhEUg... (base64 PNG)"
}
```

#### `POST /act`

Perform an authenticated platform action.

```json
{
  "platform": "github",
  "action": "create-issue",
  "repo": "user/repo",
  "title": "Bug report",
  "body": "Steps to reproduce..."
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://github.com/user/repo/issues/42",
  "id": "42"
}
```

#### `GET /status`

Check auth account health.

**Response:**
```json
{
  "accounts": [
    {
      "platform": "x",
      "account": "@myhandle",
      "status": "valid",
      "expiresAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

#### `GET /health`

Server health check.

**Response:**
```json
{
  "status": "ok",
  "version": "0.5.0"
}
```

### Error Responses

All errors follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (Problem Details for HTTP APIs):

```json
{
  "type": "https://spectrawl.dev/errors/bad-request",
  "status": 400,
  "title": "bad request",
  "detail": "query is required"
}
```

| Status | Type | When |
|--------|------|------|
| 400 | `bad-request` | Missing required parameters |
| 401 | `unauthorized` | Invalid or missing auth |
| 403 | `forbidden` | Access denied |
| 404 | `not-found` | Unknown endpoint |
| 429 | `rate-limited` | Platform rate limit exceeded |
| 500 | `internal-error` | Server error |
| 502 | `upstream-error` | Target site error |
| 503 | `service-unavailable` | Service temporarily unavailable |

## MCP Server

Works with any MCP-compatible agent (Claude, Cursor, OpenClaw, LangChain):

```bash
npx spectrawl mcp
```

### MCP Tools

#### `web_search`
Search the web using the engine cascade.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query |
| `summarize` | boolean | | Generate LLM summary with citations |
| `scrapeTop` | number | | Number of top results to scrape (default: 3) |
| `minResults` | number | | Minimum results before trying next engine (default: 5) |

#### `web_browse`
Browse a URL with stealth anti-detection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | ✅ | URL to browse |
| `auth` | string | | Platform name for stored auth (e.g. "reddit") |
| `screenshot` | boolean | | Take a screenshot |
| `html` | boolean | | Return raw HTML |
| `stealth` | boolean | | Force stealth browser mode |

#### `web_act`
Perform an authenticated platform action.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | string | ✅ | Platform name (x, reddit, devto, hashnode, linkedin, ih) |
| `action` | string | ✅ | Action (post, comment, like, delete) |
| `account` | string | | Account handle (e.g. @myhandle) |
| `text` | string | | Text content |
| `title` | string | | Title (Reddit/Dev.to) |
| `subreddit` | string | | Subreddit name (Reddit only) |
| `tags` | string[] | | Tags (Dev.to only) |

#### `web_auth`
Manage platform authentication.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | ✅ | Auth action (list, add, remove) |
| `platform` | string | | Platform name |
| `account` | string | | Account handle |

#### `web_status`
Check health status of all authenticated accounts. No parameters.

## CLI

```bash
npx spectrawl init              # create spectrawl.json
npx spectrawl search "query"    # search from terminal
npx spectrawl status            # check auth health
npx spectrawl serve             # start HTTP server
npx spectrawl mcp               # start MCP server
npx spectrawl install-stealth   # download Camoufox browser
npx spectrawl proxy             # start rotating proxy server
```

## Configuration

`spectrawl.json` — all fields are optional, defaults shown:

```json
{
  "port": 3900,
  "concurrency": 3,
  "search": {
    "cascade": ["gemini-grounded", "tavily", "brave"],
    "scrapeTop": 5,
    "searxng": { "url": "http://localhost:8888" },
    "llm": null
  },
  "browse": {
    "defaultEngine": "playwright",
    "proxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "username": "user",
      "password": "pass"
    },
    "humanlike": {
      "minDelay": 500,
      "maxDelay": 2000,
      "scrollBehavior": true
    }
  },
  "auth": {
    "refreshInterval": "4h",
    "cookieStore": "./data/cookies.db"
  },
  "cache": {
    "path": "./data/cache.db",
    "searchTtl": 3600,
    "scrapeTtl": 86400,
    "screenshotTtl": 3600
  },
  "rateLimit": {
    "x": { "postsPerHour": 5, "minDelayMs": 30000 },
    "reddit": { "postsPerHour": 3, "minDelayMs": 600000 }
  }
}
```

| Config | What it does |
|--------|-------------|
| `concurrency` | Max parallel browser contexts (default: 3) |
| `browse.humanlike` | Delays and scroll behavior to mimic human browsing |
| `browse.proxy` | Route all browse requests through a proxy |
| `cache.searchTtl` | Search cache lifetime in seconds (default: 1h) |
| `cache.scrapeTtl` | Page scrape cache lifetime (default: 24h) |
| `cache.screenshotTtl` | Screenshot cache lifetime (default: 1h) |
| `auth.refreshInterval` | How often to check cookie health (default: 4h) |
| `rateLimit.*` | Per-platform rate limits for `/act` |

## Environment Variables

```
GEMINI_API_KEY      Free — primary search + summarization + CAPTCHA solving (aistudio.google.com)
BRAVE_API_KEY       Brave Search (2,000 free/month)
TAVILY_API_KEY      Tavily Search (1,000 free/month)
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
