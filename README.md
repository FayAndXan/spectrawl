# 🌐 Spectrawl

**The unified web layer for AI agents.**

Search, browse, authenticate, act — one tool, self-hosted, free.

---

## Why

Every AI agent builder duct-tapes 6 tools together: one for search, one for scraping, one for stealth browsing, one for cookies, one for proxies, one for posting. None of them talk to each other.

Spectrawl is one package that does it all.

## What It Does

| Capability | What | How |
|-----------|------|-----|
| **Search** | Free Tavily replacement | DDG → Brave → Serper cascade + scraping + LLM summary |
| **Browse** | Stealth web browsing | Playwright → Camoufox escalation, proxy rotation, fingerprint mgmt |
| **Auth** | Persistent login sessions | Cookie lifecycle, auto-refresh, multi-account management |
| **Act** | Platform actions | Post, comment, like — via API or stealth browser per platform |

## How It's Different

| Feature | Browserbase | Hyperbrowser | Steel.dev | Spectrawl |
|---------|:-:|:-:|:-:|:-:|
| Self-hosted | ❌ | ❌ | ✅ | ✅ |
| Search built-in | ❌ | ❌ | ❌ | ✅ |
| Auth lifecycle | ❌ | ❌ | Partial | ✅ |
| Multi-account | ❌ | ❌ | ❌ | ✅ |
| Cookie auto-refresh | ❌ | ❌ | ❌ | ✅ |
| MCP server | ❌ | ❌ | ❌ | ✅ |
| Fingerprint mgmt | ❌ | ✅ | ❌ | ✅ |
| Per-second billing | ✅ | ✅ | ❌ | **Free** |

## Quick Start

```bash
npm install spectrawl
```

```js
const { Spectrawl } = require('spectrawl')
const web = new Spectrawl()

// Search (free Tavily replacement)
const results = await web.search('dental implants seoul', {
  summarize: true,
  scrapeTop: 3
})

// Browse (stealth, with auth)
const page = await web.browse('https://reddit.com/r/dentistry', {
  auth: 'reddit'
})

// Act (authenticated platform actions)
await web.act('x', 'post', {
  account: '@myhandle',
  text: 'hello world'
})
```

## CLI

```bash
spectrawl init                          # create config
spectrawl login x --account @handle     # manual browser login
spectrawl login reddit --oauth          # OAuth flow
spectrawl status                        # check all account health
spectrawl search "query"                # test search
spectrawl serve                         # start HTTP + MCP server
```

## MCP Server

Spectrawl exposes an MCP server so any agent framework can use it natively:

```
web_search — search with free APIs
web_browse — stealth browse with auth
web_act — post/comment on platforms
web_auth — manage logins
web_status — health check
```

Works with Claude Code, OpenClaw, or any MCP-compatible client.

## Auth Lifecycle

Login once. Spectrawl handles the rest:

```
spectrawl login x --account @handle
# → opens browser → you log in → cookies saved → done
```

Cookies are monitored and auto-refreshed. If refresh fails, you get notified — not a silent 3am failure.

```bash
spectrawl status
# x/@handle        ✅ valid (expires in 14d)
# reddit/@handle   ✅ valid (OAuth, auto-refresh)
# ih/@handle       ⚠️ expiring (2h left)
```

## Stack

- **Runtime:** Node.js
- **Stealth browser:** Camoufox
- **Fast browser:** Playwright
- **Storage:** SQLite
- **Config:** `spectrawl.json`

## License

MIT

---

Built by [FayAndXan](https://github.com/FayAndXan). Part of the [xanOS](https://github.com/FayAndXan/xanOS) ecosystem.
