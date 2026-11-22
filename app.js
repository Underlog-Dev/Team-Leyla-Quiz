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

  /* ---------- themed backdrop (your illustrated images) ---------- */
  var IMGDIR = '';
  var IMG = {
    home: ['bg-home.jpg'], setup: ['bg-setup.jpg'], leader: ['bg-leader.jpg'],
    general: ['bg-general.jpg'], football: ['bg-football.jpg'], sports: ['bg-sports.jpg'], geography: ['bg-geography.jpg'],
    nature: ['bg-nature.jpg'], science: ['bg-science.jpg'], history: ['bg-history.jpg'], movies: ['bg-movies.jpg'],
    tv: ['bg-tv.jpg', 'bg-tv2.jpg'], music: ['bg-music.jpg'], celebrities: ['bg-celebrities.jpg'], gaming: ['bg-gaming.jpg'],
    food: ['bg-food.jpg'], tech: ['bg-tech.jpg'], space: ['bg-space.jpg']
  };
  var BANNER = { home: 1, setup: 1, leader: 1 };
  var bgOn = 'bgA', lastKey = null, preloaded = {};
  var portraitMQ = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null, lastArgs = null;
  function isPortrait() { return !!(portraitMQ && portraitMQ.matches); }
  function imgUrl(key, variant) {
    var l = IMG[key] || IMG.general;
    if (isPortrait()) return IMGDIR + 'bg-' + (IMG[key] ? key : 'general') + '-tall.jpg';
    return IMGDIR + l[(variant || 0) % l.length];
  }
  function setArt() { var vw = window.innerWidth, vh = window.innerHeight, sc = Math.max(vw / 900, vh / 1599), W = 900 * sc, H = 1599 * sc, st = document.documentElement.style;
    st.setProperty('--ax', ((vw - W) / 2) + 'px'); st.setProperty('--ay', ((vh - H) / 2) + 'px'); st.setProperty('--aw', W + 'px'); st.setProperty('--ah', H + 'px'); }
  setArt(); window.addEventListener('resize', setArt); window.addEventListener('orientationchange', setArt);
  if (portraitMQ) { var onOri = function () { if (lastArgs) { lastKey = null; App.setBackdrop(lastArgs[0], lastArgs[1]); } };
    if (portraitMQ.addEventListener) portraitMQ.addEventListener('change', onOri); else if (portraitMQ.addListener) portraitMQ.addListener(onOri); }
  App.preload = function (key, variant) {
    var u = imgUrl(key, variant); if (preloaded[u]) return; preloaded[u] = 1; var i = new Image(); i.src = u;
  };
  var bgToken = 0;
  App.setBackdrop = function (key, variant) {
    lastArgs = [key, variant];
    var th = THEMES[key] || THEMES.general, url = imgUrl(key, variant), sig = url;
    document.body.classList.toggle('pg-banner', !!BANNER[key]); document.body.setAttribute('data-theme', key);
    if (lastKey === sig) return; lastKey = sig;
    var token = ++bgToken;
    /* only swap once the picture has loaded, so you never see an empty background */
    var done = false;
    var show = function () {
      if (done || token !== bgToken) return; done = true;
      var next = bgOn === 'bgA' ? 'bgB' : 'bgA';
      var el = document.getElementById(next), old = document.getElementById(bgOn);
      el.style.backgroundImage = 'url(' + url + '), linear-gradient(160deg,' + th.c1 + ',' + th.c2 + ')';
      document.getElementById('bgblur').style.backgroundImage = 'url(' + url + ')';
      void el.offsetWidth; el.classList.add('on'); old.classList.remove('on'); bgOn = next;
    };
    var im = new Image(); im.onload = show; im.onerror = show; im.src = url;
    if (im.complete) show();
  };
  /* warm the cache with the page backgrounds so Home/Setup/Leaderboard appear instantly */
  setTimeout(function () { ['home', 'setup', 'leader'].forEach(function (k) { App.preload(k); }); }, 1500);

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
  App.hud = function (extra) {
    var h = App.view !== 'home' ? '<button class="icon-btn" data-act="go-home" aria-label="Home">🏠</button>' : '';
    return '<div class="hud">' + (extra || '') + h +
      '<button class="icon-btn" data-act="open-stats" aria-label="Question bank statistics">📊</button>' +
      '<button class="icon-btn" data-act="open-settings" aria-label="Settings">⚙️</button></div>';
  };
  App.topbar = App.hud;

  var SCROLLERS = '.zone, .setup-grid .col, .drawer-in, .lb-scroll, .qcard, .modal';
  App.render = function () {
    var app = document.getElementById('app');
    /* keep scroll positions when a click only refreshes the same screen */
    var keep = null;
    if (!App.resetScroll && App._lastView === App.view) {
      keep = { y: window.pageYOffset, els: [].map.call(app.querySelectorAll(SCROLLERS), function (e) { return e.scrollTop; }) };
    }
    App.resetScroll = false; App._lastView = App.view;
    App._render();
    if (keep) {
      [].forEach.call(app.querySelectorAll(SCROLLERS), function (e, i) { if (keep.els[i]) e.scrollTop = keep.els[i]; });
      if (keep.y) window.scrollTo(0, keep.y);
    }
  };
  App._render = function () {
    var app = document.getElementById('app');
    document.body.classList.toggle('calm', !!App.settings.calm);
    var v = App.view;
    if ((v === 'play' || v === 'results') && !App.game) v = App.view = 'home';
    if (v === 'play') App.renderPlay(app);
    else if (v === 'results') App.renderResults(app);
    else if (v === 'setup') { App.setBackdrop('setup'); renderSetup(app); }
    else if (v === 'leader') { App.setBackdrop('leader'); renderLeader(app); }
    else { App.view = 'home'; App.setBackdrop('home'); renderHome(app); }
  };

  /* ---------- home ---------- */
  function renderHome(app) {
    var resume = App.game ? '<button class="btn yellow" data-act="resume">▶ Resume quiz</button>' : '';
    app.innerHTML = '<div class="v-home">' + App.hud() + '<div class="zone">' +
      '<button class="btn yellow play-btn" data-act="go-setup">▶ Play</button>' +
      '<div class="home-links">' + resume + '<button class="btn" data-act="go-leader">🏆 Leaderboard</button></div>' +
      '</div></div>';
  }

  /* ---------- game selection ---------- */
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
    var msg = '';
    if (avail === 0) msg = '<span class="notice warn">No unused questions left for these settings.</span>';
    else if (avail < want) msg = '<span class="notice">Only ' + avail + ' unused questions match.</span>';
    else msg = '<span class="help">' + avail + ' questions available</span>';
    app.innerHTML = '<div class="v-setup">' + App.hud() + '<div class="zone"><section class="glass" aria-label="Game selection"><div class="setup-grid">' +
      '<div class="col"><label class="lbl">Game mode</label>' + seg('mode', [{ v: 'solo', l: '👤 Solo' }, { v: 'host', l: '👥 Host (multiplayer)' }], s.mode) +
      '<label class="lbl">Answer format</label>' + seg('format', [{ v: 'open', l: 'Open answer' }, { v: 'mc', l: 'Multiple choice' }], s.format) +
      '<label class="lbl">Difficulty</label>' + seg('difficulty', [{ v: 'easy', l: 'Easy 1pt', cls: 'easy' }, { v: 'medium', l: 'Medium 2pts', cls: 'medium' }, { v: 'hard', l: 'Hard 3pts', cls: 'hard' }, { v: 'mixed', l: 'Mixed', cls: 'mixed' }], s.difficulty) +
      '<label class="lbl">Number of questions</label>' + seg('count', countOpts, s.count) +
      (s.count === 'custom' ? '<input type="number" min="1" max="500" inputmode="numeric" placeholder="How many?" value="' + esc(s.custom) + '" data-input="custom" style="margin-top:.4em">' : '') +
      (s.mode === 'solo' ? '<label class="lbl">Timer per question</label>' + seg('timer', [{ v: 0, l: 'Off' }, { v: 15, l: '15s' }, { v: 30, l: '30s' }, { v: 60, l: '60s' }], s.timer) : '') +
      '</div><div class="col"><label class="lbl">Themes <span class="help">(pick several, or none for all)</span></label><div class="seg">' + themeChips + '</div>' +
      (subHtml ? '<details style="margin-top:.5em"><summary class="help">Narrow by subcategory (optional)</summary>' + subHtml + '</details>' : '') + '</div></div>' +
      '<div class="setup-actions">' + msg + '<button class="btn primary" data-act="start"' + (avail === 0 ? ' disabled' : '') + '>Start quiz 🐣</button></div></section></div></div>';
  }

  /* ---------- leaderboard page ---------- */
  App.hist = store.get('hist', []); App.alltime = store.get('alltime', {}); App.lbTab = 'recent';
  App.recordGame = function (g) {
    if (g.recorded) return; g.recorded = true;
    var entry = { t: Date.now(), mode: g.mode, total: g.total, themes: (g.setup.themes.length ? g.setup.themes : ORDER).map(function (k) { return THEMES[k].label; }) };
    if (g.mode === 'host') {
      entry.players = Core.rankPlayers(g.host.players).map(function (p) { return { name: p.name, score: p.score, rank: p.rank }; });
      entry.players.forEach(function (p) {
        var k = Core.normalizeText(p.name), a = App.alltime[k] = App.alltime[k] || { name: p.name, points: 0, games: 0, wins: 0 };
        a.points += p.score; a.games++; if (p.rank === 1 && p.score > 0) a.wins++;
      });
    } else entry.solo = { score: g.solo.score, correct: g.solo.correct };
    App.hist.unshift(entry); App.hist = App.hist.slice(0, 30);
    store.set('hist', App.hist); store.set('alltime', App.alltime);
  };
  function renderLeader(app) {
    var body;
    if (App.lbTab === 'alltime') {
      var list = Object.keys(App.alltime).map(function (k) { var a = App.alltime[k]; return { id: k, name: a.name, score: a.points, games: a.games, wins: a.wins }; });
      var ranked = Core.rankPlayers(list), by = {}; list.forEach(function (x) { by[x.id] = x; });
      body = ranked.length ? '<div class="lb-scroll">' + ranked.slice(0, 50).map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="help" style="margin:0">' + by[p.id].games + ' games · ' + by[p.id].wins + ' wins</span><span class="lb-score">' + p.score + '</span></div>';
      }).join('') + '</div><div class="row" style="margin-top:.5em"><button class="btn small primary" data-act="copy-alltime">📋 Copy all-time top three</button><button class="btn small danger" data-act="clear-lb">Clear</button></div>'
        : '<p class="help">No host games finished yet. Players you award points to appear here after a quiz ends.</p>';
    } else {
      body = App.hist.length ? '<div class="lb-scroll">' + App.hist.map(function (h) {
        var d = new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var inner = h.players ? (h.players.slice(0, 3).map(function (p) { return p.rank + '. ' + esc(p.name) + ' (' + p.score + ')'; }).join(' · ') || 'No points awarded') : 'Solo: ' + h.solo.score + ' pts, ' + h.solo.correct + '/' + h.total + ' correct';
        return '<div class="lb-item" style="display:block"><b>' + d + ' · ' + (h.mode === 'host' ? 'Host' : 'Solo') + ' · ' + h.total + ' questions</b><div class="help">' + inner + '</div></div>';
      }).join('') + '</div>' : '<p class="help">No finished quizzes yet - play one and it appears here.</p>';
    }
    app.innerHTML = '<div class="v-leader">' + App.hud() + '<div class="zone"><section class="glass"><div class="tabs">' +
      '<button class="chip" data-act="lbtab" data-v="recent" aria-pressed="' + (App.lbTab === 'recent') + '">Recent games</button>' +
      '<button class="chip" data-act="lbtab" data-v="alltime" aria-pressed="' + (App.lbTab === 'alltime') + '">All-time (this device)</button></div>' + body +
      '</section></div></div>';
  }
  App.actions.lbtab = function (el) { App.lbTab = el.dataset.v; App.render(); };
  App.actions['copy-alltime'] = function () {
    var list = Object.keys(App.alltime).map(function (k) { return { id: k, name: App.alltime[k].name, score: App.alltime[k].points }; });
    App.copy(Core.leaderboardCopy(list, App.templates), 'leaderboard');
  };
  App.actions['clear-lb'] = function () { if (window.confirm('Clear saved leaderboards on this device?')) { App.hist = []; App.alltime = {}; store.set('hist', []); store.set('alltime', {}); App.render(); } };
  App.actions['go-home'] = function () { App.view = 'home'; App.render(); window.scrollTo(0, 0); };
  App.actions['go-setup'] = function () { App.view = 'setup'; App.render(); window.scrollTo(0, 0); };
  App.actions['go-leader'] = function () { App.view = 'leader'; App.render(); window.scrollTo(0, 0); };

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
    if (App.game && !BY_ID[App.game.ids[App.game.index]]) App.game = null;
    App.view = 'home';
    App.render();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  });
})();
