# FlyUI

Chrome extension that makes every website look better. AI-powered redesign, always-on polish, and broken UI repair — powered by your claude.ai account.

No API key. No subscription. Just log into claude.ai and go.

## What it does

FlyUI sits in your browser and improves every website you visit. It works in two layers:

**Layer 1 — Rules Engine (instant, zero AI)**
Runs on every page load with zero latency. Programmatically swaps ugly fonts for Inter, softens harsh blacks, warms flat whites, adds transitions to interactive elements, rounds corners, improves focus states, and polishes scrollbars. Uses your preferred fonts if you've set them. No tokens burned.

**Layer 2 — AI Polish (Haiku, cached per domain)**
After the rules engine, Claude Haiku analyzes the page structure and generates site-specific CSS refinements. Streams live so you watch the page transform. Results are cached per domain — second visit is instant with zero AI calls.

## Features

### Three Modes
- **Optimise** — Subtle polish. Better fonts, spacing, gradients, hover states. Keeps the original design recognizable.
- **Redesign** — Full creative rewrite. Bold new colors, typography overhaul, layout transformation. Pick a preset (Glass, Brutalist, Synthwave, Y2K, Zen, Luxury) or define your own style.
- **Fix** — Broken UI repair. Describe what's wrong ("can't scroll past the cookie banner", "checkout button hidden behind the nav") and Claude fixes it with aggressive CSS. Gets you past busted pages.

### Always-On Mode
Toggle it on and every page gets polished automatically. The rules engine fires instantly, then AI refinements stream in (or load from cache). Block specific sites you don't want touched — they're remembered forever.

### Model Picker
Choose your weapon right on the action tab:
- **Haiku** — Fast, cheap. Used for always-on auto-polish.
- **Sonnet** — Balanced. Good for manual optimise/redesign.
- **Opus** — Best quality. For ambitious creative redesigns.

### Style History
Full back/forward navigation through every style change. Roll back to the original page, step forward through rules → AI polish → manual transforms. Like undo/redo but for CSS layers.

### Page Analysis
Before you transform, FlyUI scans the page and tells you what to expect:
- Simple pages → "Great fit"
- Lots of inline styles → "Some may resist overrides"  
- Shadow DOM → "Cannot be restyled"
- SPAs → "Re-renders may revert styles"

### Usage Stats
Track how much AI you're actually burning vs getting for free:
- **Rules only** — pages that only got the free rules engine
- **AI calls** — times Haiku was called
- **Cached** — cache hits (free)

### Per-Site Blocklist
One click blocks a site from always-on polish. Managed in settings — click any blocked site to unblock it.

## Auth

FlyUI uses your **existing claude.ai login session**. No API key needed. Just be logged into claude.ai in the same browser. The extension checks your session cookie and talks to claude.ai directly. Conversations are created, used, and immediately deleted so they don't clutter your sidebar.

## Install

1. Clone this repo or download the ZIP
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder
5. Log into [claude.ai](https://claude.ai) if you haven't already
6. Click the FlyUI extension icon — you should see "Connected"

## Files

```
manifest.json   — Chrome extension config (Manifest V3)
popup.html      — Extension popup UI
popup.css       — Popup styles
popup.js        — Popup logic (modes, models, auth, history, stats)
background.js   — Service worker (claude.ai session, streaming, cache, prompts)
content.js      — Content script (rules engine, DOM extraction, style history)
content.css     — Overlay styles for the loading spinner
```

## How the rules engine works

Zero AI. Zero tokens. Runs instantly on page load.

1. **Font scan** — Samples 50 elements, detects ugly fonts (Arial, Times New Roman, Comic Sans, etc.), replaces with Inter or your preferred font
2. **Theme detection** — Reads `background-color` luminance to determine light/dark
3. **Color softening** — Pure black `#000` → `#1a1a2e` (light) or `#e2e8f0` (dark). Pure white `#fff` → `#fafafa`
4. **Transitions** — Adds `transition: all 0.15s ease` to all interactive elements
5. **Polish** — Rounds button/input corners, adds focus rings, image border-radius, custom `::selection`, thin scrollbars

## How the AI polish works

1. Extracts a **skeleton DOM** (just tags, IDs, class names — ~5-8KB, not the full page)
2. Sends to **Haiku** with an opinionated taste prompt
3. **Streams CSS live** into the page — you watch it transform in real-time
4. **Caches the result** by domain — next visit is instant
5. **Deletes the conversation** from claude.ai so your sidebar stays clean

## Caching

AI-generated CSS is cached per hostname in `chrome.storage.local` for 7 days. Cache stats are visible in the popup. Clear all cache from Settings.

## Stack

- Vanilla JS, HTML, CSS — no build step, no dependencies
- Chrome Extension Manifest V3
- claude.ai internal API (session-based auth)

## License

MIT
