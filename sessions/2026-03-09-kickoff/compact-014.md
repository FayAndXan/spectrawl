# Compact 014 — RFC 9457 + Block Detection + Memory Cleanup (Mar 12, 05:52-06:21 UTC)

## Spectrawl v0.5.0
- RFC 9457 structured errors: type URL, status, title, detail, retryable, suggestion
- Block page detection: Cloudflare (inc. RFC 9457), Akamai, AWS WAF, Imperva, DataDome, PerimeterX, hCaptcha, generic
- Crawl auto-retries with full stealth on block detection
- Couldn't test block detection — Camoufox got through Nike and G2 without triggering blocks

## Memory system
- Researched optimal sizes: MEMORY <2K, daily notes <2K, AGENTS <4K, SOUL <3K, CONTEXT <8K
- Trimmed all daily notes 41K→8K, MEMORY.md 3.1K→1.6K
- System cron at /opt/memory-cleanup.sh (Xan's version, parameterized for all agents)
- Heartbeats turned OFF — burning Opus tokens for file size checks is wasteful
- Key insight: Claude ignores bloated context ("may or may not be relevant" system prompt)

## Config
- Heartbeat removed from openclaw.json
- Cron: 04:00 UTC daily, checks both Dante and Rei workspaces
