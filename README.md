# Spectrawl

The unified web layer for AI agents. Search, browse, authenticate, and act on platforms — one tool, self-hosted, free.

**5,000 free searches/month** with Google-quality results via Gemini Grounded Search. Better answers than Tavily. Self-hosted.

## What It Does

AI agents need to interact with the web. That means searching, browsing pages, logging into platforms, and posting content. Today you duct-tape together Playwright + Tavily + cookie managers + platform-specific scripts. Spectrawl replaces all of that.

```
npm install spectrawl
```

## Real Output

Here's actual output from Spectrawl vs Tavily on the same query:

**Query:** `"best open source AI agent frameworks 2025"`

### Spectrawl (free)
```
Time: 16.8s | Sources: 19

Answer: The leading open-source AI agent frameworks for 2025 include AutoGen,
CrewAI, LangChain, LangGraph, and Semantic Kernel [1, 2, 3]. AutoGen is
recognized for enabling complex multi-agent conversations, while CrewAI
focuses on orchestrating collaborative AI agents [1, 2]. LangChain and its
component LangGraph provide robust tools for building sophisticated agent
workflows and state management [1, 2, 3]. Semantic Kernel, developed by
Microsoft, integrates large language models with conventional programming
languages [1, 2, 3].

Other prominent frameworks include LlamaIndex, Haystack, BabyAGI, AgentGPT,
SuperAGI, MetaGPT, and Open Interpreter [1, 2].
```
**12 frameworks named, inline citations, 19 sources**

### Tavily ($0.01/query)
```
Time: 2s | Sources: 10

Answer: In 2025, LangGraph and Microsoft's AutoGen + Semantic Kernel are
top open-source AI agent frameworks, favored for their robust orchestration
and enterprise security features.
```
**3 frameworks named, no citations, 10 sources**

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

## vs Tavily

| | Tavily | Spectrawl |
|---|---|---|
| Speed | ~2s ✅ | ~7-17s |
| Answer quality | Generic (3 items) | **Detailed** (12+ items) ✅ |
| Inline citations | ❌ | **[1] [2] [3]** ✅ |
| Results per query | 10 | **12-19** ✅ |
| Cost | $0.01/query | **Free** (5K/mo) ✅ |
| Self-hosted | No | **Yes** ✅ |
| Source ranking | No | **Domain trust scoring** ✅ |
| Stealth scraping | No | **Yes** ✅ |
| Auth + posting | No | **24 adapters** ✅ |
| Cached repeats | No | **<1ms** ✅ |

Spectrawl wins on answer quality, result volume, features, and cost. Tavily wins on speed.

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
    "cascade": ["gemini-grounded", "brave", "ddg"],
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
