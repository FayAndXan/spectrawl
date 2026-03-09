# Compact 003 — Stealth Browser Tiers + Camoufox Installer
*2026-03-09 16:03-16:22 UTC*

## Summary
Resolved the "what happens if someone installs Spectrawl" problem. Built three-tier stealth browsing that auto-detects and uses the best available browser. Added Camoufox binary installer.

## What Was Built

### Three-Tier Stealth Browse Engine
1. **Tier 1: stealth Playwright** (default) — playwright-extra + stealth-plugin. JS-level anti-detect: webdriver hidden, navigator spoofed, canvas/WebGL patched. Works with just `npm install`.
2. **Tier 2: Camoufox binary** — `npx spectrawl install-stealth` downloads prebuilt anti-detect Firefox from Camoufox GitHub releases (~700MB). Engine-level fingerprint spoofing. Apache 2.0 licensed.
3. **Tier 3: Remote Camoufox** — connects to existing Camoufox HTTP service (e.g., port 9869). For existing deployments.

Auto-detection: Camoufox binary > stealth Playwright > vanilla Playwright. No config needed.

### Camoufox Installer (`src/browse/install-stealth.js`)
- Downloads correct binary for OS/arch (Linux x64/arm64, macOS)
- Stores at `~/.spectrawl/browsers/camoufox/`
- Version tracking (skip if already installed)
- Wired into CLI: `npx spectrawl install-stealth`

### Browse Engine Rewrite (`src/browse/index.js`)
- Randomized fingerprint per context (viewport, UA, timezone, device scale)
- Human-like behavior always on (random delays, scroll simulation)
- Helpful error messages when blocked (suggests install-stealth or proxy)

## Key Discussion
- Fay asked "why can't we just write our own Camoufox?" — because it's recompiled Firefox C++ (25M lines). But we CAN use their prebuilt binaries (Apache 2.0) same as Playwright downloads Chromium.
- Fay pushed back on my initial "no" — was right. I should have seen the binary download model earlier.

## Commits
- `d821f28` — Bundle stealth browsing, no external deps
- `9abb8e3` — Three-tier stealth, auto-detect best browser

## Still Not Done
- IH adapter (stub)
- Tests
- npm publish
- README
- End-to-end testing with live accounts
