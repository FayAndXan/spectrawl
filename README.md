# Spectrawl

The unified web layer for AI agents. Search, browse, crawl, extract, and act on platforms — one package, self-hosted.

**5,000 free searches/month** via Gemini Grounded Search. Full page scraping, stealth browsing, multi-page crawling, structured extraction, AI browser agent, 24 platform adapters.

## What It Does

AI agents need to interact with the web — searching, browsing pages, crawling sites, logging into platforms, posting content. Today you wire together Playwright + a search API + cookie managers + platform-specific scripts. Spectrawl is one package that does all of it.

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

## Spectrawl vs Others

| | Tavily | Crawl4AI | Firecrawl | Stagehand | Spectrawl |
|---|---|---|---|---|---|
| Speed | ~2s | ~5s | ~3s | ~3s | ~6-10s |
| Free tier | 1,000/mo | Unlimited | 500/mo | None | 5,000/mo |
| Returns | Snippets + AI | Markdown | Markdown/JSON | Structured | Full page + structured |
| Self-hosted | No | Yes | Yes | Yes | Yes |
| Anti-detect | No | No | No | No | **Yes (Camoufox)** |
| Block detection | No | No | No | No | **8 services** |
| CAPTCHA solving | No | No | No | No | **Yes (Gemini Vision)** |
| Structured extraction | No | No | No | **Yes** | **Yes** |
| NL browser agent | No | No | No | **Yes** | **Yes** |
| Network capturing | No | Yes | No | No | **Yes** |
| Multi-page crawl | No | Yes | Yes | No | **Yes (+ sitemap)** |
| Platform posting | No | No | No | No | **24 adapters** |
| Auth management | No | No | No | No | **Cookie store + refresh** |

## Search

Two modes: **basic search** and **deep search**.

### Basic Search

```js
const results = await web.search('query')
```

Returns raw search results from the engine cascade. Fast, lightweight.

### Deep Search

```js
const results = await web.deepSearch('query', { summarize: true })
```

Full pipeline: query expansion → parallel search → merge/dedup → rerank → scrape top N → optional AI summary with citations.

### Search Engine Cascade

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
| Exa | 1,000/month | `EXA_API_KEY` | Available |
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

Stealth browsing with anti-detection. Three tiers (auto-escalation):

1. **Playwright + stealth plugin** — default, works immediately
2. **Camoufox binary** — engine-level anti-fingerprint (`npx spectrawl install-stealth`)
3. **Remote Camoufox** — for existing deployments

If tier 1 gets blocked, Spectrawl automatically escalates to tier 2 (if installed) or tier 3 (if configured). No manual intervention needed.

### Browse Options

```js
const page = await web.browse('https://example.com', {
  screenshot: true,    // Take a PNG screenshot
  fullPage: true,      // Full page screenshot (not just viewport)
  html: true,          // Return raw HTML alongside markdown
  stealth: true,       // Force stealth mode
  camoufox: true,      // Force Camoufox engine
  noCache: true,       // Bypass cache
  auth: 'reddit'       // Use stored auth cookies for this platform
})
```

### Browse Response

```js
{
  content: "# Page Title\n\nExtracted markdown content...",
  url: "https://example.com",
  title: "Page Title",
  statusCode: 200,
  cached: false,
  engine: "camoufox",            // which engine was used
  screenshot: Buffer<png>,        // PNG buffer (JS) or base64 (HTTP)
  html: "<html>...</html>",       // raw HTML (if html: true)
  blocked: false,                 // true if block page detected
  blockInfo: null                 // { type: 'cloudflare', detail: '...' }
}
```

### Block Page Detection

Spectrawl detects block/challenge pages from **8 anti-bot services** and reports them in the response instead of returning garbage HTML:

- **Cloudflare** (including RFC 9457 structured errors)
- **Akamai**
- **AWS WAF**
- **Imperva / Incapsula**
- **DataDome**
- **PerimeterX / HUMAN**
- **hCaptcha** challenges
- **reCAPTCHA** challenges
- Generic bot detection (403, "access denied", etc.)

When a block is detected, the response includes `blocked: true` and `blockInfo: { type, detail }`.

### Site-Specific Fallbacks

Some sites block all datacenter IPs regardless of stealth. Spectrawl automatically routes these through alternative APIs:

| Site | Problem | Fallback | Cost |
|------|---------|----------|------|
| **Reddit** | Blocks all datacenter IPs | [PullPush API](https://api.pullpush.io) — Reddit archive | Free |
| **Amazon** | CAPTCHA wall on product pages | [Jina Reader](https://r.jina.ai) — server-side rendering | Free |
| **X/Twitter** | Login wall on posts | [xAI Responses API](https://docs.x.ai) with `x_search` | ~$0.06/post |
| **LinkedIn** | HTTP 999, IP fingerprinting | Requires residential proxy (see below) | ~$7/GB |

These fallbacks activate automatically — just `browse()` the URL and Spectrawl picks the right path. No config needed for Reddit and Amazon. X requires `XAI_API_KEY` env var. LinkedIn requires a residential proxy.

#### LinkedIn: Why It's Different

LinkedIn fingerprints the IP where cookies were created. Even valid cookies get rejected from a different IP. Every free approach fails from datacenter servers:

- Direct browse: HTTP 999
- Voyager API with cookies: 401 (IP mismatch)
- Jina Reader: empty response
- Facebook/Googlebot UA: 317K of CSS, zero content

**The only working solution is a residential proxy.** We recommend [Bright Data](https://brightdata.com) for best results (72M+ residential IPs, ~99.7% success rate, dedicated social media unlockers). For budget use, [Smartproxy](https://smartproxy.com) ($7/GB, 55M IPs, 3-day free trial) works well at lower cost.

Setup:
```bash
# Bright Data (recommended)
npx spectrawl config set proxy '{"host":"brd.superproxy.io","port":22225,"username":"YOUR_ZONE_USER","password":"YOUR_PASS"}'

# Smartproxy (budget alternative)
npx spectrawl config set proxy '{"host":"gate.smartproxy.com","port":10001,"username":"YOUR_USER","password":"YOUR_PASS"}'

# Store your LinkedIn cookies (export from browser)
npx spectrawl login linkedin --account yourname --cookies ./linkedin-cookies.json

# Now browse LinkedIn normally
curl localhost:3900/browse -d '{"url":"https://www.linkedin.com/in/someone"}'
```

Other residential proxy providers that work:
- [IPRoyal](https://iproyal.com) — $7/GB, 32M IPs
- [Bright Data](https://brightdata.com) — premium quality, higher cost
- [Oxylabs](https://oxylabs.io) — enterprise-grade

> ⚠️ **Avoid WebShare** — recycled datacenter IPs marketed as residential, no HTTPS support.

### CAPTCHA Solving

Built-in CAPTCHA solver using **Gemini Vision** (free tier: 1,500 req/day):

- ✅ Image CAPTCHAs
- ✅ Text/math CAPTCHAs
- ✅ Simple visual challenges
- ❌ reCAPTCHA v2/v3 (requires token solving services)
- ❌ hCaptcha (requires token solving services)
- ❌ Cloudflare Turnstile (requires token solving services)

The solver automatically detects CAPTCHA type and attempts resolution before returning the page.

## Extract — Structured Data Extraction

Pull structured data from any page using LLM + optional CSS/XPath selectors. Like Stagehand's `extract()` but self-hosted and integrated with Spectrawl's anti-detect browsing.

### Basic Extraction

```js
const result = await web.extract('https://news.ycombinator.com', {
  instruction: 'Extract the top 3 story titles and their point counts',
  schema: {
    type: 'object',
    properties: {
      stories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            points: { type: 'number' }
          }
        }
      }
    }
  }
})
// result.data = { stories: [{ title: "...", points: 210 }, ...] }
```

### HTTP API

```bash
curl -X POST http://localhost:3900/extract \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "instruction": "Extract the page title and main heading",
    "schema": {"type": "object", "properties": {"title": {"type": "string"}, "heading": {"type": "string"}}}
  }'
```

Response:
```json
{
  "data": { "title": "Example Domain", "heading": "Example Domain" },
  "url": "https://example.com",
  "title": "Example Domain",
  "contentLength": 129,
  "duration": 679
}
```

### Targeted Extraction with Selectors

Narrow extraction scope using CSS or XPath selectors — reduces tokens and improves accuracy:

```js
const result = await web.extract('https://news.ycombinator.com', {
  instruction: 'Extract all story titles',
  selector: '.titleline',  // CSS selector
  // or: selector: 'xpath=//table[@class="itemlist"]'
  schema: { type: 'object', properties: { titles: { type: 'array', items: { type: 'string' } } } }
})
```

### Relevance Filtering (BM25)

For large pages, filter content by relevance before sending to the LLM — saves tokens:

```js
const result = await web.extract('https://en.wikipedia.org/wiki/Node.js', {
  instruction: 'Extract the creator and release date',
  relevanceFilter: true   // BM25 scoring keeps only relevant sections
})
// Content reduced from 50K+ chars to ~2K relevant chars
```

### Extract from Content (No Browsing)

Already have the content? Skip the browse step:

```js
const result = await web.extractFromContent(markdownContent, {
  instruction: 'Extract all email addresses',
  schema: { type: 'object', properties: { emails: { type: 'array', items: { type: 'string' } } } }
})
```

Uses Gemini Flash (free) by default. Falls back to OpenAI if configured.

## Agent — Natural Language Browser Actions

Control a browser with natural language. Navigate, click, type, scroll — the LLM interprets the page and decides what to do.

```js
const result = await web.agent('https://example.com', 'click the More Information link', {
  maxSteps: 5,       // max actions to take
  screenshot: true   // screenshot after completion
})
// result.success = true
// result.url = "https://www.iana.org/domains/reserved" (navigated!)
// result.steps = [{ step: 1, action: "click", elementIdx: 0, result: "clicked" }, ...]
```

### HTTP API

```bash
curl -X POST http://localhost:3900/agent \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "instruction": "click the More Information link", "maxSteps": 3}'
```

Response:
```json
{
  "success": true,
  "url": "https://www.iana.org/domains/reserved",
  "title": "IANA — Reserved Domains",
  "steps": [
    { "step": 1, "action": "click", "elementIdx": 0, "reason": "clicking the More Information link", "result": "clicked" }
  ],
  "content": "...",
  "duration": 5200
}
```

### Supported Actions

The agent can: **click**, **type** (fill inputs), **select** (dropdowns), **press** (keyboard keys), **scroll** (up/down).

## Network Request Capturing

Capture XHR/fetch requests made by a page during browsing — useful for discovering hidden APIs:

```js
const result = await web.browse('https://example.com', {
  captureNetwork: true,
  captureNetworkHeaders: true,  // include request headers
  captureNetworkBody: true      // include response bodies (<50KB)
})
// result.networkRequests = [
//   { url: "https://api.example.com/data", method: "GET", status: 200, contentType: "application/json", body: "..." }
// ]
```

### HTTP API

```bash
curl -X POST http://localhost:3900/browse \
  -d '{"url": "https://example.com", "captureNetwork": true, "captureNetworkBody": true}'
```

## Screenshots

Take screenshots of any page via browse:

### JavaScript

```js
const result = await web.browse('https://example.com', {
  screenshot: true,
  fullPage: true       // optional: capture entire page, not just viewport
})
// result.screenshot is a PNG Buffer
fs.writeFileSync('screenshot.png', result.screenshot)
```

### HTTP API

```bash
curl -X POST http://localhost:3900/browse \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "screenshot": true, "fullPage": true}'
```

Response:
```json
{
  "content": "# Page Title\n\nExtracted markdown...",
  "url": "https://example.com",
  "title": "Page Title",
  "screenshot": "iVBORw0KGgo...base64-encoded-png...",
  "cached": false
}
```

> **Note:** Screenshots bypass the cache — each request renders a fresh page.

## Crawl

Multi-page website crawler with automatic RAM-based parallelization.

```js
const result = await web.crawl('https://docs.example.com', {
  depth: 2,              // how many link levels to follow
  maxPages: 50,          // stop after N pages
  format: 'markdown',    // 'markdown' or 'html'
  scope: 'domain',       // 'domain' | 'subdomain' | 'path'
  concurrency: 'auto',   // auto-detect from available RAM, or set a number
  merge: true,           // merge all pages into one document
  includePatterns: [],   // regex patterns to include
  excludePatterns: [],   // regex patterns to skip
  delay: 300,            // ms between batch launches (politeness)
  stealth: true          // use anti-detect browsing
})
```

### Crawl Response

```js
{
  pages: [
    { url: 'https://docs.example.com/', content: '...', title: '...', statusCode: 200 },
    { url: 'https://docs.example.com/guide', content: '...', title: '...', statusCode: 200 },
    // ...
  ],
  stats: {
    pagesScraped: 23,
    duration: 45000,
    concurrency: 4
  }
}
```

### Sitemap-Based Crawling

Spectrawl auto-discovers `sitemap.xml` and pre-seeds the crawl queue — much faster than link-following for documentation sites:

```js
const result = await web.crawl('https://docs.example.com', {
  useSitemap: true,  // enabled by default
  maxPages: 20
})
// [crawl] Found sitemap at https://docs.example.com/sitemap.xml with 82 URLs
// [crawl] Pre-seeded 20 URLs from sitemap
```

Set `useSitemap: false` to disable and rely only on link discovery.

### Webhook Notifications

Get notified when a crawl completes:

```bash
curl -X POST http://localhost:3900/crawl \
  -d '{"url": "https://docs.example.com", "maxPages": 50, "webhook": "https://your-server.com/webhook"}'
```

Spectrawl will POST the full crawl result to your webhook URL when finished.

### Async Crawl Jobs

For large sites, use async mode to avoid HTTP timeouts:

```bash
# Start a crawl job (returns immediately)
curl -X POST http://localhost:3900/crawl \
  -d '{"url": "https://docs.example.com", "depth": 3, "maxPages": 100, "async": true}'
# Response: { "jobId": "abc123", "status": "running" }

# Check job status
curl http://localhost:3900/crawl/abc123

# List all jobs
curl http://localhost:3900/crawl/jobs

# Check system capacity
curl http://localhost:3900/crawl/capacity
```

### RAM-Based Auto-Parallelization

Spectrawl estimates ~250MB per browser tab and calculates safe concurrency from available system RAM:

- **8GB server:** ~4 concurrent tabs
- **16GB server:** ~8 concurrent tabs
- **32GB server:** 10 concurrent tabs (capped)

## Auth

Persistent cookie storage (SQLite), multi-account management, automatic expiry detection.

```js
// Add account
await web.auth.add('x', { account: '@myhandle', method: 'cookie', cookies })

// Check health
const accounts = await web.auth.getStatus()
// [{ platform: 'x', account: '@myhandle', status: 'valid', expiresAt: '...' }]
```

Cookie refresh cron fires events before accounts go stale (see [Events](#events)).

## Events

Spectrawl emits events for auth state changes, rate limits, and action results. Subscribe to stay informed:

```js
const { EVENTS } = require('spectrawl')

web.on(EVENTS.COOKIE_EXPIRING, (data) => {
  console.log(`Cookie expiring for ${data.platform}:${data.account}`)
})

web.on(EVENTS.RATE_LIMITED, (data) => {
  console.log(`Rate limited on ${data.platform}`)
})

// Wildcard — catch everything
web.on('*', ({ event, ...data }) => {
  console.log(`Event: ${event}`, data)
})
```

### Available Events

| Event | When |
|---|---|
| `cookie_expiring` | Cookie approaching expiry |
| `cookie_expired` | Cookie has expired |
| `auth_failed` | Authentication attempt failed |
| `auth_refreshed` | Cookie successfully refreshed |
| `rate_limited` | Platform rate limit hit |
| `action_failed` | Platform action failed |
| `action_success` | Platform action succeeded |
| `health_check` | Periodic health check result |

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

Spectrawl ranks results by domain trust — something most search tools don't do:

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

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/search` | Search the web |
| `POST` | `/browse` | Stealth browse a URL |
| `POST` | `/crawl` | Crawl a website (sync or async) |
| `POST` | `/extract` | Structured data extraction with LLM |
| `POST` | `/agent` | Natural language browser actions |
| `POST` | `/act` | Platform actions |
| `GET` | `/status` | Auth account health |
| `GET` | `/health` | Server health |
| `GET` | `/crawl/jobs` | List async crawl jobs |
| `GET` | `/crawl/:jobId` | Get crawl job status/results |
| `GET` | `/crawl/capacity` | System crawl capacity |

### Request / Response Examples

#### POST /search

```bash
curl -X POST http://localhost:3900/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "best headless browsers 2026", "summarize": true}'
```

Response:
```json
{
  "sources": [
    {
      "title": "Top Headless Browsers in 2026",
      "url": "https://example.com/article",
      "snippet": "Short snippet from search...",
      "content": "Full page markdown content (if scraped)...",
      "source": "gemini-grounded",
      "confidence": 0.95
    }
  ],
  "answer": "AI-generated summary with [1] citations... (only if summarize: true)",
  "cached": false
}
```

#### POST /browse

```bash
curl -X POST http://localhost:3900/browse \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "screenshot": true, "fullPage": true}'
```

Response:
```json
{
  "content": "# Example Domain\n\nThis domain is for use in illustrative examples...",
  "url": "https://example.com",
  "title": "Example Domain",
  "statusCode": 200,
  "screenshot": "iVBORw0KGgoAAAANSUhEUg...base64...",
  "cached": false,
  "engine": "playwright"
}
```

#### POST /crawl

```bash
curl -X POST http://localhost:3900/crawl \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://docs.example.com", "depth": 2, "maxPages": 10}'
```

Response:
```json
{
  "pages": [
    {
      "url": "https://docs.example.com/",
      "content": "# Docs Home\n\n...",
      "title": "Documentation",
      "statusCode": 200
    }
  ],
  "stats": {
    "pagesScraped": 8,
    "duration": 12000,
    "concurrency": 4
  }
}
```

#### POST /act

```bash
curl -X POST http://localhost:3900/act \
  -H 'Content-Type: application/json' \
  -d '{"platform": "github", "action": "create-issue", "repo": "user/repo", "title": "Bug", "body": "Details..."}'
```

#### Error Responses

All errors follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details format:

```json
{
  "type": "https://spectrawl.dev/errors/rate-limited",
  "status": 429,
  "title": "rate limited",
  "detail": "Reddit rate limit: max 3 posts per hour",
  "retryable": true
}
```

Error types: `bad-request` (400), `unauthorized` (401), `forbidden` (403), `not-found` (404), `rate-limited` (429), `internal-error` (500), `upstream-error` (502), `service-unavailable` (503).

## Proxy Configuration

Route browsing through residential or datacenter proxies. **Required for LinkedIn** — see [Site-Specific Fallbacks](#site-specific-fallbacks) for why.

```json
{
  "browse": {
    "proxy": {
      "host": "gate.smartproxy.com",
      "port": 10001,
      "username": "YOUR_USER",
      "password": "YOUR_PASS"
    }
  }
}
```

The proxy is used for all Playwright and Camoufox browsing sessions. You can also start a local rotating proxy server that rotates through multiple upstream proxies:

```bash
npx spectrawl proxy --port 8080
```

**Recommended providers:**

| Provider | Price | IPs | Best For |
|----------|-------|-----|----------|
| [Bright Data](https://brightdata.com) | $12+/GB | 72M | ⭐ Best quality, ~99.7% success, social unlockers |
| [Smartproxy](https://smartproxy.com) | $7/GB | 55M | Best budget option, 3-day free trial |
| [IPRoyal](https://iproyal.com) | $7/GB | 32M | Good alternative |
| [Oxylabs](https://oxylabs.io) | $10+/GB | 100M+ | Enterprise-grade |

## MCP Server

Works with any MCP-compatible agent (Claude, Cursor, OpenClaw, LangChain):

```bash
npx spectrawl mcp
```

### MCP Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `web_search` | Search the web | `query`, `summarize`, `scrapeTop`, `minResults` |
| `web_browse` | Stealth browse a URL | `url`, `auth`, `screenshot`, `html` |
| `web_act` | Platform action | `platform`, `action`, `account`, `text`, `title` |
| `web_auth` | Manage auth | `action` (list/add/remove), `platform`, `account` |
| `web_status` | Check auth health | — |

## CLI

```bash
npx spectrawl init              # create spectrawl.json
npx spectrawl search "query"    # search from terminal
npx spectrawl status            # check auth health
npx spectrawl serve             # start HTTP server
npx spectrawl mcp               # start MCP server
npx spectrawl proxy             # start rotating proxy server
npx spectrawl install-stealth   # download Camoufox browser
npx spectrawl version           # show version
```

## Configuration

`spectrawl.json` — full defaults:

```json
{
  "port": 3900,
  "concurrency": 3,
  "search": {
    "cascade": ["gemini-grounded", "tavily", "brave"],
    "scrapeTop": 5
  },
  "browse": {
    "defaultEngine": "playwright",
    "proxy": null,
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

### Human-like Browsing

Spectrawl simulates human browsing patterns by default:

- **Random delays** between page loads (500-2000ms)
- **Scroll behavior** simulation
- **Random viewport sizes** from common resolutions
- Configurable via `browse.humanlike`

## Environment Variables

```
GEMINI_API_KEY      Free — primary search + summarization (aistudio.google.com)
BRAVE_API_KEY       Brave Search (2,000 free/month)
TAVILY_API_KEY      Tavily Search (1,000 free/month)
SERPER_API_KEY      Serper.dev (2,500 trial queries)
EXA_API_KEY         Exa Search (1,000 free/month, neural + content retrieval)
GITHUB_TOKEN        For GitHub adapter
DEVTO_API_KEY       For Dev.to adapter
HF_TOKEN            For HuggingFace adapter
OPENAI_API_KEY      Alternative LLM for summarization
ANTHROPIC_API_KEY   Alternative LLM for summarization
```

## License

MIT
