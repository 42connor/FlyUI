// background.js — claude.ai session, live streaming, modes, and always-on auto-polish with cache.

const CLAUDE_BASE = 'https://claude.ai';
const CACHE_PREFIX = 'autopolish_';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const MODEL_CONFIG = {
  'claude-haiku-4-5-20251001': { maxDOM: 50000  },
  'claude-sonnet-4-6':         { maxDOM: 80000  },
  'claude-opus-4-6':           { maxDOM: 100000 }
};

// ── Session helpers ──

async function getSessionCookie() {
  return chrome.cookies.get({ url: CLAUDE_BASE, name: 'lastActiveOrg' });
}

async function getOrganizationId() {
  const res = await fetch(`${CLAUDE_BASE}/api/organizations`, { credentials: 'include' });
  if (!res.ok) throw new Error('Not logged in to claude.ai');
  const orgs = await res.json();
  if (!orgs || orgs.length === 0) throw new Error('No organizations found.');
  return orgs[0].uuid;
}

async function createConversation(orgId, model) {
  const res = await fetch(`${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', model: model || 'claude-sonnet-4-6' })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create conversation (${res.status})`);
  }
  return res.json();
}

async function deleteConversation(orgId, conversationId) {
  try {
    await fetch(`${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}`, {
      method: 'DELETE', credentials: 'include'
    });
  } catch (_) {}
}

// ── Streaming ──

async function streamResponse(orgId, conversationId, prompt, model, onChunk) {
  const res = await fetch(`${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}/completion`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Message failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '', buffer = '', insideCSSBlock = false, cssBuffer = '', fullCSS = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const event = JSON.parse(payload);
        let chunk = '';
        if (event.completion) chunk = event.completion;
        if (event.delta?.text) chunk = event.delta.text;
        if (event.content_block?.text) chunk = event.content_block.text;
        if (!chunk) continue;
        fullText += chunk;

        for (const char of chunk) {
          cssBuffer += char;
          if (!insideCSSBlock) {
            if (cssBuffer.endsWith('```css\n') || cssBuffer.endsWith('```css\r\n')) {
              insideCSSBlock = true; cssBuffer = '';
            }
            if (cssBuffer.length > 20) cssBuffer = cssBuffer.slice(-10);
          } else {
            if (cssBuffer.endsWith('\n```') || cssBuffer.endsWith('\r\n```')) {
              const final = cssBuffer.slice(0, cssBuffer.lastIndexOf('```'));
              if (final) { onChunk(final); fullCSS += final; }
              insideCSSBlock = false; cssBuffer = '';
            } else if (cssBuffer.length > 200) {
              const safe = cssBuffer.slice(0, -4);
              cssBuffer = cssBuffer.slice(-4);
              onChunk(safe); fullCSS += safe;
            }
          }
        }
      } catch (_) {}
    }
  }

  if (insideCSSBlock && cssBuffer.length > 0) {
    const remaining = cssBuffer.replace(/`{0,3}$/, '');
    if (remaining) { onChunk(remaining); fullCSS += remaining; }
  }

  return { fullText, fullCSS };
}

// ── Auth ──

async function checkAuth() {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) return { loggedIn: false };
    await getOrganizationId();
    return { loggedIn: true };
  } catch (_) {
    return { loggedIn: false };
  }
}

// ── Cache helpers ──

async function getCachedCSS(hostname) {
  const key = CACHE_PREFIX + hostname;
  const data = await chrome.storage.local.get([key]);
  const entry = data[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_MAX_AGE) {
    chrome.storage.local.remove([key]);
    return null;
  }
  return entry.css;
}

async function setCachedCSS(hostname, css) {
  const key = CACHE_PREFIX + hostname;
  await chrome.storage.local.set({ [key]: { css, ts: Date.now() } });
}

async function getCacheCount() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX)).length;
}

async function clearCache() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
  if (keys.length) await chrome.storage.local.remove(keys);
  return keys.length;
}

// ── Taste learning ──

const TASTE_LOG_MAX = 100;

async function logTasteSignal(hostname, action) {
  const data = await chrome.storage.local.get(['tasteLog']);
  const log = data.tasteLog || [];
  log.push({ hostname, action, ts: Date.now() });
  while (log.length > TASTE_LOG_MAX) log.shift();
  await chrome.storage.local.set({ tasteLog: log });
}

async function getTasteSummary() {
  const data = await chrome.storage.local.get(['tasteLog']);
  const log = data.tasteLog || [];
  if (log.length < 5) return '';
  const kept = log.filter(e => e.action === 'kept');
  const undone = log.filter(e => e.action === 'undone');
  const redone = log.filter(e => e.action === 'redone');
  let s = `Based on ${log.length} observations: ${kept.length} sites kept, ${undone.length} undone, ${redone.length} redone. `;
  if (undone.length > 0) s += `Polish rejected on: ${[...new Set(undone.map(e => e.hostname))].slice(0, 5).join(', ')}. `;
  if (redone.length > 0) s += `Wanted better on: ${[...new Set(redone.map(e => e.hostname))].slice(0, 5).join(', ')}. `;
  return s;
}

async function getTasteStats() {
  const data = await chrome.storage.local.get(['tasteLog']);
  const log = data.tasteLog || [];
  return {
    total: log.length,
    kept: log.filter(e => e.action === 'kept').length,
    undone: log.filter(e => e.action === 'undone').length,
    redone: log.filter(e => e.action === 'redone').length
  };
}

// ── Auto-polish (the taste prompt) ──

const AUTO_POLISH_PROMPT = `You are a design connoisseur with impeccable, opinionated taste. You receive a structural skeleton of a webpage. Generate a small, surgical CSS stylesheet that elevates its visual quality.

YOUR TASTE PRINCIPLES:
- Typography is everything. Replace lazy system fonts: font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif. Add @import url for Inter from Google Fonts.
- Heading letter-spacing: -0.015em to -0.025em. Body line-height: 1.6. Paragraph max-width for readability where possible.
- Pure black (#000) is harsh. Soften to #1a1a2e on light backgrounds, #e2e8f0 on dark.
- Body background: if white, warm it to #fafafa or #f8f9fa. If dark, deepen to a rich navy or charcoal, never pure #000.
- Links: not default blue. Use a refined accent — slightly desaturated, intentional. Add transition on hover.
- Transitions on ALL interactive elements: transition: all 0.15s ease. This is non-negotiable.
- Buttons: border-radius 6-8px, subtle box-shadow (0 1px 3px rgba(0,0,0,0.08)), comfortable padding (10px 20px minimum), slight hover lift (translateY(-1px), deeper shadow).
- Inputs/textareas: match button border-radius, gentle focus ring (0 0 0 2px accent with 0.15 alpha), remove harsh outlines.
- Soften harsh borders: use rgba(0,0,0,0.08) or rgba(255,255,255,0.06) instead of solid grays.
- Cards/containers: if they exist, add subtle box-shadow (0 1px 3px rgba(0,0,0,0.06)) and border-radius 8-12px.
- Consistent spacing rhythm: normalize major gaps to 8px multiples.
- Images: border-radius 6px if rectangular, subtle shadow.
- Selection color: use a branded ::selection with a soft accent background.
- Scrollbar: thin, translucent, rounded (WebKit only is fine).

HARD CONSTRAINTS:
- 40-80 lines of CSS. Maximum. Less is more.
- Use !important only where the site has stubborn inline/specificity styles.
- Do NOT change layout. Do NOT hide/show elements. Do NOT add pseudo-element content.
- Do NOT flip light/dark theme. Respect what's there. Refine it.
- This should feel like the site's designer leveled up overnight — not like someone hacked it.
- Be opinionated. Make choices. Generic is worse than wrong.

Output ONLY CSS inside a \`\`\`css block. Zero explanations.`;

async function handleAutoPolish(hostname, url, dom, tabId) {
  let orgId = null, conversationId = null;
  try {
    orgId = await getOrganizationId();
    const model = 'claude-haiku-4-5-20251001';
    const conversation = await createConversation(orgId, model);
    conversationId = conversation.uuid;

    const profileData = await chrome.storage.local.get(['userProfile']);
    const userProfile = profileData.userProfile || '';
    const tasteSummary = await getTasteSummary();

    let prompt = AUTO_POLISH_PROMPT;
    if (userProfile) prompt += `\n\nUSER PROFILE (tailor choices to this person):\n${userProfile}`;
    if (tasteSummary) prompt += `\n\nLEARNED PREFERENCES:\n${tasteSummary}`;
    prompt += `\n\nPage: ${url}\n\n\`\`\`html\n${dom}\n\`\`\``;

    const { fullCSS } = await streamResponse(orgId, conversationId, prompt, model, (chunk) => {
      chrome.tabs.sendMessage(tabId, { action: 'autoPolishCSS', chunk });
    });

    chrome.tabs.sendMessage(tabId, { action: 'autoPolishDone' });

    // Cache the result for instant replay
    if (fullCSS.trim()) {
      await setCachedCSS(hostname, fullCSS);
    }

    if (orgId && conversationId) deleteConversation(orgId, conversationId);
  } catch (error) {
    console.error('Auto-polish error:', error);
    if (orgId && conversationId) deleteConversation(orgId, conversationId);
  }
}

// ── Manual mode prompts ──

const PROMPTS = {
  optimise(data, dom, url) {
    return `You are a senior UI/UX polish specialist.
Make SUBTLE, tasteful improvements to this webpage using CSS only.
Keep the same layout and overall look. Refine:
- Font rendering, letter-spacing, line-height
- Gentle gradients where flat colors exist, soften harsh contrasts
- Spacing consistency, awkward padding/margins
- Hover states, transitions, soft shadows
- Button/input refinement, rounded corners
- Visual inconsistencies

Do NOT change the color scheme dramatically, reposition sections, or hide elements.
${data.prefFonts ? `Preferred fonts: ${data.prefFonts}` : ''}
${data.prefColors ? `Color hints (accents only): ${data.prefColors}` : ''}
${data.prefCustom ? `Extra: ${data.prefCustom}` : ''}

Use !important where needed. Output ONLY CSS in a \`\`\`css block.

DOM for ${url}:\n\`\`\`html\n${dom}\n\`\`\``;
  },

  redesign(data, dom, url) {
    return `You are an expert Frontend Developer and UI/UX Designer.
Completely redesign this webpage using ONLY CSS.
- Use @import for Google Fonts if requested. Use !important where needed.
- Recolor, restyle, reposition. CSS Grid/Flexbox, pseudo-elements, gradients — go all out.
- Ensure readability and preserve functionality.

PREFERENCES:
- Fonts: ${data.prefFonts || 'Default'}
- Colors: ${data.prefColors || 'Default'}
- Style: ${data.prefStyle || 'Modern, clean, responsive'}
${data.prefLang ? `- Tone: ${data.prefLang}` : ''}
${data.prefCustom ? `- Custom: ${data.prefCustom}` : ''}

Output CSS in a \`\`\`css block. Nothing else.

DOM for ${url}:\n\`\`\`html\n${dom}\n\`\`\``;
  },

  fix(data, dom, url, fixDescription) {
    const issue = fixDescription || data.prefCustom || '';
    return `You are a CSS debugging specialist. This page has BROKEN or unusable UI. Fix it with CSS.

${issue ? `THE USER'S PROBLEM:\n"${issue}"\n\nFocus on fixing exactly what they described. If they say something is hidden, make it visible. If something is blocking, remove or reposition it. If something won't scroll, fix the overflow.\n` : ''}GENERAL FIX CHECKLIST (apply what's relevant):
- Overlapping elements blocking content or buttons → fix z-index, position, overflow
- Content hidden off-screen or behind other elements → make visible
- Broken scrolling → fix overflow, height, position:fixed issues
- Invisible text (white on white, 0 opacity, tiny font) → fix color, opacity, font-size
- Unclickable buttons/links → fix pointer-events, z-index, position
- Cookie banners / modals / overlays stuck blocking the page → hide them
- Broken flexbox/grid stacking → fix display, flex, grid
- Fixed/sticky elements covering content → adjust or add body padding
- Inputs/forms invisible or broken → make visible and usable

Focus on USABILITY over beauty. Be aggressive with !important — this is a rescue operation.

Output ONLY CSS in a \`\`\`css block. No explanations.

DOM for ${url}:\n\`\`\`html\n${dom}\n\`\`\``;
  }
};

// ── Manual handler ──

async function handleRepersonalize(dom, url, tabId, mode, fixDescription) {
  let orgId = null, conversationId = null;
  try {
    const data = await chrome.storage.local.get(['model', 'prefFonts', 'prefColors', 'prefStyle', 'prefLang', 'prefCustom', 'userProfile']);
    const model = data.model || 'claude-sonnet-4-6';
    const config = MODEL_CONFIG[model] || MODEL_CONFIG['claude-sonnet-4-6'];
    const trimmedDOM = dom.substring(0, config.maxDOM);

    orgId = await getOrganizationId();
    const conversation = await createConversation(orgId, model);
    conversationId = conversation.uuid;

    const promptFn = PROMPTS[mode] || PROMPTS.optimise;
    let prompt = promptFn(data, trimmedDOM, url, fixDescription);
    if (data.userProfile) prompt += `\n\nUSER PROFILE:\n${data.userProfile}`;
    const tasteSummary = await getTasteSummary();
    if (tasteSummary) prompt += `\n\nLEARNED PREFERENCES:\n${tasteSummary}`;

    await streamResponse(orgId, conversationId, prompt, model, (chunk) => {
      chrome.tabs.sendMessage(tabId, { action: 'streamCSS', chunk });
    });

    chrome.tabs.sendMessage(tabId, { action: 'streamDone' });
    try { chrome.runtime.sendMessage({ action: 'repersonalizeDone' }); } catch (_) {}
    if (orgId && conversationId) deleteConversation(orgId, conversationId);
  } catch (error) {
    console.error('Repersonalization Error:', error);
    const msg = error.message || 'Unknown error';
    chrome.tabs.sendMessage(tabId, { action: 'repersonalizeError', error: msg });
    try { chrome.runtime.sendMessage({ action: 'repersonalizeError', error: msg }); } catch (_) {}
    if (orgId && conversationId) deleteConversation(orgId, conversationId);
  }
}

// ── Stats tracking ──

async function trackStat(stat) {
  const data = await chrome.storage.local.get(['stats']);
  const stats = data.stats || { rulesApplied: 0, aiCalls: 0, cacheHits: 0 };
  if (stat === 'rulesApplied') stats.rulesApplied++;
  if (stat === 'aiCall') stats.aiCalls++;
  if (stat === 'cacheHit') stats.cacheHits++;
  await chrome.storage.local.set({ stats });
}

async function getStats() {
  const data = await chrome.storage.local.get(['stats']);
  return data.stats || { rulesApplied: 0, aiCalls: 0, cacheHits: 0 };
}

// ── Blocklist ──

async function getBlockedSites() {
  const data = await chrome.storage.local.get(['blockedSites']);
  return data.blockedSites || [];
}

async function toggleBlockSite(hostname) {
  const blocked = await getBlockedSites();
  const idx = blocked.indexOf(hostname);
  if (idx >= 0) {
    blocked.splice(idx, 1);
  } else {
    blocked.push(hostname);
  }
  await chrome.storage.local.set({ blockedSites: blocked });
  return { blocked, isBlocked: blocked.includes(hostname) };
}

// ── Message listener ──

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processDOM') {
    handleRepersonalize(request.dom, request.url, sender.tab.id, request.mode || 'optimise', request.fixDescription || '');
    return true;
  }

  if (request.action === 'autoPolish') {
    trackStat('aiCall');
    handleAutoPolish(request.hostname, request.url, request.dom, sender.tab.id);
    return true;
  }

  if (request.action === 'getAutoCache') {
    getCachedCSS(request.hostname).then(css => sendResponse({ css }));
    return true;
  }

  if (request.action === 'checkAuth') {
    checkAuth().then(sendResponse);
    return true;
  }

  if (request.action === 'getCacheCount') {
    getCacheCount().then(count => sendResponse({ count }));
    return true;
  }

  if (request.action === 'clearCache') {
    clearCache().then(cleared => sendResponse({ cleared }));
    return true;
  }

  if (request.action === 'trackStat') {
    trackStat(request.stat);
    return false;
  }

  if (request.action === 'getStats') {
    getStats().then(stats => sendResponse(stats));
    return true;
  }

  if (request.action === 'getBlockedSites') {
    getBlockedSites().then(sites => sendResponse({ sites }));
    return true;
  }

  if (request.action === 'toggleBlockSite') {
    toggleBlockSite(request.hostname).then(sendResponse);
    return true;
  }

  if (request.action === 'isBlocked') {
    getBlockedSites().then(sites => sendResponse({ isBlocked: sites.includes(request.hostname) }));
    return true;
  }

  if (request.action === 'clearSiteCache') {
    const key = CACHE_PREFIX + request.hostname;
    chrome.storage.local.remove([key]).then(() => sendResponse({ cleared: true }));
    return true;
  }

  if (request.action === 'logTaste') {
    logTasteSignal(request.hostname, request.signal);
    return false;
  }

  if (request.action === 'getTasteStats') {
    getTasteStats().then(sendResponse);
    return true;
  }

  if (request.action === 'clearTasteLog') {
    chrome.storage.local.set({ tasteLog: [] }).then(() => sendResponse({ cleared: true }));
    return true;
  }
});
