# Spectrawl

The unified web layer for AI agents. Search, browse, authenticate, and act on platforms — one tool, self-hosted, free.

## What It Does

AI agents need to interact with the web. That means searching, browsing pages, logging into platforms, and posting content. Today you duct-tape together Playwright + Tavily + cookie managers + platform-specific scripts. Spectrawl replaces all of that.

```
npm install spectrawl
```

**Search** — 6 engines in a cascade: SearXNG → DuckDuckGo → Brave → Serper → Google CSE → Jina. Tries free/unlimited first, falls through to quota-based. Dual scraping (Jina Reader + readability). Optional LLM summarization.

**Browse** — Stealth browsing with anti-detection out of the box. Three tiers:
1. `playwright-extra` + stealth plugin (default, works immediately)
2. Camoufox binary — engine-level anti-fingerprint (`npx spectrawl install-stealth`)
3. Remote Camoufox service (for existing deployments)

**Auth** — Persistent cookie storage (SQLite), multi-account management, automatic cookie refresh, expiry alerts.

**Act** — Post to X, Reddit, Dev.to, Hashnode, LinkedIn, IndieHackers. Rate limiting, content dedup, dead letter queue for retries.

## Quick Start

```bash
npm install spectrawl
npx spectrawl init          # create spectrawl.json config
npx spectrawl search "your query"
```

### As a Library

```js
const { Spectrawl } = require('spectrawl')
const web = new Spectrawl()

// Search
const results = await web.search('best practices for node.js APIs')
console.log(results.sources)      // [{ url, title, snippet, content }]
console.log(results.answer)       // LLM summary (if configured)

// Browse with stealth
const page = await web.browse('https://example.com')
console.log(page.content)         // extracted text
console.log(page.engine)          // 'stealth-playwright' or 'camoufox'

// Act on platforms
await web.act('x', 'post', {
  text: 'Hello from Spectrawl',
  account: '@myhandle'
})

// Check auth health
const accounts = await web.status()
// [{ platform: 'x', account: '@myhandle', status: 'valid', expiresAt: '...' }]
```

### HTTP Server

```bash
npx spectrawl serve --port 3900
```

```
POST /search   { "query": "...", "summarize": true }
POST /browse   { "url": "...", "screenshot": true }
POST /act      { "platform": "x", "action": "post", "params": { "text": "..." } }
GET  /status
GET  /health
```

### MCP Server

Works with any MCP-compatible agent framework:

```bash
npx spectrawl mcp
```

Exposes 5 tools: `web_search`, `web_browse`, `web_act`, `web_auth`, `web_status`.

## Stealth Browsing

Default: `playwright-extra` with stealth plugin patches webdriver detection, navigator properties, canvas/WebGL fingerprinting, and plugin enumeration. Works for ~90% of sites.

For deeper anti-detection:

```bash
npx spectrawl install-stealth
```

Downloads the [Camoufox](https://github.com/daijro/camoufox) browser — a patched Firefox with engine-level anti-fingerprint. Spectrawl auto-detects and uses it.

## Search Engines

| Engine | Free Tier | Default |
|--------|-----------|---------|
| SearXNG | Unlimited (self-hosted) | ✅ |
| DuckDuckGo | Unlimited | ✅ |
| Brave | 2,000/month | ✅ |
| Serper | 2,500/month | Fallback |
| Google CSE | 100/day | Fallback |
| Jina Reader | Unlimited | Fallback |

Configure the cascade in `spectrawl.json`:

```json
{
  "search": {
    "cascade": ["searxng", "ddg", "brave", "serper", "google-cse", "jina"]
  }
}
```

## Platform Adapters

| Platform | Auth Method | Actions |
|----------|-------------|---------|
| X/Twitter | GraphQL Cookie + OAuth 1.0a | post |
| Reddit | Cookie API (oauth.reddit.com) | post, comment |
| Dev.to | REST API (API key) | post |
| Hashnode | GraphQL API | post |
| LinkedIn | Cookie API (Voyager) | post |
| IndieHackers | Browser automation | post, comment, upvote |

## Configuration

`spectrawl.json`:

```json
{
  "port": 3900,
  "search": {
    "cascade": ["ddg", "brave"],
    "scrapeTop": 3
  },
  "cache": {
    "path": "./data/cache.db",
    "searchTtl": 1,
    "scrapeTtl": 24
  },
  "proxy": {
    "host": "proxy.example.com",
    "port": "8080",
    "username": "user",
    "password": "pass"
  },
  "camoufox": {
    "url": "http://localhost:9869"
  },
  "rateLimit": {
    "x": { "postsPerHour": 3, "minDelayMs": 60000 },
    "reddit": { "postsPerHour": 5 }
  }
}
```

## Environment Variables

```
BRAVE_API_KEY       Brave Search API key
SERPER_API_KEY      Serper.dev API key
GOOGLE_CSE_KEY      Google Custom Search API key
GOOGLE_CSE_CX       Google Custom Search engine ID
JINA_API_KEY        Jina Reader API key (optional)
SEARXNG_URL         SearXNG instance URL (default: http://localhost:8888)
CAMOUFOX_URL        Remote Camoufox service URL
OPENAI_API_KEY      For LLM summarization
ANTHROPIC_API_KEY   For LLM summarization
```

## License

MIT

## Part of xanOS

Spectrawl is the web layer for [xanOS](https://github.com/FayAndXan/xanOS) — the autonomous content engine. Use it standalone or as part of the full stack.
