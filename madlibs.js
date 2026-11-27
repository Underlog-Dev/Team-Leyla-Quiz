/* Team Leyla Game Night - Mad Libs Theatre UI: setup, audience word collection, curtain reveal, performance,
   Streamer (fixed capture box) + private play, history, resume. Scripts/banks are data (data/madlibs-*.js). */
(function () {
  'use strict';
  var App = window.App, ML = window.MadLibs, esc = App.esc, store = App.store;
  var SCRIPTS = window.ML_SCRIPTS || [], BANKS = window.ML_BANKS || {}, BYID = {};
  SCRIPTS.forEach(function (s) { BYID[s.id] = s; });
  var MV = App.MVIEWS = { mlhome: 1, mlsetup: 1, mlplay: 1 };
  App.HVIEWS.mlhome = 1; App.HVIEWS.mlsetup = 1; App.HVIEWS.mlplay = 1;
  var LEVELS = [['family', '😇 Family Friendly'], ['funny', '😂 Funny & Ridiculous'], ['chaos', '🔥 Absolute Chaos']];
  var LENS = [['s', 'Short'], ['m', 'Standard'], ['l', 'Extended']];
  var SIZES = [4.6, 5.4, 6.4, 7.6, 9.0];   /* story text size in cqmin of the white panel: big enough for a phone watching the stream */
  var DEF = { actors: 2, names: ['', '', '', ''], cat: 'any', len: 'm', level: 'chaos', randActing: 1, noRepeat: 1, mode: 'private' };
  App.mlsetup = Object.assign({}, DEF, store.get('mlsetup', {}));
  App.mgame = store.get('mgame', null);
  App.mdone = store.get('mdone', []); App.mlast = store.get('mlast', '');
  if (App.mgame && !BYID[App.mgame.sid]) App.mgame = null;
  function save() { store.set('mlsetup', App.mlsetup); store.set('mgame', App.mgame); store.set('mdone', App.mdone); store.set('mlast', App.mlast); }
  function S() { return BYID[App.mgame.sid]; }
  function cats() { var seen = {}; SCRIPTS.forEach(function (s) { seen[s.cat] = 1; }); return Object.keys(seen).sort(); }
  function filt(s) { return { actors: s.actors, cat: s.cat, len: s.len, level: s.level }; }
  function avail(s, noRep) { return ML.eligible(SCRIPTS, filt(s), App.mdone, noRep == null ? !!s.noRepeat : noRep); }
  function go(v) { App.view = v; App.resetScroll = true; App.render(); window.scrollTo(0, 0); }
  function stream(g) { return !!(App.embed || g.stream); }
  function names(g) { return g.names; }
  var tick = null;
  if (window.ML_THEME && window.ML_THEME.panelBg) document.documentElement.style.setProperty('--mlz-bg', window.ML_THEME.panelBg);

  App.actions['ml-resume'] = function () { go('mlplay'); };

  /* ---------- zones on the artwork ---------- */
  function zone(cls, inner, extra) { return '<div class="mlz ' + cls + '"' + (extra || '') + '>' + inner + '</div>'; }
  function box(key, cls, inner) { var u = App.tallImg(key); return '<div class="sbox ml ' + (cls || '') + '" id="sbox"' + (u ? ' style="background-image:url(\'' + u + '\')"' : '') + '>' + inner + '</div>'; }
  var CAT_ICON = { 'Crime & Mystery': '🕵️', 'Everyday Disasters': '💥', 'Fantasy & Film': '🧙', 'Medical & Embarrassing': '🩺', 'Romance': '💘', 'Ridiculous': '🤪', 'TV & Sport': '📺' };

  /* ---------- home (art buttons) ---------- */
  function renderHomeScreen(app) {
    App.setBackdrop('mlhome');
    app.innerHTML = '<div class="v-mode v-mlhome">' + App.hud() +
      '<button class="hit hit-mlplay" data-act="ml-play" aria-label="Play Mad Libs Theatre"></button>' +
      '<button class="hit hit-mlback" data-act="go-mode" aria-label="Back to main menu"></button></div>';
  }
  App.actions['pick-madlibs'] = function () { go('mlhome'); };
  App.actions['ml-home'] = function () { go('mlhome'); };
  App.actions['ml-play'] = function () { go('mlsetup'); };

  /* ---------- setup (clipboard art) ---------- */
  function chip(act, k, v, label, on) { return '<button class="chip" data-act="' + act + '" data-k="' + k + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + label + '</button>'; }
  function renderSetup(app) {
    App.setBackdrop('mlsetup');
    var s = App.mlsetup, n = +s.actors, list = avail(s), all = avail(s, false);
    var catChips = chip('ml-set', 'cat', 'any', '🎲 Random', s.cat === 'any') + cats().map(function (c) { return chip('ml-set', 'cat', c, (CAT_ICON[c] || '🎭') + ' ' + esc(c), s.cat === c); }).join('');
    var nameInputs = ''; for (var i = 0; i < n; i++) nameInputs += '<input type="text" maxlength="24" placeholder="Actor ' + (i + 1) + '" value="' + esc(s.names[i] || '') + '" data-input="mlname" data-i="' + i + '" autocomplete="off" autocapitalize="words" aria-label="Actor ' + (i + 1) + ' name">';
    var msg;
    if (!all.length) msg = '<span class="notice warn">No scripts match these settings yet. Try another length, category or actor count.</span>';
    else if (!list.length) msg = '<span class="notice warn">You have played every script for these settings. <button class="btn small" data-act="ml-reset-sel">Reset this selection</button></span>';
    else msg = '<span class="ml-avail">' + list.length + ' unplayed of ' + all.length + ' scripts match</span>';
    var resume = App.mgame ? '<button class="btn yellow" data-act="ml-resume">▶ Resume unfinished show</button>' : '';
    var modeSeg = App.embed ? '' : '<div class="lbl">How are you playing?</div><div class="seg">' + chip('ml-set', 'mode', 'private', '🏠 Private / friends', s.mode === 'private') + chip('ml-set', 'mode', 'stream', '📺 TikTok Live capture box', s.mode === 'stream') + '</div>';
    var body = '<div class="ml-su"><div class="ml-sh"><button class="btn small" data-act="ml-home">‹ Back</button><h2>🎭 Set the stage</h2></div>' + (resume ? '<div class="row ml-resume">' + resume + '</div>' : '') +
      '<div class="ml-sgrid"><div><div class="lbl">Actors</div><div class="seg">' + [1, 2, 3, 4].map(function (x) { return chip('ml-set', 'actors', x, x, n === x); }).join('') + '</div>' +
      '<div class="lbl">Actor names</div><div class="ml-names">' + nameInputs + '</div>' +
      '<div class="lbl">Length</div><div class="seg">' + LENS.map(function (l) { return chip('ml-set', 'len', l[0], l[1], s.len === l[0]); }).join('') + '</div>' +
      '<div class="lbl">Comedy level</div><div class="seg">' + LEVELS.map(function (l) { return chip('ml-set', 'level', l[0], l[1], s.level === l[0]); }).join('') + '</div></div>' +
      '<div><div class="lbl">Scenario</div><div class="seg">' + catChips + '</div>' +
      '<div class="lbl">Options</div><div class="seg">' + chip('ml-set', 'randActing', 1, '🎬 Extra random acting', s.randActing ? true : false).replace('data-v="1"', 'data-v="' + (s.randActing ? 0 : 1) + '"') + chip('ml-set', 'noRepeat', 1, '♻️ No repeats', s.noRepeat ? true : false).replace('data-v="1"', 'data-v="' + (s.noRepeat ? 0 : 1) + '"') + '</div>' + modeSeg + '</div></div><div class="row"><button class="btn small" data-act="ml-reset-hist">♻️ Reset played history</button></div></div>';
    var foot = '<div class="ml-sf">' + msg + '<button class="btn primary big" data-act="ml-start"' + (list.length ? '' : ' disabled') + '>🎭 Start the show</button></div>';
    app.innerHTML = '<div class="v-ml s-setup">' + App.hud() + zone('z-setup', body) + zone('z-setupf', foot) + '</div>';
  }
  App.actions['ml-set'] = function (el) {
    var k = el.dataset.k, v = el.dataset.v, s = App.mlsetup;
    s[k] = (k === 'actors' || k === 'randActing' || k === 'noRepeat') ? parseInt(v, 10) : v; save(); App.render();
  };
  App.inputs.mlname = function (el) { App.mlsetup.names[parseInt(el.dataset.i, 10)] = el.value; store.set('mlsetup', App.mlsetup); };
  App.actions['ml-reset-hist'] = function () { if (!window.confirm('Reset played history? Every script can appear again.')) return; App.mdone = []; App.mlast = ''; save(); App.toast('Played history reset'); App.render(); };
  App.actions['ml-reset-sel'] = function () {
    var ids = ML.eligible(SCRIPTS, filt(App.mlsetup), [], false).map(function (s) { return s.id; });
    App.mdone = App.mdone.filter(function (id) { return ids.indexOf(id) === -1; }); save(); App.toast('History reset for this selection'); App.render();
  };

  /* ---------- starting / games ---------- */
  function begin(script) {
    var s = App.mlsetup;
    var g = ML.newGame(script, { names: s.names, randActing: s.randActing, level: s.level }, BANKS);
    g.stream = App.embed ? true : s.mode === 'stream'; g.setupLevel = s.level;
    App.mgame = g; App.mlast = script.id; save();
  }
  App.actions['ml-start'] = function () {
    var list = avail(App.mlsetup); if (!list.length) { App.toast('No unplayed scripts for these settings'); return; }
    begin(ML.pickScript(list, null, App.mlast)); go('mlplay');
  };
  App.actions['ml-again'] = function () { var sc = S(); begin(sc); App.mgame.draft = null; save(); go('mlplay'); };
  App.actions['ml-next-script'] = function () {
    var list = avail(App.mlsetup);
    if (!list.length) {
      App.openModal('<h2>🎭 That’s every script for these settings!</h2><p class="help">You have played all of them. You can reset the history for this selection, or change the filters.</p><div class="row"><button class="btn primary" data-act="ml-modal-reset">♻️ Reset this selection</button><button class="btn" data-act="ml-change">⚙ Change settings</button></div>');
      return;
    }
    begin(ML.pickScript(list, null, App.mlast)); go('mlplay');
  };
  App.actions['ml-modal-reset'] = function () { App.actions['ml-reset-sel'](); App.closeModal(); App.actions['ml-next-script'](); };
  App.actions['ml-change'] = function () { App.closeModal(); go('mlsetup'); };
  App.actions['ml-settings'] = function () { go('mlsetup'); };
  App.actions['ml-quit'] = function () { App.closeModal(); if (!window.confirm('Quit this show? Unfinished scripts do not count as played.')) return; App.mgame = null; save(); go('mlsetup'); };

  /* ---------- inputs ---------- */
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function sync() { var g = App.mgame; if (!g || g.stage !== 'collect' && g.editI == null) return; var i = g.editI != null ? g.editI : g.i; var a = document.getElementById('ml-ans'); if (!a) return; g.draft = { i: i, ans: a.value, user: val('ml-user') }; }
  function req(g) { return g.reqs[g.editI != null ? g.editI : g.i]; }

  /* ---------- word-type help (tap the underlined words) ---------- */
  function examples(type) {
    var b = BANKS[type] || {}, a = (b.a || []).filter(function (x) { return x.length <= 46; }), n = (b.g === 'phrase' || b.g === 'clause') ? 2 : 3, out = [];
    for (var j = 0; j < n && a.length; j++) { var x = a[Math.floor((j + 0.3) * a.length / n)]; if (out.indexOf(x) < 0) out.push(x); }
    return out;
  }
  function promptHtml(r, g) {
    var b = BANKS[r.type] || {}, p = r.prompt, u = b.u, i = u ? p.toLowerCase().indexOf(u.toLowerCase()) : -1;
    if (i < 0) return esc(p);
    return esc(p.slice(0, i)) + '<button class="ml-ul" data-act="ml-help" aria-expanded="' + (g && g.helpK === r.k) + '" aria-label="What does this mean?">' + esc(p.slice(i, i + u.length)) + '</button>' + esc(p.slice(i + u.length));
  }
  function helpCard(r) {
    var b = BANKS[r.type] || {}, ex = examples(r.type);
    return '<div class="ml-helpcard" role="note"><div class="ml-hd">“' + esc(b.u || r.prompt) + '” means:</div><div>' + esc(b.d || '') + '</div>' + (r.hint ? '<div class="ml-ex">' + esc(r.hint) + '</div>' : '') +
      (ex.length ? '<div class="ml-ex">For example: ' + ex.map(function (x) { return '<b>' + esc(x) + '</b>'; }).join(' &nbsp;·&nbsp; ') + '</div>' : '') + '</div>';
  }
  App.actions['ml-help'] = function () { var g = App.mgame; if (!g) return; sync(); var r = req(g); g.helpK = g.helpK === r.k ? null : r.k; save(); App.render(); };

  /* ---------- collection ---------- */
  function ansRow(g, r) {
    var d = g.draft && g.draft.i === g.i ? g.draft : null;
    return '<div class="ml-ansrow"><button class="ml-ib" data-act="ml-random" aria-label="Random funny suggestion">🎲</button><input type="text" id="ml-ans" maxlength="' + ML.MAXLEN + '" placeholder="Answer" value="' + esc(d ? d.ans : r.ans) + '" data-enter="ml-confirm" autocomplete="off" aria-label="Answer"><button class="ml-ib ok" data-act="ml-confirm" aria-label="Confirm answer">✅</button></div>';
  }
  function collectPanel(g, st) {
    var r = g.reqs[g.i], n = g.reqs.length, long = r.prompt.length > 62 ? ' vlong' : r.prompt.length > 40 ? ' long' : '';
    var h = '<div class="ml-count">Word ' + (g.i + 1) + ' of ' + n + '</div><div class="ml-need">CHAT, WE NEED…</div><div class="ml-prompt' + long + '">' + promptHtml(r, g) + '</div>';
    var showing = r.done && (st || (g.adv && advT && g.editI == null));
    if (g.helpK === r.k) h += helpCard(r);
    else if (!st && !showing) h += ansRow(g, r);
    else if (showing) h += '<div class="ml-chosen"><div class="ml-tick">✅ CHOSEN</div><div class="ml-answer' + (r.ans.length > 40 ? ' long' : '') + '">' + esc(r.ans) + '</div>' + '</div>';
    else h += '<div class="ml-dots">' + g.reqs.map(function (x, i) { return '<i class="' + (x.done ? 'on' : '') + (i === g.i ? ' cur' : '') + '"></i>'; }).join('') + '</div>';
    if (!st) h += '<div class="ml-host"><button class="ml-ib" data-act="ml-prev" aria-label="Previous word"' + (g.i === 0 ? ' disabled' : '') + '>◀</button><input type="text" id="ml-user" maxlength="' + ML.MAXUSER + '" placeholder="@ chat username (optional)" value="' + esc(g.draft && g.draft.i === g.i ? g.draft.user : r.user) + '" data-enter="ml-confirm" autocomplete="off" autocapitalize="off" aria-label="Chat username"><button class="ml-ib" data-act="ml-next" aria-label="Next word">▶</button><button class="ml-ib" data-act="ml-menu" aria-label="More">☰</button></div>';
    return '<div class="ml-pn">' + h + '</div>';
  }
  function collectStrip(g, st) {
    var r = g.reqs[g.i], who = r.done && r.user && !(g.editI != null) ? '<div class="ml-strip done"><b>' + esc(r.user) + '</b></div>' : '<div class="ml-strip"></div>';
    return who;
  }
  function editList(g) {
    return '<div class="ml-edit">' + g.reqs.map(function (r, i) { return '<div class="ml-erow"><span class="n">' + (i + 1) + '</span><span class="p">' + esc(r.prompt) + '</span><b>' + (r.ans ? esc(r.ans) : '<em>empty</em>') + '</b><button class="btn small" data-act="ml-goto" data-i="' + i + '">✎</button></div>'; }).join('') + '</div>';
  }
  function collectCtl(g) {
    var i = g.editI != null ? g.editI : g.i, r = g.reqs[i], d = g.draft && g.draft.i === i ? g.draft : null;
    var av = d ? d.ans : r.ans, uv = d ? d.user : r.user, ok = g.reqs.filter(function (x) { return x.done; }).length, last = g.i === g.reqs.length - 1;
    var all = ML.allDone(g);
    var h = '<div class="ml-ctl-top"><span class="pill">🎭 Word ' + (i + 1) + ' of ' + g.reqs.length + '</span><span class="pill">' + ok + ' confirmed</span></div>' +
      '<div class="ml-need-priv">' + esc(r.prompt) + '</div>' +
      '<div class="row"><input type="text" id="ml-ans" maxlength="' + ML.MAXLEN + '" placeholder="Answer you picked from chat" value="' + esc(av) + '" data-enter="ml-confirm" autocomplete="off" class="grow"></div>' +
      '<div class="row"><input type="text" id="ml-user" maxlength="' + ML.MAXUSER + '" placeholder="Chat username (optional)" value="' + esc(uv) + '" data-enter="ml-confirm" autocomplete="off" autocapitalize="off" class="grow"></div>' +
      '<div class="row"><button class="btn" data-act="ml-random">🎲 Random funny suggestion</button><button class="btn primary" data-act="ml-confirm">✅ Confirm answer</button></div>' +
      '<div class="row"><button class="btn" data-act="ml-help">ℹ️ Explain this word type</button></div>' +
      '<div class="row ml-nav"><button class="btn" data-act="ml-prev"' + (g.i === 0 && g.editI == null ? ' disabled' : '') + '>← Previous</button><button class="btn" data-act="ml-edit">✎ Edit answers</button><button class="btn' + (r.done ? ' yellow' : '') + '" data-act="ml-next">' + (g.editI != null ? 'Back to words' : last ? 'Finish →' : 'Next word →') + '</button></div>';
    if (all) h += '<button class="btn yellow big sc-again" data-act="ml-ready">🎬 All words in – go to the reveal</button>';
    if (g.editOpen) h += editList(g);
    h += '<div class="row ml-foot"><button class="btn small" data-act="ml-quit">✕ Quit show</button></div>';
    return h;
  }
  App.actions['ml-menu'] = function () {
    var g = App.mgame; if (!g) return; sync();
    var h = '<h2>🎭 Show menu</h2><p class="help">' + g.reqs.filter(function (x) { return x.done; }).length + ' of ' + g.reqs.length + ' words confirmed. Tap ✎ to jump to a word.</p>' + editList(g) + '<div class="row">' + (ML.allDone(g) ? '<button class="btn yellow" data-act="ml-ready">🎬 Go to the reveal</button>' : '') + '<button class="btn" data-act="ml-quit">✕ Quit show</button><button class="btn primary" data-act="close-modal">Close</button></div>';
    App.openModal(h);
  };
  App.actions['ml-random'] = function () {
    var g = App.mgame; if (!g) return; sync(); var r = req(g), used = g.reqs.map(function (x) { return x.ans; });
    var a = ML.randomAnswer(BANKS, r.type, g.level, null, used.concat([g.draft && g.draft.ans])); g.draft = { i: g.editI != null ? g.editI : g.i, ans: a, user: '' }; save(); App.render();
  };
  var advT = null;
  function stopAdv(g) { if (advT) { clearTimeout(advT); advT = null; } if (g) g.adv = false; }
  function advance(g) {
    if (!g || App.mgame !== g || g.stage !== 'collect' || g.editI != null) return;
    stopAdv(g); g.draft = null; g.helpK = null;
    if (g.i < g.reqs.length - 1) g.i++; else if (ML.allDone(g)) g.stage = 'ready';
    save(); App.render();
  }
  function confirmNow(g, ans, user) {
    stopAdv(g);
    var r = req(g); r.ans = ans; r.user = user; r.done = true; g.draft = null; g.helpK = null; App.closeModal();
    if (g.editI != null) { g.editI = null; if (g.stage === 'collect') g.editOpen = true; }
    if (g.stage === 'collect' && g.editI == null) { g.adv = true; var gi = g.i; advT = setTimeout(function () { if (g.adv && g.i === gi) advance(g); }, 5000); }
    save(); App.render();
  }
  App.actions['ml-confirm'] = function () {
    var g = App.mgame; if (!g) return; sync(); var d = g.draft; var ans = ML.clean(d ? d.ans : '', ML.MAXLEN), user = ML.clean(d ? d.user : '', ML.MAXUSER).replace(/^@+/, '');
    if (!ans) { App.toast('Type an answer or tap Random first'); return; }
    var bad = ML.checkWord(req(g).type, ans, BANKS, window.ML_POS);
    if (bad) { App.toast(bad + ' Try another word.'); return; }
    if (ML.flagged(ans)) {
      g.pending = { ans: ans, user: user };
      App.openModal('<h2>⚠️ Heads up</h2><p>“' + esc(ans) + '” may break TikTok’s rules. It will <b>not</b> be changed unless you choose to.</p><div class="row"><button class="btn" data-act="ml-flag-use">Use it anyway</button><button class="btn primary" data-act="ml-flag-change">Pick something else</button></div>'); return;
    }
    confirmNow(g, ans, user);
  };
  App.actions['ml-flag-use'] = function () { var g = App.mgame, p = g && g.pending; App.closeModal(); if (p) { g.pending = null; confirmNow(g, p.ans, p.user); } };
  App.actions['ml-flag-change'] = function () { var g = App.mgame; if (g) g.pending = null; App.closeModal(); };
  App.actions['ml-prev'] = function () { var g = App.mgame; stopAdv(g); sync(); if (g.editI != null) { g.editI = null; } else if (g.i > 0) g.i--; g.draft = null; g.helpK = null; save(); App.render(); };
  App.actions['ml-next'] = function () {
    var g = App.mgame; stopAdv(g); sync();
    if (g.editI != null) { g.editI = null; g.draft = null; save(); App.render(); return; }
    var r = g.reqs[g.i]; if (!r.done) { App.toast('Confirm an answer first'); return; }
    g.draft = null; g.helpK = null; if (g.i < g.reqs.length - 1) g.i++; else if (ML.allDone(g)) { g.stage = 'ready'; } else App.toast('Some words are still empty – open the menu to fill them');
    save(); App.render();
  };
  App.actions['ml-edit'] = function () { var g = App.mgame; sync(); g.editOpen = !g.editOpen; save(); App.render(); };
  App.actions['ml-goto'] = function (el) {
    var g = App.mgame; stopAdv(g); sync(); var i = parseInt(el.dataset.i, 10); App.closeModal(); g.helpK = null;
    if (g.stage === 'collect') { g.i = i; g.editI = null; } else { g.editI = i; if (!stream(g)) { g.draft = null; save(); App.render(); editModal(g); return; } }
    g.draft = null; save(); App.render();
  };
  function editModal(g) {
    var r = g.reqs[g.editI];
    App.openModal('<h2>✎ Change a word</h2><div class="ml-need-priv">' + esc(r.prompt) + '</div><div class="row"><input type="text" id="ml-ans" maxlength="' + ML.MAXLEN + '" value="' + esc(r.ans) + '" data-enter="ml-confirm" class="grow" aria-label="Answer"></div><div class="row"><input type="text" id="ml-user" maxlength="' + ML.MAXUSER + '" placeholder="Chat username (optional)" value="' + esc(r.user) + '" data-enter="ml-confirm" class="grow" aria-label="Chat username"></div><div class="row"><button class="btn" data-act="ml-random">🎲 Random</button><button class="btn primary" data-act="ml-confirm">✅ Save change</button><button class="btn" data-act="ml-edit-cancel">Cancel</button></div>');
  }
  App.actions['ml-ready'] = function () { var g = App.mgame; App.closeModal(); if (!ML.allDone(g)) { App.toast('Fill every word first'); return; } g.stage = 'ready'; g.helpK = null; save(); App.render(); };
  App.actions['ml-back-words'] = function () { var g = App.mgame; g.stage = 'collect'; g.i = g.reqs.length - 1; g.editOpen = true; save(); App.render(); };

  /* ---------- ready + reveal ---------- */
  function readyPanel(g, st) {
    return '<div class="ml-pn"><div class="ml-need">ALL ' + g.reqs.length + ' WORDS ARE IN!</div><div class="ml-prompt">Are the actors ready?</div><div class="ml-curtains" aria-hidden="true"><i></i><i></i></div>' +
      (st ? '<div class="ml-cta">🎬 The curtain is about to rise…</div>' : '<button class="btn yellow big ml-reveal-btn" data-act="ml-reveal">🎭 REVEAL STORY</button><div class="ml-host two"><button class="btn small" data-act="ml-back-words">← Edit answers</button><button class="btn small" data-act="ml-quit">✕ Quit show</button></div>') + '</div>';
  }
  function readyCtl(g) {
    return '<div class="ml-ctl-top"><span class="pill">🎭 Ready</span></div><button class="btn yellow big sc-again ml-reveal-btn" data-act="ml-reveal">🎭 REVEAL STORY</button><div class="row"><button class="btn" data-act="ml-back-words">← Edit answers</button><button class="btn small" data-act="ml-quit">✕ Quit show</button></div>';
  }
  App.actions['ml-reveal'] = function () {
    var g = App.mgame; if (!ML.allDone(g)) return; g.stage = 'story'; g.anim = 1; g.line = 0; g.fin = 0;
    if (App.mdone.indexOf(g.sid) === -1) App.mdone.push(g.sid);   /* only counts as played once the story is revealed */
    save(); App.render();
  };

  /* ---------- story ---------- */
  function segHtml(segs, by) {
    return segs.map(function (s) { return s.t === 'w' ? '<mark class="ml-w"' + (by[s.k] ? ' title="@' + esc(by[s.k]) + '"' : '') + '>' + esc(s.v) + '</mark>' : esc(s.v); }).join('');
  }
  function byMap(g) { var m = {}; g.reqs.forEach(function (r) { if (r.user) m[r.k] = r.user; }); return m; }
  function lineHtml(it, by, copy) {
    if (it.kind === 'dir') return '<div class="ml-line dir"><em>(' + segHtml(it.segs, by) + ')</em></div>';
    var ac = it.acting ? '<span class="ml-act">(' + segHtml(it.actingSegs, by) + ')</span> ' : it.extra ? '<span class="ml-act extra">(' + esc(it.extra) + ')</span> ' : '';
    return '<div class="ml-line c' + it.roleIdx + '"><span class="ml-who">' + esc(it.who) + '</span> ' + ac + '<span class="ml-say">' + segHtml(it.segs, by) + '</span>' + (copy ? '<button class="copydot" data-act="ml-copy-line" data-i="' + it.i + '" aria-label="Copy this line">📋</button>' : '') + '</div>';
  }
  function creditList(g) { var u = []; g.reqs.forEach(function (r) { if (r.user && u.indexOf(r.user) === -1) u.push(r.user); }); return u; }
  function credits(g) { var u = creditList(g); return u.length ? '<div class="ml-credits">🌟 Words from chat: ' + u.map(function (x) { return '@' + esc(x); }).join(' · ') + '</div>' : ''; }
  function finaleBtns() {
    return '<div class="ml-fin-btns"><button class="btn yellow big" data-act="ml-again">🔁 Play again<small>same scene, new words</small></button><button class="btn primary big" data-act="ml-next-script">🎲 New scenario</button><div class="row"><button class="btn" data-act="ml-settings">⚙ Change settings</button><button class="btn" data-act="ml-unfin">📜 Read it again</button><button class="btn" data-act="go-mode">🎮 Main menu</button></div></div>';
  }
  function storyPanel(g, sc, st) {
    var fs = '--mlfs:' + SIZES[g.size - 1] + 'cqmin';
    if (g.fin) {
      return '<div class="ml-pn fin" style="' + fs + '"><div class="ml-fin-t">🎭 THE END 🎭</div><div class="ml-fin-s">' + esc(sc.t) + '</div>' + credits(g) + '<div class="ml-thanks">Thanks for playing! 👏</div>' + (st ? '' : finaleBtns()) + '</div>';
    }
    var items = ML.build(sc, g), by = byMap(g);
    var cast = '<div class="ml-cast">' + sc.roles.map(function (r, i) { return '<span class="ml-chip c' + i + '"><b>' + esc(ML.actorName(g, sc, i)) + '</b> as ' + esc(r) + '</span>'; }).join('') + '</div>';
    var head = '<div class="ml-head"><div class="ml-title">' + esc(sc.t) + '</div><div class="ml-desc">' + esc(sc.desc) + '</div>' + cast + '</div>';
    var body;
    if (g.view === 'line') {
      var it = items[Math.min(g.line, items.length - 1)];
      body = '<div class="ml-one">' + lineHtml(it, by, false) + '<div class="ml-lnum">Line ' + (g.line + 1) + ' of ' + items.length + '</div></div>' + '';
      return '<div class="ml-pn story" style="' + fs + '">' + head + body + '</div>';
    }
    body = '<div class="ml-scroll" id="ml-scroll" tabindex="0">' + head + items.map(function (it) { return lineHtml(it, by, !st); }).join('') + '<div class="ml-end">🎭 THE END 🎭</div>' + credits(g) + (st ? '' : '<button class="btn yellow big" data-act="ml-fin">🎬 The End – play again ▶</button>') + '</div><div class="ml-pg" id="ml-pg"></div>';
    return '<div class="ml-pn story" style="' + fs + '">' + body + '</div>';
  }
  function storyBar(g) {
    if (g.fin) return '';
    var size = '<button class="btn small" data-act="ml-size" data-d="-1" aria-label="Smaller text">A−</button><button class="btn small" data-act="ml-size" data-d="1" aria-label="Bigger text">A+</button>', more = '<button class="btn small" data-act="ml-smenu" aria-label="More">☰</button>';
    if (g.view === 'line') return '<div class="ml-bar">' + size + '<button class="btn small" data-act="ml-line" data-d="-1">◀ Line</button><button class="btn small yellow" data-act="ml-line" data-d="1">Line ▶</button><button class="btn small" data-act="ml-view">📜 Full</button>' + more + '</div>';
    return '<div class="ml-bar">' + size + '<button class="btn small" data-act="ml-page" data-d="-1">◀ Page</button><button class="btn small yellow" data-act="ml-page" data-d="1">Page ▶</button><button class="btn small" data-act="ml-copy">📋 Copy</button>' + more + '</div>';
  }
  function storyCtl(g, sc) {
    var items = ML.build(sc, g);
    if (g.fin) return '<div class="ml-ctl-top"><span class="pill">🎭 The End</span></div>' + finaleBtns().replace('go-mode', 'go-mode');
    var h = '<div class="ml-ctl-top"><span class="pill">🎭 ' + esc(sc.t) + '</span></div>' +
      '<div class="row"><button class="btn" data-act="ml-size" data-d="-1">A−</button><button class="btn" data-act="ml-size" data-d="1">A+</button><button class="btn" data-act="ml-page" data-d="-1">◀ Prev page</button><button class="btn yellow" data-act="ml-page" data-d="1">Next page ▶</button></div>' +
      '<div class="row"><button class="btn" data-act="ml-scroll" data-d="-1">▲ Scroll up</button><button class="btn" data-act="ml-scroll" data-d="1">▼ Scroll down</button></div>' +
      (g.view === 'line' ? '<div class="row"><button class="btn" data-act="ml-line" data-d="-1">← Line</button><button class="btn primary" data-act="ml-line" data-d="1">Next line →</button></div>' : '') +
      '<div class="row"><button class="btn primary" data-act="ml-copy">📋 Copy full script</button><button class="btn" data-act="ml-view">' + (g.view === 'line' ? '📜 Full script' : '▶ One line at a time') + '</button></div>' +
      '<div class="row"><button class="btn" data-act="ml-swap">🔀 Swap roles</button><button class="btn" data-act="ml-edit">✎ Edit words</button><button class="btn" data-act="ml-fin">🎬 The End screen</button></div>';
    if (g.editI != null) h += '<div class="ml-editbox"><div class="ml-need-priv">' + esc(g.reqs[g.editI].prompt) + '</div><div class="row"><input type="text" id="ml-ans" maxlength="' + ML.MAXLEN + '" value="' + esc(g.draft && g.draft.i === g.editI ? g.draft.ans : g.reqs[g.editI].ans) + '" data-enter="ml-confirm" class="grow"></div><div class="row"><input type="text" id="ml-user" maxlength="' + ML.MAXUSER + '" placeholder="Chat username (optional)" value="' + esc(g.draft && g.draft.i === g.editI ? g.draft.user : g.reqs[g.editI].user) + '" data-enter="ml-confirm" class="grow"></div><div class="row"><button class="btn" data-act="ml-random">🎲 Random</button><button class="btn primary" data-act="ml-confirm">✅ Save change</button><button class="btn" data-act="ml-edit-cancel">Cancel</button></div></div>';
    if (g.editOpen) h += editList(g);
    h += '<details class="ml-lines"><summary>📋 Copy a single line</summary>' + items.map(function (it) { return '<div class="ml-lrow"><span>' + esc(ML.lineText(it).slice(0, 70)) + '</span><button class="copydot" data-act="ml-copy-line" data-i="' + it.i + '" aria-label="Copy line">📋</button></div>'; }).join('') + '</details>' +
      '<button class="btn yellow big sc-again" data-act="ml-next-script">🎭 Next scenario</button><div class="row"><button class="btn" data-act="ml-again">🔁 Same scene, new words</button><button class="btn" data-act="ml-settings">⚙ Change settings</button></div>';
    return h;
  }
  App.actions['ml-smenu'] = function () {
    var g = App.mgame, sc = S(), items = ML.build(sc, g);
    App.openModal('<h2>🎭 ' + esc(sc.t) + '</h2><div class="row"><button class="btn primary" data-act="ml-copy">📋 Copy full script</button><button class="btn" data-act="ml-view-close">' + (g.view === 'line' ? '📜 Full script' : '▶ One line at a time') + '</button><button class="btn" data-act="ml-swap-close">🔀 Swap roles</button></div>' +
      '<h3>✎ Change a word</h3>' + editList(g) +
      '<details class="ml-lines"><summary>📋 Copy a single line</summary>' + items.map(function (it) { return '<div class="ml-lrow"><span>' + esc(ML.lineText(it).slice(0, 60)) + '</span><button class="copydot" data-act="ml-copy-line" data-i="' + it.i + '" aria-label="Copy line">📋</button></div>'; }).join('') + '</details>' +
      '<div class="row"><button class="btn yellow" data-act="ml-next-script-close">🎲 New scenario</button><button class="btn" data-act="ml-again-close">🔁 Same scene, new words</button><button class="btn" data-act="ml-settings-close">⚙ Settings</button><button class="btn" data-act="ml-quit">✕ Quit</button><button class="btn" data-act="close-modal">Close</button></div>');
  };
  ['view', 'swap', 'next-script', 'again', 'settings'].forEach(function (k) { App.actions['ml-' + k + '-close'] = function (el) { App.closeModal(); App.actions['ml-' + k](el); }; });
  App.actions['ml-edit-cancel'] = function () { var g = App.mgame; g.editI = null; g.draft = null; App.closeModal(); save(); App.render(); };
  App.actions['ml-size'] = function (el) { var g = App.mgame; g.size = Math.max(1, Math.min(5, g.size + parseInt(el.dataset.d, 10))); save(); App.render(); };
  App.actions['ml-scroll'] = function (el) { var s = document.getElementById('ml-scroll'); if (s) s.scrollBy({ top: parseInt(el.dataset.d, 10) * s.clientHeight * 0.7, behavior: 'smooth' }); };
  /* page turns land on a line boundary so no line is ever cut in half; "next" on the last page opens the end screen */
  App.actions['ml-page'] = function (el) {
    var g = App.mgame, s = document.getElementById('ml-scroll'), d = parseInt(el.dataset.d, 10);
    if (!s) { if (g.view === 'line') App.actions['ml-line'](el); return; }
    var top = s.scrollTop, h = s.clientHeight, kids = [].slice.call(s.children), t = null, i;
    if (d > 0) {
      if (top + h >= s.scrollHeight - 4) { g.fin = 1; save(); App.render(); return; }
      for (i = 0; i < kids.length; i++) if (kids[i].offsetTop + kids[i].offsetHeight > top + h + 2) { t = kids[i].offsetTop; break; }
      if (t == null || t <= top + 2) t = top + h * 0.9;
    } else {
      var want = top - h;
      for (i = 0; i < kids.length; i++) if (kids[i].offsetTop >= want - 2) { t = kids[i].offsetTop; break; }
      t = Math.max(0, t == null ? want : t);
    }
    s.scrollTo({ top: t, behavior: 'smooth' });
  };
  App.actions['ml-fin'] = function () { var g = App.mgame; g.fin = 1; save(); App.render(); };
  App.actions['ml-unfin'] = function () { var g = App.mgame; g.fin = 0; save(); App.render(); };
  document.addEventListener('scroll', function (e) {
    var t = e.target; if (!t || t.id !== 'ml-scroll') return; pageNote(t);
  }, true);
  function pageNote(s) {
    var p = document.getElementById('ml-pg'); if (!p || !s) return;
    var pages = Math.max(1, Math.ceil((s.scrollHeight - 4) / s.clientHeight)), max = s.scrollHeight - s.clientHeight;
    var cur = max <= 4 ? 1 : Math.min(pages, Math.round(s.scrollTop / max * (pages - 1)) + 1);
    p.textContent = pages > 1 ? 'Page ' + cur + ' of ' + pages + (cur < pages ? '  ▼' : '') : '';
  }
  App.actions['ml-view'] = function () { var g = App.mgame; g.view = g.view === 'line' ? 'full' : 'line'; g.line = 0; save(); App.render(); };
  App.actions['ml-line'] = function (el) { var g = App.mgame, n = ML.build(S(), g).length; g.line = Math.max(0, Math.min(n - 1, g.line + parseInt(el.dataset.d, 10))); save(); App.render(); };
  App.actions['ml-swap'] = function () { var g = App.mgame; g.assign = g.assign.slice(1).concat(g.assign.slice(0, 1)); save(); App.render(); };
  App.actions['ml-copy'] = function () { App.closeModal(); App.copy(ML.scriptText(S(), App.mgame), 'script'); };
  App.actions['ml-copy-line'] = function (el) { var g = App.mgame, it = ML.build(S(), g)[parseInt(el.dataset.i, 10)]; if (it) App.copy(ML.lineText(it), 'line'); };

  /* ---------- play view ---------- */
  function renderPlay(app) {
    var g = App.mgame; if (!g) { go('mlsetup'); return; }
    clearInterval(tick);
    var sc = S(), st = stream(g), key = g.stage === 'story' ? 'mlstory' : g.stage === 'ready' ? 'mlready' : 'mlcollect', main, strip = '', ctl, cls;
    App.setBackdrop(key);
    if (g.stage === 'collect') { main = zone('z-cmain', collectPanel(g, st)); strip = zone('z-cans', collectStrip(g, st)); ctl = collectCtl(g); cls = 'collect'; }
    else if (g.stage === 'ready') { main = zone('z-rmain', readyPanel(g, st)); ctl = readyCtl(g); cls = 'ready'; }
    else { main = zone('z-smain', storyPanel(g, sc, st)); strip = st ? '' : zone('z-sbar', storyBar(g)); ctl = storyCtl(g, sc); cls = 'story'; }
    var anim = g.stage === 'story' && g.anim ? '<div class="ml-curtain-open" aria-hidden="true"><i></i><i></i></div>' : '';
    if (g.anim) { g.anim = 0; save(); }
    if (st) {
      App.streamOut(app, box(key, cls, main + strip + anim), '<div class="sctl" id="sctl">' + ctl + '</div>');
    } else {
      app.innerHTML = '<div class="v-ml s-' + cls + '">' + App.hud('<button class="icon-btn quit-btn" data-act="ml-quit" aria-label="Quit">✕ Quit</button>') + main + strip + anim + '</div>';
    }
    if (g.stage === 'story') setTimeout(function () { pageNote(document.getElementById('ml-scroll')); }, 0);
    if (!st && g.stage === 'collect') setTimeout(function () { var i = document.getElementById('ml-ans'); if (i && !i.value) { try { i.focus({ preventScroll: true }); } catch (e) {} } }, 60);
  }

  /* ---------- stats ---------- */
  App.actions['ml-stats'] = function () {
    var by = {}; SCRIPTS.forEach(function (s) { by[s.cat] = by[s.cat] || [0, 0]; by[s.cat][1]++; if (App.mdone.indexOf(s.id) !== -1) by[s.cat][0]++; });
    App.openModal('<h2>🎭 Mad Libs Theatre</h2><p><b>' + App.mdone.length + '</b> of ' + SCRIPTS.length + ' scripts performed</p><div class="ml-stats">' + Object.keys(by).sort().map(function (c) { return '<div class="ml-erow"><span class="p">' + esc(c) + '</span><b>' + by[c][0] + ' / ' + by[c][1] + '</b></div>'; }).join('') + '</div><div class="row"><button class="btn" data-act="ml-reset-hist2">♻️ Reset played history</button><button class="btn primary" data-act="close-modal">Close</button></div>');
  };
  App.actions['ml-reset-hist2'] = function () { App.closeModal(); App.actions['ml-reset-hist'](); };

  /* switching between streamer mode and private mode mid-game keeps the show going */
  document.addEventListener('DOMContentLoaded', function () {
    var f = false; try { f = sessionStorage.getItem('tl-switch'); sessionStorage.removeItem('tl-switch'); } catch (e) {}
    if (f && App.mgame && !App.game) { App.view = 'mlplay'; App.render(); }
  });

  /* ---------- router ---------- */
  App.actions['go-madlibs'] = App.actions['pick-madlibs'];
  var prev = App.renderRiddle;
  App.renderRiddle = function (v, app) {
    if (!MV[v]) { prev(v, app); return; }
    if (v === 'mlhome') renderHomeScreen(app); else if (v === 'mlsetup') renderSetup(app); else renderPlay(app);
  };
})();
