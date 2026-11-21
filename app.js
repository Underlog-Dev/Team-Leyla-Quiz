/* Team Leyla Quiz Hub - app shell: state, persistence, backdrop, copy helper, setup screen, modals. */
(function () {
  'use strict';
  var Core = window.Core, THEMES = window.THEMES, ORDER = window.THEME_ORDER;
  var BANK = window.QUESTION_BANK || [];
  var BY_ID = {}; BANK.forEach(function (q) { BY_ID[q.id] = q; });

  var storage; try { storage = window.localStorage; storage.setItem('tlqh:t', '1'); storage.removeItem('tlqh:t'); } catch (e) { storage = Core.memoryStorage(); }
  var store = Core.makeStore(storage, 'tlqh:guest:');

  var DEFAULT_SETUP = { mode: 'solo', format: 'open', difficulty: 'mixed', count: 20, custom: '', themes: [], subs: {}, timer: 0 };
  var DEFAULT_SETTINGS = { calm: false, editBeforeCopy: false };

  var App = window.App = {
    Core: Core, THEMES: THEMES, ORDER: ORDER, BANK: BANK, BY_ID: BY_ID, store: store,
    view: 'setup',
    setup: Object.assign({}, DEFAULT_SETUP, store.get('setup', {})),
    settings: Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {})),
    templates: store.get('templates', {}),
    used: store.get('used', []),
    flagged: store.get('flagged', []),
    game: store.get('game', null),
    actions: {}, inputs: {}
  };

  /* ---------- utils ---------- */
  var esc = App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  App.save = function () {
    store.set('setup', App.setup); store.set('settings', App.settings); store.set('templates', App.templates);
    store.set('used', App.used); store.set('flagged', App.flagged);
    if (App.game) store.set('game', App.game); else store.del('game');
  };
  App.markUsed = function (id) { if (App.used.indexOf(id) === -1) App.used.push(id); };

  var toastT;
  App.toast = function (msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1600);
  };

  /* ---------- clipboard (Clipboard API + iOS-safe fallback) ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
  }
  App.writeClipboard = function (text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }, function () { resolve(fallbackCopy(text)); });
      } else resolve(fallbackCopy(text));
    });
  };
  App.copy = function (text, label) {
    if (!text) { App.toast('Nothing to copy'); return; }
    if (App.settings.editBeforeCopy) { App.openModal('<h2>Edit before copying</h2><textarea id="copy-edit" rows="4">' + esc(text) + '</textarea><div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="copy-edited">Copy</button><button class="btn" data-act="close-modal">Cancel</button></div>'); return; }
    App.writeClipboard(text).then(function (ok) {
      if (ok) App.toast('Copied ✓ ' + (label || ''));
      else App.openModal('<h2>Copy this text</h2><p class="help">Automatic copy was blocked. Press and hold the text to copy it.</p><textarea rows="4" readonly onfocus="this.select()">' + esc(text) + '</textarea><button class="btn" data-act="close-modal">Done</button>');
    });
  };
  App.actions['copy-edited'] = function () {
    var v = document.getElementById('copy-edit').value.replace(/\s+/g, ' ').trim();
    App.writeClipboard(v).then(function (ok) { App.closeModal(); App.toast(ok ? 'Copied ✓' : 'Copy blocked - long-press to copy'); });
  };

  /* ---------- modal ---------- */
  App.openModal = function (html) {
    document.getElementById('modal-root').innerHTML = '<div class="modal-back" data-act="close-backdrop"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
  };
  App.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };
  App.actions['close-modal'] = App.closeModal;

  /* ---------- themed backdrop ---------- */
  var bgOn = 'bgA', lastTheme = null;
  App.setBackdrop = function (key) {
    var th = THEMES[key] || THEMES.general;
    document.body.setAttribute('data-theme', key);
    if (lastTheme === key) return; lastTheme = key;
    var next = bgOn === 'bgA' ? 'bgB' : 'bgA';
    var el = document.getElementById(next), old = document.getElementById(bgOn);
    el.style.setProperty('--c1', th.c1); el.style.setProperty('--c2', th.c2);
    el.className = 'bg-layer' + (th.dark ? ' dark' : '');
    var html = th.pitch ? '<div class="pitch"></div>' : '';
    for (var i = 0; i < 22; i++) {
      var e = th.decor[i % th.decor.length];
      html += '<span class="d" style="left:' + ((i * 37 + 7) % 94) + '%;top:' + ((i * 53 + 11) % 90) + '%;font-size:' + (26 + (i * 7) % 26) + 'px;animation-delay:-' + (i % 9) + 's">' + e + '</span>';
    }
    el.innerHTML = html;
    void el.offsetWidth; el.classList.add('on'); old.classList.remove('on'); bgOn = next;
  };

  /* ---------- pools ---------- */
  App.poolBank = function (s) {
    var themes = s.themes.length ? s.themes : ORDER;
    return BANK.filter(function (q) {
      if (App.flagged.indexOf(q.id) !== -1) return false;
      if (themes.indexOf(q.theme) === -1) return false;
      var subs = s.subs[q.theme];
      if (subs && subs.length && subs.indexOf(q.subcategory) === -1) return false;
      return true;
    });
  };
  App.subcategories = function (theme) {
    var seen = {}; BANK.forEach(function (q) { if (q.theme === theme) seen[q.subcategory] = 1; }); return Object.keys(seen).sort();
  };

  /* ---------- shell ---------- */
  function topbar(extra) {
    return '<div class="topbar"><div class="brand">' + window.CHICK_SVG + '<div>Team Leyla<small>The Quiz Hub</small></div></div><div class="spacer"></div>' + (extra || '') +
      '<button class="icon-btn" data-act="open-stats" aria-label="Question bank statistics">📊</button>' +
      '<button class="icon-btn" data-act="open-settings" aria-label="Settings">⚙️</button></div>';
  }
  App.topbar = topbar;

  App.render = function () {
    var app = document.getElementById('app');
    document.body.classList.toggle('calm', !!App.settings.calm);
    if (App.view === 'play' && App.game) { App.renderPlay(app); }
    else if (App.view === 'results' && App.game) { App.renderResults(app); }
    else { App.view = 'setup'; App.setBackdrop('general'); renderSetup(app); }
  };

  /* ---------- setup screen ---------- */
  function seg(name, opts, cur) {
    return '<div class="seg" role="group">' + opts.map(function (o) {
      return '<button class="chip ' + (o.cls || '') + '" data-act="set" data-k="' + name + '" data-v="' + o.v + '" aria-pressed="' + (String(cur) === String(o.v)) + '">' + o.l + '</button>';
    }).join('') + '</div>';
  }
  function renderSetup(app) {
    var s = App.setup, pool = App.poolBank(s);
    var avail = Core.availableQuestions(pool, { themes: [], difficulty: s.difficulty }, App.used).length;
    var want = s.count === 'custom' ? Math.max(1, parseInt(s.custom, 10) || 0) : s.count;
    var themeChips = ORDER.map(function (k) {
      return '<button class="chip" data-act="theme" data-v="' + k + '" aria-pressed="' + (s.themes.indexOf(k) !== -1) + '">' + THEMES[k].icon + ' ' + THEMES[k].label + '</button>';
    }).join('');
    var subHtml = s.themes.map(function (k) {
      var subs = App.subcategories(k), cur = s.subs[k] || [];
      return '<div class="help"><b>' + THEMES[k].label + '</b></div><div class="seg">' + subs.map(function (sc) {
        return '<button class="chip" data-act="sub" data-t="' + k + '" data-v="' + esc(sc) + '" aria-pressed="' + (cur.indexOf(sc) !== -1) + '">' + esc(sc) + '</button>';
      }).join('') + '</div>';
    }).join('');
    var countOpts = [10, 20, 30, 50, 100].map(function (n) { return { v: n, l: n }; }).concat([{ v: 'custom', l: 'Custom' }]);
    var warn = '';
    if (avail === 0) warn = '<div class="notice warn">No unused questions left for these settings. Pick more themes, or reset your played history in 📊.</div>';
    else if (avail < want) warn = '<div class="notice">Only <b>' + avail + '</b> unused questions match - the quiz will have ' + avail + ' questions.</div>';
    var modeDesc = s.mode === 'solo' ? 'Answer the questions yourself and earn points.' : 'You host: copy questions into chat, then award points to whoever answers correctly.';
    app.innerHTML = topbar() + '<div class="layout setup">' +
      '<section class="card setup-panel" aria-label="Game setup"><h2>Build your quiz</h2>' +
      '<label class="h">Game mode</label>' + seg('mode', [{ v: 'solo', l: '👤 Solo' }, { v: 'host', l: '👥 Multiplayer / Host' }], s.mode) + '<p class="help">' + modeDesc + '</p>' +
      '<label class="h">Answer format</label>' + seg('format', [{ v: 'open', l: 'Open answer' }, { v: 'mc', l: 'Multiple choice' }], s.format) +
      '<label class="h">Difficulty</label>' + seg('difficulty', [{ v: 'easy', l: 'Easy · 1pt', cls: 'easy' }, { v: 'medium', l: 'Medium · 2pts', cls: 'medium' }, { v: 'hard', l: 'Hard · 3pts', cls: 'hard' }, { v: 'mixed', l: 'Mixed', cls: 'mixed' }], s.difficulty) +
      '<label class="h">Themes <span class="help">(pick several, or none for all)</span></label><div class="seg">' + themeChips + '</div>' +
      (subHtml ? '<details style="margin-top:8px"><summary class="help">Narrow by subcategory (optional)</summary>' + subHtml + '</details>' : '') +
      '<label class="h">Number of questions</label>' + seg('count', countOpts, s.count) +
      (s.count === 'custom' ? '<input type="number" min="1" max="500" inputmode="numeric" placeholder="How many?" value="' + esc(s.custom) + '" data-input="custom" style="margin-top:8px">' : '') +
      (s.mode === 'solo' ? '<label class="h">Timer per question</label>' + seg('timer', [{ v: 0, l: 'Off' }, { v: 15, l: '15s' }, { v: 30, l: '30s' }, { v: 60, l: '60s' }], s.timer) : '') +
      '<div style="margin-top:14px">' + warn + '</div>' +
      '<button class="btn primary big" style="margin-top:12px" data-act="start"' + (avail === 0 ? ' disabled' : '') + '>Start quiz 🐣</button></section>' +
      '<section class="card welcome">' + window.CHICK_SVG + '<h1>Welcome to Team Leyla!</h1><p>Quizzes for TikTok Live hosts and solo players.</p>' +
      '<ul><li>🎯 <b>Easy</b> 1 point, <b>Medium</b> 2, <b>Hard</b> 3</li><li>💡 A hint costs 1 point (never below 1)</li><li>🔒 No repeated questions - your history is tracked on this device</li><li>📋 One-tap copy buttons for TikTok text-to-speech</li></ul>' +
      '<p class="help">' + BANK.length + ' starter questions · ' + (BANK.length - App.used.length) + ' unplayed</p>' +
      (App.game ? '<button class="btn yellow" data-act="resume">▶ Resume your quiz</button>' : '') + '</section></div>';
  }

  App.actions.set = function (el) {
    var k = el.dataset.k, v = el.dataset.v;
    App.setup[k] = (k === 'count' && v !== 'custom') || k === 'timer' ? parseInt(v, 10) : v;
    App.save(); App.render();
  };
  App.actions.theme = function (el) {
    var v = el.dataset.v, i = App.setup.themes.indexOf(v);
    if (i === -1) App.setup.themes.push(v); else { App.setup.themes.splice(i, 1); delete App.setup.subs[v]; }
    App.save(); App.render();
  };
  App.actions.sub = function (el) {
    var t = el.dataset.t, v = el.dataset.v, a = App.setup.subs[t] = App.setup.subs[t] || [], i = a.indexOf(v);
    if (i === -1) a.push(v); else a.splice(i, 1);
    App.save(); App.render();
  };
  App.inputs.custom = function (el) { App.setup.custom = el.value; App.save(); };
  App.actions.resume = function () { App.view = App.game.finished ? 'results' : 'play'; App.render(); };

  /* ---------- stats & settings ---------- */
  App.actions['open-stats'] = function () {
    var st = Core.bankStats(BANK, App.used);
    var rows = ORDER.filter(function (k) { return st.byTheme[k]; }).map(function (k) {
      return '<tr><td>' + THEMES[k].icon + ' ' + THEMES[k].label + '</td><td>' + st.byTheme[k].total + '</td><td>' + st.byTheme[k].remaining + '</td></tr>';
    }).join('');
    var ver = BANK.filter(function (q) { return q.status === 'verified'; }).length;
    App.openModal('<h2>Question bank</h2><p><b>' + st.total + '</b> total · <b>' + st.played + '</b> played · <b>' + st.remaining + '</b> remaining</p>' +
      '<p class="help">Difficulty: ' + st.byDifficulty.easy + ' easy, ' + st.byDifficulty.medium + ' medium, ' + st.byDifficulty.hard + ' hard</p>' +
      '<div class="notice">Verification: ' + ver + ' of ' + st.total + ' questions are marked verified. The rest are <b>unreviewed</b> starter questions - please check anything you are unsure of and use the flag button.</div>' +
      '<table class="stats"><tr><th>Theme</th><th>Total</th><th>Left</th></tr>' + rows + '</table>' +
      '<p class="help">Played history is saved on this device only (guest mode). Clearing browser data or using another device starts fresh. Accounts are planned for Phase 2.</p>' +
      '<div class="row"><button class="btn danger" data-act="reset-history">Reset played history</button><button class="btn grow" data-act="close-modal">Close</button></div>');
  };
  App.actions['reset-history'] = function () {
    if (!window.confirm('Reset played history? Questions you have played can appear again.')) return;
    App.used = []; App.flagged = []; App.save(); App.closeModal(); App.toast('History reset'); App.render();
  };
  App.actions['open-settings'] = function () {
    var T = Object.assign({}, Core.DEFAULT_TEMPLATES, App.templates);
    function f(k, l) { return '<label class="help">' + l + '</label><input type="text" data-tpl="' + k + '" value="' + esc(T[k]) + '">'; }
    App.openModal('<h2>Settings</h2>' +
      '<label class="row"><input type="checkbox" id="s-calm"' + (App.settings.calm ? ' checked' : '') + ' style="width:22px;height:22px"> Calm mode (reduce motion)</label>' +
      '<label class="row" style="margin-top:8px"><input type="checkbox" id="s-edit"' + (App.settings.editBeforeCopy ? ' checked' : '') + ' style="width:22px;height:22px"> Show an edit box before copying</label>' +
      '<h3 style="margin-top:16px">Copy templates</h3><p class="help">Use {n}, {question}, {answer}, {next}, {hint}. Keep them short and natural for text-to-speech.</p>' +
      f('question', 'Question') + f('finalQuestion', 'Final question') + f('answer', 'Answer') + f('finalAnswer', 'Final answer') + f('hint', 'Hint') + f('leadIntro', 'Leaderboard intro') +
      '<div class="row" style="margin-top:12px"><button class="btn primary grow" data-act="save-settings">Save</button><button class="btn" data-act="reset-templates">Reset templates</button></div>');
  };
  App.actions['save-settings'] = function () {
    App.settings.calm = document.getElementById('s-calm').checked;
    App.settings.editBeforeCopy = document.getElementById('s-edit').checked;
    var t = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-tpl]'), function (i) {
      if (i.value.trim() && i.value !== Core.DEFAULT_TEMPLATES[i.dataset.tpl]) t[i.dataset.tpl] = i.value;
    });
    App.templates = t; App.save(); App.closeModal(); App.toast('Saved'); App.render();
  };
  App.actions['reset-templates'] = function () { App.templates = {}; App.save(); App.closeModal(); App.toast('Templates reset'); };
  App.actions['close-backdrop'] = function (el, ev) { if (ev.target === el) App.closeModal(); };

  /* ---------- events ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var fn = App.actions[el.dataset.act]; if (fn) fn(el, ev);
  });
  document.addEventListener('input', function (ev) {
    var k = ev.target.dataset && ev.target.dataset.input; if (k && App.inputs[k]) App.inputs[k](ev.target);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.enter) {
      ev.preventDefault(); var fn = App.actions[ev.target.dataset.enter]; if (fn) fn(ev.target, ev);
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (App.game && !App.game.finished && BY_ID[App.game.ids[App.game.index]]) App.view = 'play';
    else if (App.game && App.game.finished) App.view = 'results';
    else App.game = null;
    App.render();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  });
})();
