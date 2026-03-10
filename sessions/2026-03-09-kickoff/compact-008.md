# Compact 008 — Pricing Reality + Summarizer Default Off + Tavily Fallback
*2026-03-10 ~02:17-04:18 UTC*

## Done
- **Dev.to adapter live tested** ✅ — created draft article (account: fay_, key: 9WNog21v...)
- **HuggingFace adapter live tested** ✅ — created repo (account: fayface, token: hf_ypwPyr...)
- **Dev.to adapter bug fixed** — missing User-Agent/Accept headers, added redirect handling
- **Summarizer maxOutputTokens 500→2048** — was truncating answers mid-sentence
- **Summarizer top sources 5→8, content 1000→1500 chars** — richer context for better answers
- **scrapeTop default 3→5** — more URLs scraped for fuller answers
- **Published spectrawl@0.3.9 through 0.3.13** (5 versions this session)
- **Answer quality now beats Tavily** — 12 frameworks vs 3, inline citations vs none, 19 sources vs 10
- **Pricing reality checked** — Gemini Grounded is $14/1K after 5K free, Tavily is $10/1K. We're 40% more expensive at scale.
- **Summarizer OFF by default** — sources only, no LLM cost. `{ summarize: true }` for opt-in.
- **Gemini key warning** — one-time stderr warning with direct link when no GEMINI_API_KEY set
- **Spectrawl systemd service running** — localhost:3900, auto-restart
- **GITHUB_TOKEN in gateway env** — all agents can use it
- **README rewritten** — real output comparison, honest pricing, sources-only default explained

## Key Decisions
- **Summarizer is opt-in, not default** — agents already have an LLM. Double summarization = double cost for same result. Sources-only is the right default for agent tools.
- **"5,000 free searches/month" not "free"** — honest positioning. Free tier covers individuals. Past that, Tavily is cheaper per query.
- **Tavily as optional fallback engine** — decided but not yet built. Use after 5K Gemini quota.
- **Credential architecture: HTTP service** — Spectrawl on localhost:3900 holds all credentials. Other agents call API, never see tokens. Exception: GITHUB_TOKEN in gateway env (low risk).
- **DDG + Wikipedia hybrid for zero-key** — researched but not built. All free search APIs block programmatic access.
- **No way to make search truly free at scale** — every provider has cost. Honest about this.

## Pricing Breakdown (per query)
- Grounded search only: $0 (under 5K/mo), $0.014 after
- With summarizer: add ~$0.002 (gemini-2.5-flash)
- Tavily: $0.01/query flat
- Crossover: ~8K queries/month (below = Spectrawl cheaper, above = Tavily cheaper)

## Accounts Verified
- Dev.to: fay_ (14 existing articles, API key works)
- HuggingFace: fayface (token works, repo create/delete tested)
- GitHub: FeyDeFi (token works, issue create tested)
- Reddit: EntrepreneurSharp538 (post/delete tested, token expires soon)

## API Keys Saved
- Dev.to: `.openclaw/credentials/devto-api.json`
- HuggingFace: `.openclaw/credentials/huggingface.json`
