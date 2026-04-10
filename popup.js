document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const saveBtn = document.getElementById('save-settings-btn');
  const repersonalizeBtn = document.getElementById('repersonalize-btn');
  const historyBar = document.getElementById('history-bar');
  const historyBack = document.getElementById('history-back');
  const historyForward = document.getElementById('history-forward');
  const historyPos = document.getElementById('history-pos');
  const statusArea = document.getElementById('status-area');
  const statusText = document.getElementById('status-text');
  const connectionBadge = document.getElementById('connection-badge');
  const loginPrompt = document.getElementById('login-prompt');
  const actionButtons = document.getElementById('action-buttons');
  const openClaudeBtn = document.getElementById('open-claude-btn');
  const recheckBtn = document.getElementById('recheck-btn');
  const settingsOpenClaude = document.getElementById('settings-open-claude');
  const accountStatusIcon = document.getElementById('account-status-icon');
  const accountStatusText = document.getElementById('account-status-text');
  const modeInfoText = document.getElementById('mode-info-text');
  const pageAnalysis = document.getElementById('page-analysis');
  const analysisConfidence = document.getElementById('analysis-confidence');
  const analysisList = document.getElementById('analysis-list');
  const autoPolishToggle = document.getElementById('auto-polish-toggle');
  const autoPolishStatus = document.getElementById('auto-polish-status');
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const cacheCount = document.getElementById('cache-count');
  const blockSiteBtn = document.getElementById('block-site-btn');
  const blockSiteLabel = document.getElementById('block-site-label');
  const pageStatusBadge = document.getElementById('page-status-badge');
  const statRules = document.getElementById('stat-rules');
  const statAI = document.getElementById('stat-ai');
  const statCached = document.getElementById('stat-cached');
  const blockedSitesList = document.getElementById('blocked-sites-list');
  const fixInputWrap = document.getElementById('fix-input-wrap');
  const fixDescription = document.getElementById('fix-description');

  const selModel = document.getElementById('model-select');
  const inFonts = document.getElementById('pref-fonts');
  const inColors = document.getElementById('pref-colors');
  const inStyle = document.getElementById('pref-style');
  const inLang = document.getElementById('pref-language');
  const inCustom = document.getElementById('pref-custom');
  const presetChips = document.querySelectorAll('.preset-chip');
  const modelBtns = document.querySelectorAll('.model-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');

  const MODE_INFO = {
    optimise: { label: 'Optimise This Page', info: 'Subtle polish — fonts, spacing, gradients, hover states.', loading: 'Polishing page...' },
    redesign: { label: 'Redesign This Page', info: 'Full creative rewrite — bold colors, typography, layout overhaul.', loading: 'Redesigning page...' },
    fix:      { label: 'Fix This Page',      info: 'Repair broken UI — overlapping elements, stuck modals, hidden buttons.', loading: 'Fixing broken UI...' }
  };

  let isLoggedIn = false;
  let currentHostname = '';

  // ── Get current tab hostname ──
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.url) {
      try { currentHostname = new URL(tab.url).hostname; } catch (_) {}
    }
    refreshBlockState();
    refreshPageStatus();
  });

  // ── Auto-polish toggle ──
  function updateAutoPolishUI(enabled) {
    autoPolishToggle.checked = enabled;
    autoPolishStatus.textContent = enabled ? 'On' : 'Off';
    autoPolishStatus.className = 'auto-polish-status' + (enabled ? ' on' : '');
  }
  autoPolishToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoPolish: autoPolishToggle.checked });
    updateAutoPolishUI(autoPolishToggle.checked);
  });
  chrome.storage.local.get(['autoPolish'], (d) => updateAutoPolishUI(!!d.autoPolish));

  // ── Block site ──
  function refreshBlockState() {
    if (!currentHostname) return;
    chrome.runtime.sendMessage({ action: 'isBlocked', hostname: currentHostname }, (r) => {
      if (chrome.runtime.lastError || !r) return;
      if (r.isBlocked) {
        blockSiteLabel.textContent = 'Unblock this site';
        blockSiteBtn.classList.add('is-blocked');
        pageStatusBadge.textContent = 'Blocked';
        pageStatusBadge.className = 'page-status-badge blocked';
      } else {
        blockSiteLabel.textContent = 'Skip this site';
        blockSiteBtn.classList.remove('is-blocked');
      }
    });
  }

  blockSiteBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    chrome.runtime.sendMessage({ action: 'toggleBlockSite', hostname: currentHostname }, (r) => {
      if (chrome.runtime.lastError || !r) return;
      refreshBlockState();
      refreshBlockedSitesList();
    });
  });

  // ── Page status badge ──
  function refreshPageStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { action: 'getPagePolishStatus' }, (r) => {
        if (chrome.runtime.lastError || !r) return;
        if (r.hasAI) { pageStatusBadge.textContent = 'AI polished'; pageStatusBadge.className = 'page-status-badge ai'; }
        else if (r.hasRules) { pageStatusBadge.textContent = 'Rules applied'; pageStatusBadge.className = 'page-status-badge rules'; }
        else { pageStatusBadge.textContent = 'Unpolished'; pageStatusBadge.className = 'page-status-badge'; }
        if (r.hasManual) { pageStatusBadge.textContent = 'Manually styled'; pageStatusBadge.className = 'page-status-badge ai'; }
      });
    });
    // Also check if blocked
    refreshBlockState();
  }

  // ── Usage stats ──
  function refreshStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (r) => {
      if (chrome.runtime.lastError || !r) return;
      statRules.textContent = r.rulesApplied || 0;
      statAI.textContent = r.aiCalls || 0;
      statCached.textContent = r.cacheHits || 0;
    });
  }
  refreshStats();

  // ── Blocked sites list (settings) ──
  function refreshBlockedSitesList() {
    chrome.runtime.sendMessage({ action: 'getBlockedSites' }, (r) => {
      if (chrome.runtime.lastError || !r) return;
      blockedSitesList.innerHTML = '';
      if (r.sites.length === 0) {
        blockedSitesList.innerHTML = '<span class="settings-hint">None blocked</span>';
        return;
      }
      for (const site of r.sites) {
        const chip = document.createElement('span');
        chip.className = 'blocked-site-chip';
        chip.innerHTML = `${site} <span class="chip-x">x</span>`;
        chip.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'toggleBlockSite', hostname: site }, () => {
            refreshBlockedSitesList();
            refreshBlockState();
          });
        });
        blockedSitesList.appendChild(chip);
      }
    });
  }
  refreshBlockedSitesList();

  // ── Cache controls ──
  function refreshCacheCount() {
    chrome.runtime.sendMessage({ action: 'getCacheCount' }, (r) => {
      if (!chrome.runtime.lastError && r) cacheCount.textContent = r.count;
    });
  }
  clearCacheBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearCache' }, () => {
      cacheCount.textContent = '0';
      const orig = clearCacheBtn.textContent;
      clearCacheBtn.textContent = 'Cleared!'; clearCacheBtn.style.borderColor = 'var(--success)'; clearCacheBtn.style.color = 'var(--success)';
      setTimeout(() => { clearCacheBtn.textContent = orig; clearCacheBtn.style.borderColor = ''; clearCacheBtn.style.color = ''; }, 1500);
    });
  });
  refreshCacheCount();

  // ── Mode picker ──
  function getSelectedMode() { return (document.querySelector('.mode-btn.active') || {}).dataset?.mode || 'optimise'; }
  function updateModeInfo() {
    const mode = getSelectedMode();
    const info = MODE_INFO[mode];
    modeInfoText.textContent = info.info;
    repersonalizeBtn.querySelector('.btn-text').textContent = info.label;
    fixInputWrap.style.display = mode === 'fix' ? 'block' : 'none';
    chrome.storage.local.set({ mode_type: mode });
  }
  modeBtns.forEach(b => b.addEventListener('click', () => {
    modeBtns.forEach(x => x.classList.remove('active')); b.classList.add('active'); updateModeInfo();
  }));

  // ── Model picker ──
  function getSelectedModel() { return (document.querySelector('.model-btn.active') || {}).dataset?.model || 'claude-sonnet-4-6'; }
  modelBtns.forEach(b => b.addEventListener('click', () => {
    modelBtns.forEach(x => x.classList.remove('active')); b.classList.add('active'); selModel.value = b.dataset.model; saveAll();
  }));

  // ── Auth ──
  function updateAuthUI(on) {
    isLoggedIn = on;
    const label = connectionBadge.querySelector('.connection-label');
    if (on) {
      connectionBadge.className = 'connection-badge connected'; label.textContent = 'Connected';
      loginPrompt.style.display = 'none'; actionButtons.style.display = 'block';
      accountStatusIcon.className = 'account-status-icon connected'; accountStatusText.textContent = 'Logged in to claude.ai';
      runPageAnalysis();
    } else {
      connectionBadge.className = 'connection-badge disconnected'; label.textContent = 'Not logged in';
      loginPrompt.style.display = 'block'; actionButtons.style.display = 'none';
      accountStatusIcon.className = 'account-status-icon disconnected'; accountStatusText.textContent = 'Not connected';
    }
  }
  function checkAuth() {
    connectionBadge.className = 'connection-badge checking';
    connectionBadge.querySelector('.connection-label').textContent = 'Checking...';
    chrome.runtime.sendMessage({ action: 'checkAuth' }, (r) => {
      if (chrome.runtime.lastError || !r) { updateAuthUI(false); return; }
      updateAuthUI(r.loggedIn);
    });
  }
  checkAuth();
  openClaudeBtn.addEventListener('click', () => chrome.tabs.create({ url: 'https://claude.ai' }));
  settingsOpenClaude.addEventListener('click', () => chrome.tabs.create({ url: 'https://claude.ai' }));
  recheckBtn.addEventListener('click', checkAuth);

  // ── Load prefs ──
  chrome.storage.local.get(['model','mode_type','prefFonts','prefColors','prefStyle','prefLang','prefCustom'], (d) => {
    if (d.model) { selModel.value = d.model; modelBtns.forEach(b => b.classList.toggle('active', b.dataset.model === d.model)); }
    if (d.mode_type) modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === d.mode_type));
    if (d.prefFonts) inFonts.value = d.prefFonts;
    if (d.prefColors) inColors.value = d.prefColors;
    if (d.prefStyle) inStyle.value = d.prefStyle;
    if (d.prefLang) inLang.value = d.prefLang;
    if (d.prefCustom) inCustom.value = d.prefCustom;
    updateModeInfo();
  });

  // Check history on load
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.tabs.sendMessage(tab.id, { action: 'getHistory' }, (r) => {
      if (!chrome.runtime.lastError && r) updateHistoryUI(r);
    });
  });

  // ── Page analysis ──
  function runPageAnalysis() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || tab.url.startsWith('chrome://')) return;
      chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' }, (r) => {
        if (chrome.runtime.lastError || !r) return;
        pageAnalysis.style.display = 'block';
        analysisConfidence.textContent = r.confidence === 'high' ? 'Great fit' : r.confidence === 'medium' ? 'Mixed' : 'Tough';
        analysisConfidence.className = 'confidence-badge ' + r.confidence;
        analysisList.innerHTML = '';
        for (const i of r.insights) { const li = document.createElement('li'); li.className = i.type; li.textContent = i.text; analysisList.appendChild(li); }
      });
    });
  }

  // ── Tabs ──
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active')); tabContents.forEach(c => c.classList.remove('active'));
    t.classList.add('active'); document.getElementById(t.dataset.target).classList.add('active');
  }));

  // ── Presets ──
  presetChips.forEach(c => c.addEventListener('click', () => {
    presetChips.forEach(x => x.classList.remove('active')); c.classList.add('active');
    inStyle.value = c.dataset.style || ''; inColors.value = c.dataset.colors || ''; inFonts.value = c.dataset.fonts || ''; saveAll();
  }));

  // ── Save ──
  function saveAll() {
    chrome.storage.local.set({ model: getSelectedModel(), mode_type: getSelectedMode(),
      prefFonts: inFonts.value.trim(), prefColors: inColors.value.trim(), prefStyle: inStyle.value.trim(),
      prefLang: inLang.value.trim(), prefCustom: inCustom.value.trim() });
  }
  saveBtn.addEventListener('click', () => {
    saveAll(); const o = saveBtn.innerText;
    saveBtn.innerText = 'Saved!'; saveBtn.style.borderColor = 'var(--success)'; saveBtn.style.color = 'var(--success)';
    setTimeout(() => { saveBtn.innerText = o; saveBtn.style.borderColor = ''; saveBtn.style.color = ''; }, 1500);
  });
  selModel.addEventListener('change', () => { modelBtns.forEach(b => b.classList.toggle('active', b.dataset.model === selModel.value)); saveAll(); });
  [inFonts, inColors, inStyle, inLang, inCustom].forEach(i => i.addEventListener('change', saveAll));

  // ── Status ──
  function showStatus(m, t) { statusArea.style.display = 'flex'; statusArea.className = 'status-area'; if (t) statusArea.classList.add('status-'+t); statusText.textContent = m; }
  function hideStatus() { statusArea.style.display = 'none'; }
  function setLoading(on) {
    const t = repersonalizeBtn.querySelector('.btn-text'), l = repersonalizeBtn.querySelector('.btn-loader');
    repersonalizeBtn.disabled = on; t.style.display = on ? 'none' : 'inline'; l.style.display = on ? 'inline-block' : 'none';
  }

  // ── History (back / forward) ──
  function updateHistoryUI(state) {
    if (!state || state.total <= 1) {
      historyBar.style.display = 'none';
      return;
    }
    historyBar.style.display = 'flex';
    historyPos.textContent = `${state.pos} / ${state.total}`;
    historyBack.disabled = !state.canBack;
    historyForward.disabled = !state.canForward;
  }

  function refreshHistory() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { action: 'getHistory' }, (r) => {
        if (!chrome.runtime.lastError && r) updateHistoryUI(r);
      });
    });
  }

  historyBack.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { action: 'historyBack' }, (r) => {
      if (!chrome.runtime.lastError && r) {
        updateHistoryUI(r);
        refreshPageStatus();
        if (r.pos === 1) showStatus('Original page restored.', 'success');
        else showStatus(`Rolled back to ${r.pos} / ${r.total}`, 'success');
      }
    });
  });

  historyForward.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { action: 'historyForward' }, (r) => {
      if (!chrome.runtime.lastError && r) {
        updateHistoryUI(r);
        refreshPageStatus();
        showStatus(`Rolled forward to ${r.pos} / ${r.total}`, 'success');
      }
    });
  });

  // ── Trigger ──
  repersonalizeBtn.addEventListener('click', async () => {
    hideStatus();
    if (!isLoggedIn) { showStatus('Log in to claude.ai first.', 'error'); return; }
    setLoading(true);
    const mode = getSelectedMode();
    showStatus(MODE_INFO[mode].loading, 'loading');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab.');
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) throw new Error('Cannot run on Chrome pages.');
      const fixDesc = mode === 'fix' ? fixDescription.value.trim() : '';
      chrome.tabs.sendMessage(tab.id, { action: 'startRepersonalization', mode, fixDescription: fixDesc }, (r) => {
        if (chrome.runtime.lastError) { showStatus('Refresh the page and try again.', 'error'); setLoading(false); return; }
        if (r && r.status === 'started') showStatus('Streaming CSS live...', 'loading');
        else { showStatus('Could not start. Refresh page.', 'error'); setLoading(false); }
      });
    } catch (e) { showStatus(e.message, 'error'); setLoading(false); }
  });

  // ── Completion ──
  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'repersonalizeDone') {
      setLoading(false);
      const m = getSelectedMode();
      showStatus(m === 'fix' ? 'UI fixes applied!' : m === 'optimise' ? 'Page polished!' : 'Page redesigned!', 'success');
      refreshHistory(); refreshPageStatus(); refreshStats();
    } else if (req.action === 'repersonalizeError') {
      setLoading(false); showStatus(req.error, 'error');
    }
  });
});
