# Compact 010 — Camoufox Verified, Auth E2E, Form Filler, CAPTCHA Solver
*2026-03-10 ~05:52-06:19 UTC*

## Done
- **Camoufox binary installed and tested** ✅
  - Downloaded 680MB, extracted 717 files
  - Installer bug: Python zipfile chokes on zip64 → fixed with 5-method fallback chain (unzip → 7z → bsdtar → jar → python3)
  - Browse engine auto-detects: Camoufox > stealth Playwright > vanilla
  - Spoofs Mac UA on Linux — anti-detect working
- **Auth flow tested end-to-end** ✅
  - add → getCookies → browse with cookies → updateCookies → remove
  - Correct browser behavior (domain-scoped cookies)
- **Form filler tested on real page** ✅
  - httpbin.org/forms/post — standard inputs + textarea work
  - smartFill auto-detects: contentEditable, React, shadow DOM, standard
- **CAPTCHA solver built** (`src/browse/captcha-solver.js`)
  - Strategy: Playwright stealth bypasses most → Gemini Vision for image CAPTCHAs → reports unsolvable for token-based
  - Auto-detect: reCAPTCHA, hCaptcha, Turnstile, image, text
  - Free under Gemini 1,500 req/day
- **Published spectrawl@0.3.16**
- **22 tests all passing**

## Key Decisions
- **No free CAPTCHA token solving** — reCAPTCHA/hCaptcha/Turnstile need paid services (2captcha ~$3/1K). Gemini Vision handles image CAPTCHAs only.
- **No free proxy rotation** — free proxy lists are garbage. Tor blocked everywhere. Need paid proxies for production.
- **5-method zip extraction** — users may not have unzip installed. Installer tries everything.
- **Camoufox as Tier 2** — auto-detected if installed, stealth Playwright is default

## Component Status After This Session
| Component | Status |
|-----------|--------|
| Search (8 engines) | ✅ Solid |
| Deep search | ✅ Benchmarked vs Tavily |
| Scraping | ✅ Parallel, 5s timeout |
| Stealth browse (Playwright) | ✅ Tested |
| Stealth browse (Camoufox) | ✅ Installed + tested |
| Auth manager | ✅ E2E tested |
| Form filler | ✅ Real page tested |
| CAPTCHA solver | ✅ Built, not battle-tested |
| Platform adapters | ⚠️ 7/24 live tested |
| HTTP server | ✅ All endpoints |
| MCP server | ✅ Working |
| Cookie refresh cron | ⚠️ Code exists, never ran |
| Proxy rotation | ❌ No free solution |
