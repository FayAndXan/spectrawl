# Spectrawl — Architecture v1

*The unified web layer for AI agents.*
*One package. Browse, search, post, stay logged in.*

---

## What It Is

A self-hosted Node.js package that gives AI agents complete web access through one API. No duct-taping Camoufox + PinchTab + Tavily + Scrapy + Playwright together. One tool, everything works.

## What Makes It Different

| Feature | Browserbase | Hyperbrowser | Steel.dev | Spectrawl |
|---------|------------|--------------|-----------|----------|
| Self-hosted | ❌ | ❌ | ✅ | ✅ |
| Search built-in | ❌ | ❌ | ❌ | ✅ |
| Auth lifecycle | ❌ | ❌ | Partial | ✅ |
| Multi-account | ❌ | ❌ | ❌ | ✅ |
| Cookie auto-refresh | ❌ | ❌ | ❌ | ✅ |
| MCP server | ❌ | ❌ | ❌ | ✅ |
| Fingerprint mgmt | ❌ | ✅ | ❌ | ✅ |
| Per-second billing | ✅ | ✅ | ❌ | Free |

---

## Core Capabilities

### 1. SEARCH
Free Tavily replacement. Aggregates free APIs, scrapes top results, optionally summarizes with LLM.

```
agent.search("dental implants seoul", { summarize: true, scrapeTop: 3 })
```

**Search cascade (saves quota):**
```
DuckDuckGo (free, unlimited)
  → not enough? → Brave (2000/mo free)
  → still not enough? → Serper (2500/mo free)
  → Google CSE (100/day free)
```

**Scrape escalation:**
```
fetch + readability (fast, free, 90% of pages)
  → blocked/JS-heavy? → stealth browser (Camoufox)
```

**Output:**
```json
{
  "answer": "LLM-generated summary with citations",
  "sources": [
    { "url": "...", "title": "...", "snippet": "...", "fullContent": "..." }
  ],
  "cached": false
}
```

### 2. BROWSE
Stealth web browsing with anti-detection. Two modes: headless (fast) and visible (for manual login).

```
agent.browse("https://reddit.com/r/dentistry", { auth: "reddit" })
```

**Browser selection:**
```
Playwright (fast, cheap, default)
  → detected/blocked? → Camoufox (stealth, anti-fingerprint)
```

**Features:**
- Residential proxy rotation (first-class config, not per-tool)
- Canvas/WebGL/font fingerprint management
- Human-like timing (random delays, natural scroll patterns)
- Screenshot + DOM extraction in one call
- Form filling that handles contentEditable, shadow DOM, React controlled inputs

### 3. AUTH
Persistent authenticated sessions with automatic cookie lifecycle.

```
agent.auth.add("x", { account: "@xanlens__" })  // opens browser for manual login
agent.auth.add("reddit", { clientId: "...", secret: "..." })  // OAuth, fully automated
```

**Auth priority per platform:**
```
OAuth token (if platform supports it) → auto-refresh built in
  → not available? → Cookie capture (one-time manual login)
  → creds provided? → Headless login (no manual step)
```

**Cookie lifecycle:**
```
cron checks validity every N hours
  → valid? → nothing
  → expiring? → event hook: "cookie_expiring"
  → expired? → auto re-login via stored method
  → re-login failed? → event hook: "auth_failed"
```

**Multi-account management:**
```
agent.auth.list()
// → [{ platform: "x", account: "@xanlens__", status: "valid", expires: "..." },
//    { platform: "x", account: "@xankriegor_", status: "valid", method: "oauth" },
//    { platform: "reddit", account: "@EntrepreneurSharp538", status: "valid" }]
```

### 4. ACT
Authenticated actions on platforms. Agent says what to do, tool handles the how.

```
agent.act("x", "post", { account: "@xanlens__", text: "hello world" })
agent.act("reddit", "post", { account: "@EntrepreneurSharp538", subreddit: "SaaS", title: "...", body: "..." })
agent.act("reddit", "comment", { account: "@EntrepreneurSharp538", postId: "...", text: "..." })
```

**Platform adapters:**
Each platform has quirks. One adapter per platform handles them:

| Platform | Primary Method | Fallback | Known Quirks |
|----------|---------------|----------|--------------|
| X | Cookie API (GraphQL) | Stealth browser | contentEditable compose, `execCommand("insertText")` |
| Reddit | Cookie API (OAuth) | Stealth browser | Blocks datacenter IPs on web, not on oauth.reddit.com |
| IH | Browser automation | — | No API, Camoufox-only |
| LinkedIn | Cookie API | Stealth browser | Aggressive bot detection |
| Dev.to | REST API | — | Official API, easy |
| Hashnode | GraphQL API | — | Official API, easy |

---

## Cross-Cutting Features

### Cache
SQLite with TTL expiry. Same search query twice = instant, free.

```
cache: {
  search: { ttl: "1h" },     // search results
  scrape: { ttl: "24h" },    // scraped page content
  screenshot: { ttl: "1h" }  // page screenshots
}
```

### Rate Limiting / Human-Like Behavior
Built-in delays that mimic human browsing:
- Random intervals between actions (configurable min/max)
- Natural scroll patterns before clicking
- Typing delays for form filling
- Per-platform rate limits (X: max N posts/hour, Reddit: min 10min between posts)

### Failure Context
When something fails, return *why* — not just an error code:
```json
{
  "success": false,
  "error": "auth_expired",
  "detail": "X cookie for @xanlens__ expired 2h ago. Auto-refresh failed: CAPTCHA required.",
  "suggestion": "Run `spectrawl login x --account @xanlens__` for manual re-login"
}
```

### Queue + Retry
Agent fires multiple actions. Tool manages concurrency:
- Configurable concurrent browser sessions (default: 3)
- Exponential backoff on failures
- Dead letter queue for permanently failed actions
- Action deduplication (same post won't fire twice)

### Event Hooks
Proactive notifications to the agent:
```js
agent.on("cookie_expiring", ({ platform, account, expiresIn }) => { ... })
agent.on("auth_failed", ({ platform, account, reason }) => { ... })
agent.on("rate_limited", ({ platform, retryAfter }) => { ... })
agent.on("action_failed", ({ action, error, retryCount }) => { ... })
```

### Health Checks
Built-in probe: "are my sessions still valid?"
```
spectrawl status
// x/@xanlens__      ✅ valid (expires in 14d)
// x/@xankriegor_    ✅ valid (OAuth, auto-refresh)
// reddit/@Entrep... ✅ valid (expires in 22d)
// ih/@Fay           ⚠️ expiring (2h left)
```

---

## MCP Server

Exposed as an MCP tool so any agent framework can use it natively:

```json
{
  "tools": [
    { "name": "web_search", "description": "Search the web with free APIs" },
    { "name": "web_browse", "description": "Browse a URL with stealth/auth" },
    { "name": "web_act", "description": "Perform authenticated action on a platform" },
    { "name": "web_auth", "description": "Manage platform authentication" },
    { "name": "web_status", "description": "Check auth health for all accounts" }
  ]
}
```

Any OpenClaw agent, Claude Code session, or MCP-compatible tool gets access for free. This is the distribution play.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Spectrawl API                       │
│              (HTTP server + MCP server)               │
├──────────┬──────────┬──────────┬─────────────────────┤
│  SEARCH  │  BROWSE  │   AUTH   │        ACT          │
├──────────┼──────────┼──────────┼─────────────────────┤
│ DDG      │ Playwr.  │ OAuth    │ Platform Adapters   │
│ Brave    │ Camoufox │ Cookie   │ ┌─────┬──────┬────┐ │
│ Serper   │          │ Store    │ │  X  │Reddit│ IH │ │
│ Google   │ Proxy    │ (SQLite) │ ├─────┼──────┼────┤ │
│ CSE      │ Pool     │          │ │Dev  │Hash  │Link│ │
│          │          │ Refresh  │ │.to  │node  │edIn│ │
│ Scraper  │ Finger-  │ Cron     │ └─────┴──────┴────┘ │
│ (reada-  │ print    │          │                     │
│ bility)  │ Mgmt     │ Event    │ Form Filler         │
│          │          │ Hooks    │ (contentEditable,   │
│ LLM      │ Human-   │          │  shadow DOM, React) │
│ Summary  │ like     │          │                     │
│ (opt.)   │ Timing   │          │ Queue + Retry       │
├──────────┴──────────┴──────────┴─────────────────────┤
│                     CACHE (SQLite + TTL)              │
├──────────────────────────────────────────────────────┤
│                  CONFIG (spectrawl.json)               │
│  - proxy settings                                    │
│  - API keys (Brave, Serper — optional)               │
│  - rate limits per platform                          │
│  - LLM provider for summaries                        │
│  - cache TTLs                                        │
│  - concurrent sessions limit                         │
└──────────────────────────────────────────────────────┘
```

---

## Stack

- **Runtime:** Node.js (matches xanOS)
- **Stealth browser:** Camoufox
- **Fast browser:** Playwright
- **Storage:** SQLite (cache, cookies, queue)
- **Config:** `spectrawl.json` in project root
- **CLI:** `spectrawl` command for login, status, health
- **Server:** HTTP + MCP dual server
- **Package:** npm (`@fayandxan/spectrawl` or `spectrawl`)

---

## CLI

```bash
# Setup
spectrawl init                          # creates spectrawl.json
spectrawl login x --account @handle     # opens browser for manual login
spectrawl login reddit --oauth          # OAuth flow

# Status
spectrawl status                        # all accounts health
spectrawl status x                      # X accounts only

# Server
spectrawl serve                         # start HTTP + MCP server
spectrawl serve --port 3900             # custom port

# Test
spectrawl search "query"                # test search from CLI
spectrawl browse https://example.com    # test browse from CLI
```

---

## Config (spectrawl.json)

```json
{
  "port": 3900,
  "proxy": {
    "type": "residential",
    "provider": "proxycheap",
    "key": "..."
  },
  "search": {
    "brave_key": "...",
    "serper_key": "...",
    "cascade": ["ddg", "brave", "serper"],
    "scrapeTop": 3,
    "llm": {
      "provider": "minimax",
      "model": "m2.5",
      "apiKey": "..."
    }
  },
  "auth": {
    "refreshInterval": "4h",
    "cookieStore": "./data/cookies.db"
  },
  "rateLimit": {
    "x": { "postsPerHour": 5, "minDelayMs": 30000 },
    "reddit": { "postsPerHour": 3, "minDelayMs": 600000 }
  },
  "cache": {
    "path": "./data/cache.db",
    "searchTtl": "1h",
    "scrapeTtl": "24h"
  },
  "concurrency": 3
}
```

---

## Distribution Strategy

1. **npm package** — `npm install spectrawl`
2. **GitHub repo** — open source, MIT
3. **MCP listing** — submit to MCP registries
4. **OpenClaw skill** — publish on ClawHub
5. **Post in OpenClaw GitHub Discussions** — "built this to solve multi-tool browsing"
6. **xanOS uses it internally** — dogfood + proof it works

Every user who installs Spectrawl discovers xanOS exists. That's the funnel.
