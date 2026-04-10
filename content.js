// content.js

// ── Overlay ──

function showOverlay() {
  if (document.getElementById('ai-repersonalizer-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'ai-repersonalizer-overlay';
  overlay.innerHTML = `
    <div class="rp-spinner"><div class="rp-spinner-ring"></div><div class="rp-spinner-ring rp-ring-2"></div></div>
    <h2 class="rp-title">Repersonalizing</h2>
    <p class="rp-subtitle">Streaming styles live...</p>
  `;
  document.body.appendChild(overlay);
}

function hideOverlay() {
  const overlay = document.getElementById('ai-repersonalizer-overlay');
  if (overlay) { overlay.classList.add('rp-fade-out'); setTimeout(() => overlay.remove(), 400); }
}

function showCompletionToast(type) {
  const existing = document.getElementById('rp-completion-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'rp-completion-toast';
  if (type === 'cached') {
    toast.className = 'rp-toast-cached';
    toast.innerHTML = '<span class="rp-toast-icon">&#10003;</span> Polished (cached)';
  } else {
    toast.className = 'rp-toast-ai';
    toast.innerHTML = '<span class="rp-toast-icon">&#10024;</span> AI polish complete';
  }
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('rp-toast-out'); setTimeout(() => toast.remove(), 400); }, 2500);
}

// ══════════════════════════════════════════════════════════
// LAYER 1: Zero-AI Rules Engine (instant, zero tokens)
// ══════════════════════════════════════════════════════════

const UGLY_FONTS = [
  'arial', 'helvetica', 'times new roman', 'times', 'verdana',
  'georgia', 'palatino', 'garamond', 'comic sans ms', 'impact',
  'lucida console', 'tahoma', 'trebuchet ms', 'courier new', 'courier'
];

function buildRulesCSS(userFonts) {
  const preferredFont = userFonts && userFonts.trim()
    ? `${userFonts}, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
    : `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

  // Detect if the page is dark-themed
  const bg = getComputedStyle(document.body).backgroundColor;
  const isDark = isColorDark(bg);

  let css = `/* Repersonalizer Rules Engine — zero AI */\n`;

  // Font import (only if using Inter)
  if (!userFonts || !userFonts.trim()) {
    css += `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\n`;
  }

  // Scan for ugly fonts in use and build replacement rules
  const fontEls = scanFontsInUse();
  if (fontEls.size > 0) {
    css += `/* Font upgrades */\n`;
    // Apply to body as a catch-all
    css += `body { font-family: ${preferredFont}; }\n`;
    css += `h1, h2, h3, h4, h5, h6 { font-family: ${preferredFont}; letter-spacing: -0.02em; }\n`;
  }

  // Typography
  css += `body { line-height: 1.6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }\n`;

  // Soften pure black text
  if (!isDark) {
    css += `body { color: #1a1a2e; }\n`;
    // Warm pure white backgrounds
    css += `body { background-color: #fafafa; }\n`;
  } else {
    css += `body { color: #e2e8f0; }\n`;
  }

  // Transitions on interactive elements
  css += `a, button, input, select, textarea, [role="button"] { transition: all 0.15s ease; }\n`;

  // Button polish
  css += `button, [role="button"], input[type="submit"], input[type="button"] {
  border-radius: 6px;
}\n`;

  // Input polish
  css += `input:not([type="checkbox"]):not([type="radio"]), textarea, select {
  border-radius: 6px;
}\n`;
  css += `input:focus, textarea:focus, select:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}\n`;

  // Image polish
  css += `img { border-radius: 4px; }\n`;

  // Selection
  css += `::selection { background: rgba(99, 102, 241, 0.2); }\n`;

  // Scrollbar
  css += `::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; }\n`;

  return css;
}

function scanFontsInUse() {
  const found = new Set();
  const sample = document.querySelectorAll('body, h1, h2, h3, p, a, span, div, li, td, th, button, input');
  const limit = Math.min(sample.length, 50);
  for (let i = 0; i < limit; i++) {
    const ff = getComputedStyle(sample[i]).fontFamily.toLowerCase();
    for (const ugly of UGLY_FONTS) {
      if (ff.includes(ugly)) { found.add(ugly); break; }
    }
  }
  return found;
}

function isColorDark(colorStr) {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const lum = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]);
  return lum < 128;
}

function applyRulesEngine(userFonts) {
  if (document.getElementById('ai-rules-engine-styles')) return 'already';
  const css = buildRulesCSS(userFonts);
  const styleEl = document.createElement('style');
  styleEl.id = 'ai-rules-engine-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  takeSnapshot();
  return 'applied';
}

// ══════════════════════════════════════════════════════════
// LAYER 2: Full DOM extraction (for manual AI modes)
// ══════════════════════════════════════════════════════════

function extractSimplifiedDOM() {
  const bodyClone = document.body.cloneNode(true);
  const tagsToRemove = ['script','style','svg','canvas','iframe','noscript','video','audio','template','object','embed','map','area'];
  for (const tag of tagsToRemove) {
    const els = bodyClone.getElementsByTagName(tag);
    for (let i = els.length - 1; i >= 0; i--) els[i].remove();
  }
  const ov = bodyClone.querySelector('#ai-repersonalizer-overlay');
  if (ov) ov.remove();

  for (const el of bodyClone.querySelectorAll('*')) {
    const rm = [];
    for (const a of el.attributes) {
      if (a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'style' ||
          a.name === 'jsaction' || a.name === 'jscontroller' || a.name === 'jsmodel' ||
          a.name === 'jsname' || a.name === 'tabindex' || a.name === 'role') rm.push(a.name);
      if (a.name === 'src' && a.value.startsWith('data:image')) el.setAttribute('src', '[img]');
      if (a.name === 'srcset') rm.push('srcset');
    }
    rm.forEach(a => el.removeAttribute(a));
    if (el.children.length === 0 && el.textContent.length > 200)
      el.textContent = el.textContent.substring(0, 80) + '...';
  }
  for (const div of [...bodyClone.querySelectorAll('div')].reverse()) {
    if (!div.id && !div.className && div.children.length === 1 &&
        div.textContent.trim() === div.children[0].textContent.trim())
      div.replaceWith(div.children[0]);
  }
  return bodyClone.innerHTML;
}

// Skeleton DOM (for AI auto-polish)
function extractSkeletonDOM() {
  const seen = new Map(), lines = [];
  function walk(el, d) {
    if (d > 8 || lines.length > 300) return;
    const tag = el.tagName.toLowerCase();
    if (['script','style','svg','canvas','iframe','noscript','video','audio','template','br','hr','wbr'].includes(tag)) return;
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,3).join('.') : '';
    const key = tag + cls;
    const c = seen.get(key) || 0;
    if (c >= 2 && !id) return;
    seen.set(key, c + 1);
    const hasKids = el.children.length > 0;
    lines.push(`${'  '.repeat(d)}<${tag}${id}${cls}${hasKids ? '>' : ' />'}`);
    if (hasKids) { for (const ch of el.children) walk(ch, d + 1); lines.push(`${'  '.repeat(d)}</${tag}>`); }
  }
  walk(document.body, 0);
  return lines.join('\n').substring(0, 8000);
}

// Page analysis
function analyzePage() {
  const s = { el: document.body.querySelectorAll('*').length, il: document.body.querySelectorAll('[style]').length,
    img: document.body.querySelectorAll('img').length, tbl: document.body.querySelectorAll('table').length,
    ifr: document.body.querySelectorAll('iframe').length, sr: 0, react: !!document.getElementById('root') || !!document.getElementById('__next'), shadow: false, dyn: 0 };
  for (const el of document.body.querySelectorAll('*')) { if (el.shadowRoot) { s.sr++; s.shadow = true; } }
  const cp = /^[a-z]{1,3}[A-Z_-][a-zA-Z0-9_-]{6,}$/;
  for (let i = 0; i < Math.min(document.body.querySelectorAll('[class]').length, 100); i++) {
    for (const c of (document.body.querySelectorAll('[class]')[i].className.split?.(' ') || [])) { if (cp.test(c)) s.dyn++; }
  }
  const ins = []; let conf = 'high';
  if (s.el < 500) ins.push({type:'good',text:'Simple page — great fit'});
  else if (s.el < 2000) ins.push({type:'good',text:'Medium page — should work well'});
  else { ins.push({type:'warn',text:`Large (${s.el} elements) — may truncate`}); conf='medium'; }
  if (s.img > 10) ins.push({type:'good',text:'Image-rich — polish will shine'});
  if (s.il > 20) { ins.push({type:'warn',text:`${s.il} inline styles — some resist`}); if(conf==='high')conf='medium'; }
  if (s.dyn > 15) { ins.push({type:'warn',text:'Hashed classes — fragile selectors'}); if(conf==='high')conf='medium'; }
  if (s.react) ins.push({type:'warn',text:'SPA — re-renders may revert'});
  if (s.shadow) { ins.push({type:'bad',text:`${s.sr} shadow DOM — untouchable`}); conf='low'; }
  if (s.ifr > 2) ins.push({type:'warn',text:`${s.ifr} iframes — untouchable`});
  return { insights: ins, confidence: conf, elementCount: s.el };
}

// ══════════════════════════════════════════════════════════
// Style History (back / forward)
// ══════════════════════════════════════════════════════════

const STYLE_IDS = ['ai-rules-engine-styles', 'ai-auto-polish-styles', 'ai-repersonalizer-styles'];
let styleHistory = []; // array of snapshots: { rules, autoPolish, manual }
let historyIndex = -1; // points to current snapshot

function takeSnapshot() {
  const snap = {
    rules:      document.getElementById('ai-rules-engine-styles')?.textContent || null,
    autoPolish: document.getElementById('ai-auto-polish-styles')?.textContent || null,
    manual:     document.getElementById('ai-repersonalizer-styles')?.textContent || null
  };
  // Don't push if identical to current
  if (historyIndex >= 0) {
    const cur = styleHistory[historyIndex];
    if (cur.rules === snap.rules && cur.autoPolish === snap.autoPolish && cur.manual === snap.manual) return;
  }
  // Truncate any forward history when pushing new state
  styleHistory = styleHistory.slice(0, historyIndex + 1);
  styleHistory.push(snap);
  historyIndex = styleHistory.length - 1;
}

function applySnapshot(snap) {
  applyOrRemoveStyleEl('ai-rules-engine-styles', snap.rules);
  applyOrRemoveStyleEl('ai-auto-polish-styles', snap.autoPolish);
  applyOrRemoveStyleEl('ai-repersonalizer-styles', snap.manual);
}

function applyOrRemoveStyleEl(id, css) {
  let el = document.getElementById(id);
  if (css) {
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = css;
  } else {
    if (el) el.remove();
  }
}

function historyBack() {
  if (historyIndex <= 0) return false;
  historyIndex--;
  applySnapshot(styleHistory[historyIndex]);
  return true;
}

function historyForward() {
  if (historyIndex >= styleHistory.length - 1) return false;
  historyIndex++;
  applySnapshot(styleHistory[historyIndex]);
  return true;
}

function getHistoryState() {
  return {
    pos: historyIndex + 1,
    total: styleHistory.length,
    canBack: historyIndex > 0,
    canForward: historyIndex < styleHistory.length - 1
  };
}

// Push initial "clean" snapshot (no styles)
styleHistory.push({ rules: null, autoPolish: null, manual: null });
historyIndex = 0;

// ══════════════════════════════════════════════════════════
// Auto-polish on page load
// ══════════════════════════════════════════════════════════

function getOrCreateStyleEl(id) {
  const elId = id || 'ai-repersonalizer-styles';
  let el = document.getElementById(elId);
  if (!el) { el = document.createElement('style'); el.id = elId; document.head.appendChild(el); }
  return el;
}

function tryAutoPolish() {
  if (location.protocol === 'chrome:' || location.protocol === 'chrome-extension:') return;

  chrome.storage.local.get(['autoPolish', 'blockedSites', 'prefFonts'], (data) => {
    if (!data.autoPolish) return;

    const hostname = location.hostname;
    if (!hostname) return;

    // Check blocklist
    const blocked = (data.blockedSites || []);
    if (blocked.includes(hostname)) return;

    // Layer 1: Rules engine (always, instant, free)
    const rulesResult = applyRulesEngine(data.prefFonts);

    // Track rules application
    if (rulesResult === 'applied') {
      chrome.runtime.sendMessage({ action: 'trackStat', stat: 'rulesApplied' });
    }

    // Layer 2: AI polish (check cache, then Haiku if miss)
    chrome.runtime.sendMessage({ action: 'getAutoCache', hostname }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.css) {
        const styleEl = getOrCreateStyleEl('ai-auto-polish-styles');
        styleEl.textContent = response.css;
        chrome.runtime.sendMessage({ action: 'trackStat', stat: 'cacheHit' });
        chrome.runtime.sendMessage({ action: 'logTaste', hostname: location.hostname, signal: 'kept' });
        showCompletionToast('cached');
      } else {
        const skeleton = extractSkeletonDOM();
        chrome.runtime.sendMessage({ action: 'autoPolish', hostname, url: location.href, dom: skeleton });
      }
    });
  });
}

if (document.readyState === 'complete') tryAutoPolish();
else window.addEventListener('load', tryAutoPolish, { once: true });

// ══════════════════════════════════════════════════════════
// Message handler
// ══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'startRepersonalization') {
    showOverlay(); sendResponse({ status: 'started' });
    chrome.runtime.sendMessage({ action: 'processDOM', url: location.href, dom: extractSimplifiedDOM(), mode: request.mode || 'optimise', fixDescription: request.fixDescription || '' });
    return;
  }
  if (request.action === 'streamCSS') {
    const el = getOrCreateStyleEl('ai-repersonalizer-styles');
    el.textContent += request.chunk; if (el.textContent.length > 100) hideOverlay(); return;
  }
  if (request.action === 'autoPolishCSS') {
    getOrCreateStyleEl('ai-auto-polish-styles').textContent += request.chunk; return;
  }
  if (request.action === 'streamDone') {
    hideOverlay(); takeSnapshot(); return;
  }
  if (request.action === 'autoPolishDone') {
    hideOverlay(); takeSnapshot(); showCompletionToast('ai'); return;
  }
  if (request.action === 'applyStyles') {
    getOrCreateStyleEl('ai-repersonalizer-styles').textContent = request.css; hideOverlay(); takeSnapshot(); return;
  }

  // ── History navigation ──
  if (request.action === 'historyBack') {
    const ok = historyBack();
    const state = getHistoryState();
    if (state.pos === 1) {
      chrome.runtime.sendMessage({ action: 'logTaste', hostname: location.hostname, signal: 'undone' });
    }
    sendResponse({ ok, ...state }); return;
  }
  if (request.action === 'historyForward') {
    const ok = historyForward();
    sendResponse({ ok, ...getHistoryState() }); return;
  }
  if (request.action === 'getHistory') {
    sendResponse(getHistoryState()); return;
  }

  if (request.action === 'checkUndo') {
    const has = !!(document.getElementById('ai-repersonalizer-styles') || document.getElementById('ai-auto-polish-styles') || document.getElementById('ai-rules-engine-styles'));
    sendResponse({ hasStyles: has, ...getHistoryState() }); return;
  }
  if (request.action === 'getPagePolishStatus') {
    sendResponse({
      hasRules: !!document.getElementById('ai-rules-engine-styles'),
      hasAI: !!document.getElementById('ai-auto-polish-styles'),
      hasManual: !!document.getElementById('ai-repersonalizer-styles'),
      ...getHistoryState()
    }); return;
  }
  if (request.action === 'analyzePage') { sendResponse(analyzePage()); return; }
  if (request.action === 'repersonalizeError') { hideOverlay(); return; }
});
