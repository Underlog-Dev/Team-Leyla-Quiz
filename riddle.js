/* Team Leyla Quiz Hub - Riddles: mode screen, riddle home/setup/play/results/leaderboard, Team + VS + Streamer modes. */
(function () {
  'use strict';
  var App = window.App, Core = App.Core, esc = App.esc, store = App.store;
  var BANK = window.RIDDLE_BANK || [], BY = {}; BANK.forEach(function (r) { BY[r.id] = r; });
  var RV = App.RVIEWS = { mode: 1, rhome: 1, rsetup: 1, rplay: 1, rresults: 1, rleader: 1, rtie: 1 };
  var tick = null;

  var DEF = { mode: 'team', difficulty: ['easy', 'medium', 'hard'], pointsMode: 'diff', count: 20, custom: '', timer: 60, timerCustom: false, hostPlay: 0 };
  App.rsetup = Object.assign({}, DEF, store.get('rsetup', {}));
  App.rgame = store.get('rgame', null);
  App.rused = store.get('rused', []); App.rflag = store.get('rflag', []);
  App.rhist = store.get('rhist', []); App.ralltime = store.get('rall', {}); App.rlbTab = 'recent';
  var tbUsed = store.get('rtbused', []);
  if (App.rgame && (!App.rgame.ids || !BY[App.rgame.ids[App.rgame.index]])) App.rgame = null;
  function rsave() { store.set('rsetup', App.rsetup); store.set('rgame', App.rgame); store.set('rused', App.rused); store.set('rflag', App.rflag); }
  App.rsave = rsave;
  function markUsed(id) { if (App.rused.indexOf(id) === -1) App.rused.push(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function R() { return BY[App.rgame.ids[App.rgame.index]]; }
  function fresh() { return { hints: 0, revealed: false, solved: null, timeUp: false, pending: false, tries: [] }; }
  function pts() { var g = App.rgame, c = g.cur; return Core.riddlePoints(R().difficulty, c.hints, g.flat || 0); }
  function setTimer() { var g = App.rgame; g.timerEnd = g.timer ? Date.now() + g.timer * 1000 : 0; }
  function diffList(s) { return App.diffList(s); }
  function pool(s) { return BANK.filter(function (r) { return App.rflag.indexOf(r.id) === -1; }); }
  function availCount(s) { return Core.buildRiddles(pool(s), diffList(s), 99999, App.rused).available; }
  function wantCount(s) { return s.count === 'custom' ? Math.max(1, parseInt(s.custom, 10) || 0) : s.count; }
  function copyDot(act, label, k) { return '<button class="copydot" data-act="' + act + '"' + (k != null ? ' data-k="' + k + '"' : '') + ' aria-label="' + label + '" title="' + label + '">📋</button>'; }
  function timerLabel(t) { return t === 0 ? 'Off' : (t % 60 === 0 && t >= 120 ? (t / 60) + ' min' : t + 's'); }

  /* ---------- navigation ---------- */
  function go(v) { clearInterval(tick); App.view = v; App.resetScroll = true; App.render(); window.scrollTo(0, 0); }
  App.actions['go-mode'] = function () { go('mode'); };
  App.actions['pick-quiz'] = function () { go('home'); };
  App.actions['pick-riddles'] = function () { go('rhome'); };
  App.actions['r-home'] = function () { go('rhome'); };
  App.actions['r-go-setup'] = function () { go('rsetup'); };
  App.actions['r-go-leader'] = function () { go('rleader'); };
  App.actions['r-resume'] = function () { go(App.rgame.finished ? 'rresults' : 'rplay'); };

  /* ---------- mode selection + riddle home ---------- */
  function renderMode(app) {
    App.setBackdrop('mode');
    app.innerHTML = '<div class="v-mode">' + App.hud() +
      '<button class="hit hit-quiz" data-act="pick-quiz" aria-label="Play Quiz"></button>' +
      '<button class="hit hit-riddles" data-act="pick-riddles" aria-label="Play Riddles"></button>' +
      '<button class="hit hit-hangman" data-act="pick-hangman" aria-label="Play Hangman"></button></div>';
  }
  function renderRHome(app) {
    App.setBackdrop('rhome');
    var resume = App.rgame ? '<button class="btn yellow" data-act="r-resume">▶ Resume riddles</button>' : '';
    app.innerHTML = '<div class="v-rhome">' + App.hud() + '<div class="zone">' +
      '<button class="btn yellow play-btn" data-act="r-go-setup">▶ Play</button>' +
      '<div class="home-links">' + resume + '<button class="btn" data-act="r-go-leader">🏆 Leaderboard</button><button class="btn" data-act="go-mode">🔀 Switch game</button></div></div></div>';
  }

  /* ---------- setup ---------- */
  function seg(name, opts, cur) {
    return '<div class="seg" role="group">' + opts.map(function (o) {
      return '<button class="chip ' + (o.cls || '') + '" data-act="rset" data-k="' + name + '" data-v="' + o.v + '" aria-pressed="' + (String(cur) === String(o.v)) + '">' + o.l + '</button>';
    }).join('') + '</div>';
  }
  function setupCols(s) {
    var dl = diffList(s), flat = s.pointsMode === 'flat', avail = availCount(s), want = wantCount(s);
    var countOpts = [10, 20, 30, 50, 100].map(function (n) { return { v: n, l: n }; }).concat([{ v: 'custom', l: 'Custom' }]);
    var diffBtns = [['easy', 'Easy', 1], ['medium', 'Medium', 2], ['hard', 'Hard', 3]].map(function (d) {
      return '<button class="chip ' + d[0] + '" data-act="rdiff" data-v="' + d[0] + '" aria-pressed="' + (dl.indexOf(d[0]) !== -1) + '">' + d[1] + (flat ? '' : ' ' + d[2] + 'pt' + (d[2] > 1 ? 's' : '')) + '</button>';
    }).join('') + '<button class="chip mixed" data-act="rdiff" data-v="all" aria-pressed="' + (dl.length === 3) + '">Mixed (all)</button>';
    var msg = avail === 0 ? '<span class="notice warn">No unused riddles left for these settings.</span>' : avail < want ? '<span class="notice">Only ' + avail + ' unused riddles match.</span>' : '<span class="help">' + avail + ' riddles available</span>';
    var c1 = '<div class="col">' + (App.embed ? '' : '<label class="lbl">How to play</label>' + seg('mode', [{ v: 'team', l: '🧩 Team' }, { v: 'vs', l: '⚔️ VS (first to answer)' }, { v: 'stream', l: '🎥 Streamer (TikTok LIVE)' }], s.mode)) +
      '<label class="lbl">Difficulty <span class="help">(pick one or more)</span></label><div class="seg" role="group">' + diffBtns + '</div>' +
      '<label class="lbl">Points</label>' + seg('pointsMode', [{ v: 'diff', l: 'Harder = more points' }, { v: 'flat', l: 'Same for every riddle (1 pt)' }], s.pointsMode) + '</div>';
    var c2 = '<div class="col"><label class="lbl">Number of riddles</label>' + seg('count', countOpts, s.count) +
      (s.count === 'custom' ? '<input type="number" min="1" max="500" inputmode="numeric" placeholder="How many?" value="' + esc(s.custom) + '" data-input="rcustom" style="margin-top:.4em">' : '') +
      '<label class="lbl">Host plays along?</label>' + seg('hostPlay', [{ v: 0, l: 'No – host sees answers' }, { v: 1, l: '🙈 Yes – host can’t see answers' }], s.hostPlay ? 1 : 0) +
      (s.hostPlay ? '<p class="help">No timer when the host plays along. Use <b>Reveal answer</b> when you’re ready – it shows the answer, then tap Next.</p>' :
        '<label class="lbl">Timer per riddle</label>' + seg('timer', [30, 60, 90, 120, 180, 0].map(function (t) { return { v: t, l: timerLabel(t) }; }).concat([{ v: 'custom', l: 'Custom' }]), s.timerCustom ? 'custom' : s.timer) +
        (s.timerCustom ? '<input type="number" min="5" max="3600" inputmode="numeric" placeholder="Seconds" value="' + esc(s.timer || '') + '" data-input="rtimer" style="margin-top:.4em">' : '')) +
      '<p class="help" style="margin-top:.6em">💡 Every riddle has 3 hints. Each hint used costs 1 point (never below 1).</p></div>';
    return { cols: c1 + c2, msg: msg, avail: avail, want: want, dl: dl };
  }
  function renderRSetup(app) {
    App.setBackdrop('rsetup');
    var s = App.rsetup; s.difficulty = diffList(s); if (!s.pointsMode) s.pointsMode = 'diff';
    var f = setupCols(s), start = '<button class="btn primary" data-act="r-start"' + (f.avail === 0 ? ' disabled' : '') + '>Start riddles 🧩</button>';
    if (s.mode === 'stream' && !App.embed) { renderStreamLobby(app, s, f, start); return; }
    app.innerHTML = '<div class="v-rsetup">' + App.hud() + '<div class="zone"><section class="glass" aria-label="Riddle game selection"><div class="setup-grid">' + f.cols + '</div></section></div><div class="setup-actions">' + f.msg + start + '</div></div>';
  }
  App.actions.rset = function (el) {
    var k = el.dataset.k, v = el.dataset.v;
    if (k === 'timer') { if (v === 'custom') App.rsetup.timerCustom = true; else { App.rsetup.timerCustom = false; App.rsetup.timer = parseInt(v, 10); } }
    else if (k === 'hostPlay') App.rsetup.hostPlay = parseInt(v, 10) ? 1 : 0;
    else App.rsetup[k] = (k === 'count' && v !== 'custom') ? parseInt(v, 10) : v;
    rsave(); App.render();
  };
  App.actions.rdiff = function (el) {
    var v = el.dataset.v, d = diffList(App.rsetup).slice(), ALL = ['easy', 'medium', 'hard'];
    if (v === 'all') d = ALL.slice(); else { var i = d.indexOf(v); if (i === -1) d.push(v); else if (d.length > 1) d.splice(i, 1); }
    App.rsetup.difficulty = ALL.filter(function (x) { return d.indexOf(x) !== -1; }); rsave(); App.render();
  };
  App.inputs.rcustom = function (el) { App.rsetup.custom = el.value; rsave(); };
  App.inputs.rtimer = function (el) { var n = parseInt(el.value, 10); if (n >= 5) App.rsetup.timer = Math.min(3600, n); rsave(); };

  /* ---------- start ---------- */
  App.actions['r-start'] = function () {
    var s = App.embed ? Object.assign({}, App.rsetup, { mode: 'stream' }) : App.rsetup, want = wantCount(s);
    if (!want) { App.toast('Enter how many riddles'); return; }
    var res = Core.buildRiddles(pool(s), diffList(s), Math.min(want, 500), App.rused);
    if (!res.riddles.length) { App.toast('No unused riddles left for these settings'); return; }
    App.rgame = {
      kind: 'riddle', mode: s.mode === 'team' ? 'team' : 'vs', stream: s.mode === 'stream', flat: s.pointsMode === 'flat' ? 1 : 0,
      hostPlay: s.hostPlay ? 1 : 0, timer: s.hostPlay ? 0 : (s.timer || 0), setup: JSON.parse(JSON.stringify(s)),
      ids: res.riddles.map(function (x) { return x.id; }), total: res.riddles.length, index: 0, rejected: [], finished: false, hs: {},
      cur: fresh(), team: { score: 0, solved: 0, log: [] }, host: Core.newHostState(), started: Date.now()
    };
    setTimer(); App.view = 'rplay'; rsave(); App.resetScroll = true; App.render();
    if (res.shortfall) App.toast('Only ' + res.riddles.length + ' unused riddles available');
  };

  /* ---------- play (Team + VS) ---------- */
  function hintsHtml(Rd, cur) {
    var h = '';
    for (var i = 0; i < cur.hints; i++) h += '<div class="hintbox"><span>💡 <b>Hint ' + (i + 1) + ':</b> ' + esc(Rd.hints[i]) + '</span>' + copyDot('r-copy-hint', 'Copy hint ' + (i + 1), i) + '</div>';
    return h;
  }
  function hintBtn(cur) {
    return cur.hints >= 3 ? '<button class="btn on" disabled>💡 All 3 hints shown</button>' : '<button class="btn" data-act="r-hint">💡 Hint ' + (cur.hints + 1) + ' (-1 pt)</button>';
  }
  /* host types a viewer's answer: wrong -> keep going; right -> ask who got it (VS/stream) or score the team */
  function checkBox(g, cur) {
    if (!g.hostPlay) return "";
    return '<div class="row checkrow"><input type="text" id="try-ans" placeholder="Check an answer – type what was said, Enter" autocomplete="off" data-enter="r-try" class="grow"><button class="btn small primary" data-act="r-try">Check</button></div>' +
      (cur.tries && cur.tries.length ? '<div class="help tries">❌ Tried so far: ' + cur.tries.map(esc).join(' · ') + '</div>' : '');
  }
  App.actions['r-try'] = function () {
    var g = App.rgame, c = g.cur, inp = document.getElementById('try-ans'), v = inp ? inp.value.trim() : ''; if (c.revealed) return;
    if (!v) { App.toast('Type the answer to check'); return; }
    var r = Core.checkAnswer(v, R());
    if (r.correct) {
      if (g.mode === 'team' && !g.stream) { finishTeam(true, false); App.toast('✅ Correct!'); return; }
      App.openModal('<h2>✅ Correct!</h2><p class="help">“' + esc(v) + '” is right. Who got it? Their name gets the <b>+' + pts() + '</b>.</p>' +
        '<input type="text" id="win-name" placeholder="Winner’s name" autocomplete="off" autocapitalize="words" data-enter="r-confirm-winner" style="width:100%;box-sizing:border-box">' +
        '<div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="r-confirm-winner">Give the point</button><button class="btn" data-act="r-skip-winner">No name</button></div>');
      var w = document.getElementById('win-name'); if (w) w.focus(); return;
    }
    (c.tries = c.tries || []).push(v); rsave(); App.render();
    App.toast(r.close ? '🤏 Close, but not accepted – keep going' : '❌ Not it – keep going');
  };
  App.actions['r-confirm-winner'] = function () {
    var g = App.rgame, w = document.getElementById('win-name'), name = w ? w.value : '';
    if (!name.trim()) { App.toast('Type a name (or tap No name)'); return; }
    var r = Core.awardPoints(g.host, name, g.index, pts());
    if (!r.ok && r.reason !== 'duplicate') { App.toast('Could not add that name'); return; }
    App.closeModal(); g.cur.revealed = true; markUsed(R().id); rsave(); App.render();
    App.toast(r.ok ? '+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : '') : r.player.name + ' already scored this riddle');
  };
  App.actions['r-skip-winner'] = function () { App.closeModal(); App.rgame.cur.revealed = true; markUsed(R().id); rsave(); App.render(); };
  function lockedBox(g, Rd) {
    if (g.hostPlay) return '<div class="answerbox"><div>🔒 <b>Answer hidden</b> – you’re playing along</div></div>';
    return '<div class="answerbox priv"><div class="help">🔒 Answer (only you can see this)</div><div class="ans">' + esc(Rd.answer) + '</div><div class="row" style="justify-content:center;margin-top:6px"><button class="btn small primary" data-act="r-copy-a">📋 Copy answer</button></div></div>';
  }
  function answerBox(Rd) { return '<div class="answerbox revealed"><div class="help">Answer</div><div class="ans">' + esc(Rd.answer) + '</div></div>'; }
  function awardedChips(g) {
    var ids = g.host.awards[String(g.index)] || []; if (!ids.length) return '';
    return '<p class="help">✅ Scored this riddle (tap a name to take it back):</p><div class="seg">' + ids.map(function (id) {
      var p = g.host.players.filter(function (x) { return x.id === id; })[0];
      return p ? '<button class="chip" data-act="r-unaward" data-id="' + id + '">' + esc(p.name) + ' ✕</button>' : '';
    }).join('') + '</div>';
  }
  function nextBtn(g) { var last = g.index === g.total - 1; return '<button class="btn primary big grow" data-act="r-next">' + (last ? 'Finish 🏁' : 'Next riddle →') + '</button>'; }
  function teamBody(g, Rd, cur) {
    var h = hintsHtml(Rd, cur);
    if (!cur.revealed) {
      var tools = checkBox(g, cur) + '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="r-copy-q">📋 Copy riddle</button>' + hintBtn(cur) + '<button class="btn" data-act="r-swap">🔄 Swap</button></div>';
      if (g.hostPlay) return h + lockedBox(g, Rd) + tools + '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn yellow big" data-act="r-hp-reveal">👁 Reveal answer</button></div>';
      return h + lockedBox(g, Rd) + tools +
        '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn yellow big" data-act="r-solved">✅ We solved it! (+' + pts() + ')</button></div>' +
        '<div class="row" style="justify-content:center;margin-top:6px"><button class="btn" data-act="r-giveup">👁 Give up – show answer</button></div>';
    }
    if (cur.pending) return h + answerBox(Rd) + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-act="r-copy-a">📋 Copy answer</button></div>' +
      '<p class="help" style="text-align:center;margin:10px 0 4px">Did the team get it?</p><div class="row" style="justify-content:center"><button class="btn yellow big" data-act="r-solved">✅ Yes (+' + pts() + ')</button><button class="btn big" data-act="r-giveup">❌ No</button></div>';
    return h + '<div class="feedback ' + (cur.solved ? 'ok sparkle' : 'bad') + '">' + (cur.solved ? '✨ Solved! +' + (g.team.log[g.team.log.length - 1] || {}).earned + ' pt(s)' : (cur.timeUp ? '⏱ Time’s up' : '❌ Not this time')) + '</div>' + answerBox(Rd) +
      '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-act="r-copy-a">📋 Copy answer</button></div>' +
      '<div class="help" style="text-align:center;margin-top:6px">Team score: <b>' + g.team.score + '</b></div>' +
      '<div class="row" style="margin-top:12px;flex-wrap:nowrap">' + nextBtn(g) + '</div>';
  }
  function vsBody(g, Rd, cur) {
    var h = hintsHtml(Rd, cur);
    var tools = '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="r-copy-q">📋 Copy riddle</button>' + hintBtn(cur) + '<button class="btn" data-act="r-swap">🔄 Swap</button></div>';
    var ans = !cur.revealed ? lockedBox(g, Rd) + checkBox(g, cur) + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn yellow big" data-act="r-reveal">👁 Reveal answer</button></div>'
      : (cur.timeUp ? '<div class="feedback bad">⏱ Time’s up</div>' : '') + answerBox(Rd) + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-act="r-copy-a">📋 Copy answer</button></div>';
    var award = '<div class="row" style="margin-top:12px"><input type="text" id="award-name" placeholder="Winner’s name (+' + pts() + ') – press Enter" autocomplete="off" autocapitalize="words" data-enter="r-award" class="grow"></div>' + awardedChips(g);
    return h + tools + ans + award + '<div class="row" style="margin-top:12px;flex-wrap:nowrap">' + (g.index > 0 ? '<button class="btn big" style="width:auto;flex:0 0 auto" data-act="r-back">← Back</button>' : '') + nextBtn(g) + '</div>';
  }
  function renderRPlay(app) {
    var g = App.rgame; if (!g) { go('rhome'); return; }
    var cur = g.cur, Rd = R(); clearInterval(tick);
    App.setBackdrop('riddle');
    if (g.stream) { renderRStream(app, Rd); return; }
    var p = pts(), last = g.index === g.total - 1;
    var head = '<div class="qhead"><span class="pill">' + (last ? 'Final riddle' : 'Riddle ' + (g.index + 1)) + ' of ' + g.total + '</span><span class="pill pts">' + cap(Rd.difficulty) + ' · ' + p + ' pt' + (p === 1 ? '' : 's') + '</span></div>';
    var showTimer = g.timer && !cur.revealed;
    var main = '<section class="zone"><div class="qwrap">' + head + '<div class="qcard" id="qcard">' + (showTimer ? '<div class="timer" id="timer"></div>' : '') +
      '<div class="qtext rtext" id="qtext">' + esc(Rd.riddle) + '</div>' + (g.mode === 'team' ? teamBody(g, Rd, cur) : vsBody(g, Rd, cur)) + '</div>' +
      '<div class="minor"><button class="btn small" data-act="r-flag">🚩 Report riddle</button><button class="btn small" data-act="r-quit">Quit</button></div></div></section>';
    var drawer = g.mode === 'vs' ? '<aside class="drawer' + (App.lbOpen ? ' open' : '') + '" id="lb" aria-label="Leaderboard"><button class="drawer-tab" data-act="toggle-lb" aria-label="Show or hide leaderboard"><b>🏆</b><small>Leaders</small><span>◀</span></button><div class="drawer-in">' + vsBoard(g) + '</div></aside>' : '';
    app.innerHTML = '<div class="v-rplay">' + App.hud('<button class="icon-btn quit-btn" data-act="r-quit" aria-label="Quit">✕ Quit</button>') + main + drawer + '</div>';
    if (showTimer) startTick();
  }
  function startTick() {
    var g = App.rgame;
    function upd() {
      var el = document.getElementById('timer'), el2 = document.getElementById('sb-timer'); if (!el && !el2) { clearInterval(tick); return; }
      var left = Math.max(0, Math.ceil((g.timerEnd - Date.now()) / 1000));
      if (el) { el.textContent = '⏱ ' + left + 's'; el.classList.toggle('low', left <= 10); }
      if (el2) { el2.textContent = '⏱ ' + left + 's'; el2.classList.toggle('low', left <= 10); }
      if (left <= 0) {
        clearInterval(tick); if (g.cur.revealed) return;
        if (g.mode === 'team' && !g.stream) finishTeam(false, true);
        else { g.cur.revealed = true; g.cur.timeUp = true; markUsed(R().id); rsave(); App.render(); App.toast('⏱ Time’s up'); }
      }
    }
    upd(); tick = setInterval(upd, 500);
  }
  function finishTeam(solved, timeUp) {
    var g = App.rgame, c = g.cur, Rd = R(); if (c.revealed && !c.pending) return;
    c.pending = false; c.revealed = true; c.solved = solved; c.timeUp = !!timeUp;
    var earned = solved ? pts() : 0; if (solved) { g.team.score += earned; g.team.solved++; }
    g.team.log.push({ id: Rd.id, solved: solved, earned: earned, hints: c.hints });
    markUsed(Rd.id); rsave(); App.render();
  }
  App.actions['r-hp-reveal'] = function () { var c = App.rgame.cur; if (c.revealed) return; c.revealed = true; c.pending = true; markUsed(R().id); rsave(); App.render(); };
  App.actions['r-solved'] = function () { finishTeam(true, false); };
  App.actions['r-giveup'] = function () { finishTeam(false, false); };
  App.actions['r-hint'] = function () {
    var g = App.rgame, c = g.cur; if (c.hints >= 3) return;
    c.hints++; g.hs[g.index] = c.hints; rsave(); App.render();
  };
  App.actions['r-reveal'] = function () { var c = App.rgame.cur; c.revealed = true; markUsed(R().id); rsave(); App.render(); };
  App.actions['r-copy-q'] = function () { var g = App.rgame; App.copy(Core.riddleCopy(g.index + 1, g.total, R().riddle), 'riddle'); };
  App.actions['r-copy-a'] = function () { var g = App.rgame; App.copy(Core.riddleAnswerCopy(g.index + 1, g.total, R().answer), 'answer'); };
  App.actions['r-copy-hint'] = function (el) { var g = App.rgame, k = parseInt(el.dataset.k, 10); if (!(k < g.cur.hints)) return; App.copy(Core.riddleHintCopy(g.index + 1, k + 1, R().hints[k]), 'hint'); };
  function swapOut(Rd, onlyIfFree) {
    var g = App.rgame, rej = g.rejected.concat([Rd.id]);
    var cand = BANK.filter(function (r) { return r.difficulty === Rd.difficulty && App.rflag.indexOf(r.id) === -1 && App.rused.indexOf(r.id) === -1 && g.ids.indexOf(r.id) === -1 && rej.indexOf(r.id) === -1; });
    if (!cand.length) { App.toast('No other ' + Rd.difficulty + ' riddle available'); return false; }
    g.rejected = rej; g.ids[g.index] = cand[Math.floor(Math.random() * cand.length)].id; g.cur = fresh(); g.hs[g.index] = 0; setTimer(); return true;
  }
  function isScored(g) { return g.cur.revealed || (g.host.awards[String(g.index)] || []).length; }
  App.actions['r-swap'] = function () {
    var g = App.rgame; if (isScored(g)) { App.toast('This riddle is already done'); return; }
    if (swapOut(R())) { rsave(); App.render(); }
  };
  App.actions['r-flag'] = function () {
    var g = App.rgame, Rd = R(); if (!window.confirm('Report this riddle as wrong or unclear? It will be hidden from your future games.')) return;
    if (App.rflag.indexOf(Rd.id) === -1) App.rflag.push(Rd.id);
    if (!isScored(g) && swapOut(Rd)) { rsave(); App.render(); } else rsave();
    App.toast('Reported - thanks');
  };
  App.actions['r-next'] = function () {
    var g = App.rgame;
    if (g.mode === 'team' && !g.stream && (!g.cur.revealed || g.cur.pending)) { App.toast(g.hostPlay ? 'Reveal the answer first' : 'Mark it solved or show the answer first'); return; }
    if (g.mode === 'vs') {
      var inp = document.getElementById('award-name');
      if (inp && inp.value.trim()) {
        var r = Core.awardPoints(g.host, inp.value, g.index, pts());
        if (r.ok) App.toast('+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : ''));
        else if (r.reason !== 'duplicate') { App.toast('Could not add that name'); return; }
      }
    }
    markUsed(R().id);
    if (g.index >= g.total - 1) { g.finished = true; App.view = 'rresults'; rsave(); App.resetScroll = true; App.render(); return; }
    g.index++; g.cur = fresh(); setTimer(); rsave(); App.resetScroll = true; App.render(); window.scrollTo(0, 0);
  };
  function showR(i) {
    var g = App.rgame; g.index = i; g.cur = fresh(); g.cur.hints = g.hs[i] || 0; g.cur.revealed = !g.stream;
    clearInterval(tick); App.resetScroll = true; rsave(); App.render();
  }
  App.actions['r-back'] = function () { var g = App.rgame; if (g.mode !== 'vs' || g.index < 1) return; showR(g.index - 1); };
  App.actions['r-back-last'] = function () { var g = App.rgame; if (!g || g.mode !== 'vs') return; unrecord(g); g.finished = false; App.view = 'rplay'; showR(g.total - 1); };
  App.actions['r-unaward'] = function (el) {
    var g = App.rgame; if (Core.removeAward(g.host, el.dataset.id, g.index)) { rsave(); App.render(); App.toast('Points taken back - type the right name'); }
  };
  App.actions['r-quit'] = function () {
    if (!window.confirm('Quit these riddles? Progress will be discarded (played riddles stay marked as played).')) return;
    var st = !!(App.rgame && App.rgame.stream); clearInterval(tick); App.rgame = null; App.lbOpen = false;
    if (st) App.rsetup.mode = 'stream'; rsave(); go(st ? 'rsetup' : 'rhome');
  };
  App.actions['r-award'] = function () {
    var g = App.rgame, inp = document.getElementById('award-name'), name = inp ? inp.value : '';
    if (!name.trim()) { if (g.stream) { g.cur.revealed = true; markUsed(R().id); rsave(); App.render(); App.toast('Answer shown'); } else App.toast('Type a name first'); return; }
    var r = Core.awardPoints(g.host, name, g.index, pts());
    if (!r.ok) { if (r.reason === 'duplicate') { g.cur.revealed = true; rsave(); App.render(); } App.toast(r.reason === 'duplicate' ? r.player.name + ' already scored this riddle' : 'Type a name first'); return; }
    g.cur.revealed = true; markUsed(R().id); rsave(); App.render(); App.toast('+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : ''));
  };
  App.actions['r-unreveal'] = function () { var g = App.rgame; g.cur.revealed = false; g.cur.timeUp = false; if (g.timer) setTimer(); rsave(); App.render(); };

  /* ---------- VS leaderboard ---------- */
  function vsBoard(g) {
    var ranked = Core.rankPlayers(g.host.players);
    var rows = ranked.length ? ranked.map(function (p) {
      return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + '</span>' +
        '<button class="mini" data-act="r-adj" data-id="' + p.id + '" data-d="1" aria-label="Add a point">+</button><button class="mini" data-act="r-adj" data-id="' + p.id + '" data-d="-1" aria-label="Remove a point">−</button>' +
        '<button class="mini" data-act="r-rename" data-id="' + p.id + '" aria-label="Rename">✏️</button><button class="mini" data-act="r-remove" data-id="' + p.id + '" aria-label="Remove player">✕</button></div>';
    }).join('') : '<p class="help">No players yet. Type a name when someone answers first.</p>';
    return '<h3>🏆 Live leaderboard</h3>' + rows + '<div class="row" style="margin-top:10px"><button class="btn small" data-act="r-undo">↩ Undo</button><button class="btn small primary" data-act="r-copy-lb">📋 Copy top three</button></div>';
  }
  App.actions['r-adj'] = function (el) { Core.adjustPoints(App.rgame.host, el.dataset.id, parseInt(el.dataset.d, 10)); rsave(); App.render(); };
  App.actions['r-undo'] = function () { var h = Core.undoLast(App.rgame.host); App.toast(h ? 'Undone' : 'Nothing to undo'); rsave(); App.render(); };
  App.actions['r-rename'] = function (el) {
    var n = window.prompt('New name:'); if (n == null) return;
    var r = Core.renamePlayer(App.rgame.host, el.dataset.id, n); if (!r.ok) App.toast(r.reason === 'exists' ? 'That name is already used' : 'Name not changed'); rsave(); App.render();
  };
  App.actions['r-remove'] = function (el) { if (window.confirm('Remove this player?')) { Core.removePlayer(App.rgame.host, el.dataset.id); rsave(); App.render(); } };
  App.actions['r-copy-lb'] = function () { App.copy(Core.leaderboardCopy(App.rgame.host.players, App.templates), 'leaderboard'); };

  /* ---------- streamer mode (capture box uses the riddle mobile art) ---------- */
  function sboxOpen(key, cls) { return '<div class="sbox ' + (cls || '') + '" id="sbox" style="background-image:url(\'' + App.tallImg(key) + '\')"><div class="sb-in">'; }
  function streamLayout(app, box, ctl) {
    App.streamOut(app, box, ctl);
  }
  function streamHead(left, a, b) { return '<div class="sb-head"><span>🐣 Team Leyla Riddles</span><span>' + left + '</span></div><div class="sb-sub"><span>' + a + '</span><span>' + b + '</span></div>'; }
  function winnersOf(g) {
    var ids = g.host.awards[String(g.index)] || [];
    return ids.map(function (id) { var p = g.host.players.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }).filter(Boolean);
  }
  function renderRStream(app, Rd) {
    var g = App.rgame, cur = g.cur, p = pts(), last = g.index === g.total - 1;
    var keep = document.getElementById('award-name'), typed = keep ? keep.value : '', names = winnersOf(g);
    var hintBox = cur.hints ? '<div class="sb-hint"><b>💡 Hint' + (cur.hints > 1 ? 's' : '') + '</b>' + Rd.hints.slice(0, cur.hints).map(function (h, i) { return '<div class="sb-h">' + (i + 1) + '. ' + esc(h) + '</div>'; }).join('') + '</div>' : '';
    var tmr = g.timer && !cur.revealed ? ' · <span id="sb-timer" class="sb-timer">⏱</span>' : '';
    var box = sboxOpen('riddle', 'rplay') + streamHead('Riddle ' + (g.index + 1) + ' of ' + g.total + tmr, '🧩 Riddle', cap(Rd.difficulty) + ' · ' + p + ' pt' + (p === 1 ? '' : 's')) +
      '<div class="sb-body' + (!cur.hints && !cur.revealed ? ' soloq' : '') + '" id="sb-body"><div class="sb-qwrap"><div class="sb-q" id="sb-q">' + esc(Rd.riddle) + '</div></div>' + hintBox +
      (cur.revealed ? '<div class="sb-reveal"><b>✅ Answer</b> ' + esc(Rd.answer) + (names.length ? '<span class="sb-win">🏆 ' + esc(Core.joinNames(names)) + '</span>' : '') + '</div>' : '') + '</div></div></div>';
    var alts = (Rd.acceptedAnswers || []).filter(function (a) { return Core.normalizeText(a) !== Core.normalizeText(Rd.answer); }).slice(0, 4);
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">' + (last ? 'Final riddle' : 'Riddle ' + (g.index + 1)) + ' of ' + g.total + '</span><span class="pill pts">' + cap(Rd.difficulty) + ' · ' + p + ' pt' + (p === 1 ? '' : 's') + '</span><span class="grow"></span><button class="btn small" data-act="r-flag">🚩 Report</button><button class="btn small" data-act="r-quit">✕ Quit</button></div>' +
      (g.hostPlay && !cur.revealed ? '<div class="sc-ans locked"><div class="ans">🔒 Answer hidden</div><div class="help">You’re playing along – tap Reveal answer when you’re ready.</div></div>'
        : '<div class="sc-ans"><div class="help">🔒 Private answer – not shown on stream</div><div class="ans">' + esc(Rd.answer) + '</div>' + '<div class="row" style="justify-content:center;margin-top:6px"><button class="btn small primary" data-act="r-copy-a">📋 Copy answer</button></div>' + (alts.length ? '<div class="help">Also accepted: ' + esc(alts.join(' · ')) + '</div>' : '') + '</div>') +
      '<div class="row sc-tools">' + hintBtn(cur).replace('(-1 pt)', '(-1 pt)') + '<button class="btn" data-act="r-copy-q">📋 Copy riddle</button>' + (cur.hints ? copyDot('r-copy-hint', 'Copy latest hint', cur.hints - 1) : '') + '<button class="btn" data-act="r-swap">🔄 Swap</button></div>' +
      (cur.revealed ? '' : checkBox(g, cur)) + '<div class="row" style="margin-top:10px"><input type="text" id="award-name" placeholder="Winner’s name – press Enter to show the answer (+' + p + ')" autocomplete="off" autocapitalize="words" data-enter="r-award" class="grow"></div>' + awardedChips(g) +
      '<div class="row" style="margin-top:8px">' + (cur.revealed ? '<button class="btn" data-act="r-unreveal">🙈 Hide answer from stream</button><button class="btn primary" data-act="r-copy-a">📋 Copy answer</button>' : (g.hostPlay ? '<button class="btn yellow big" data-act="r-award">👁 Reveal answer</button>' : '<button class="btn yellow" data-act="r-award">✅ Show answer (uses name above)</button>')) + '</div>' +
      '<div class="row sc-nav"><button class="btn big" style="flex:0 0 auto"' + (g.index > 0 ? ' data-act="r-back"' : ' disabled') + '>← Back</button>' + nextBtn(g) + '</div>' +
      '<div class="sc-lb">' + vsBoard(g) + '</div></div>';
    streamLayout(app, box, ctl);
    var inp = document.getElementById('award-name'); if (inp && typed) inp.value = typed;
    if (App.fitStream) App.fitStream();
    if (g.timer && !cur.revealed) startTick();
  }
  function renderStreamLobby(app, s, f, start) {
    var flat = s.pointsMode === 'flat', dl = f.dl;
    var rows = [['🎯 Difficulty', dl.length === 3 ? 'Mixed' : dl.map(cap).join(' + ')], ['🧩 Riddles', String(f.want || '')], ['🏆 Points', flat ? '1 point each' : 'Harder = more'], ['💡 Hints', '3 per riddle'], ['⏱ Timer', s.hostPlay ? 'Off · host plays along' : timerLabel(s.timer || 0)]];
    var box = sboxOpen('rsetup', 'framed rsetup') + streamHead('Game selection', '🎮 Next game', 'Riddles') +
      '<div class="sb-body"><div class="sb-status">Get ready to solve! 🧩</div><div class="sb-sum">' + rows.map(function (r) { return '<div class="sb-sumrow"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div></div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><button class="btn small" data-act="r-home">🏠 Home</button><span class="pill">🎮 Game selection</span><span class="grow"></span></div>' +
      '<div class="sc-start">' + f.msg + start + '</div><div class="setup-grid sc-form">' + f.cols + '</div></div>';
    streamLayout(app, box, ctl);
  }

  /* ---------- results ---------- */
  function confetti() {
    if (App.settings.calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var em = ['🎉', '✨', '🐣', '🌟', '🏆', '❓'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('span'); s.className = 'confetti'; s.textContent = em[i % em.length];
      s.style.left = (Math.random() * 100) + '%'; s.style.animationDelay = (Math.random() * 1.2) + 's';
      document.body.appendChild(s); setTimeout(function (n) { return function () { n.remove(); }; }(s), 4500);
    }
  }
  function record(g) {
    if (g.recorded) return; g.recorded = true;
    var e = { t: Date.now(), mode: g.mode, total: g.total };
    if (g.mode === 'vs') {
      e.players = Core.rankPlayers(g.host.players).map(function (p) { return { name: p.name, score: p.score, rank: p.rank }; });
      e.players.forEach(function (p) { var k = Core.normalizeText(p.name), a = App.ralltime[k] = App.ralltime[k] || { name: p.name, points: 0, games: 0, wins: 0 }; a.points += p.score; a.games++; if (p.rank === 1 && p.score > 0) a.wins++; });
    } else e.team = { score: g.team.score, solved: g.team.solved };
    g.recEntry = e; App.rhist.unshift(e); App.rhist = App.rhist.slice(0, 30); store.set('rhist', App.rhist); store.set('rall', App.ralltime);
  }
  function unrecord(g) {
    if (!g.recorded) return; var e = g.recEntry; g.recorded = false; if (!e) return;
    App.rhist = App.rhist.filter(function (x) { return x.t !== e.t; });
    (e.players || []).forEach(function (p) { var k = Core.normalizeText(p.name), a = App.ralltime[k]; if (!a) return; a.points -= p.score; a.games--; if (p.rank === 1 && p.score > 0) a.wins--; if (a.games <= 0) delete App.ralltime[k]; });
    g.recEntry = null; store.set('rhist', App.rhist); store.set('rall', App.ralltime);
  }
  function topTied(g) { var r = Core.rankPlayers(g.host.players).filter(function (p) { return p.rank === 1; }); return r.length > 1 && r[0].score > 0 ? r : []; }
  function tieBanner(g) {
    var t = topTied(g); if (!t.length) return '';
    return '<div class="tie-banner"><b>🤝 It’s a tie for first!</b><span>' + esc(Core.joinNames(t.map(function (p) { return p.name; }))) + ' on ' + t[0].score + ' pts</span><button class="btn yellow" data-act="r-tb-start">⚡ Play tiebreaker riddle</button></div>';
  }
  function renderRResults(app) {
    var g = App.rgame; if (!g) { go('rhome'); return; }
    clearInterval(tick); App.setBackdrop('rleader'); record(g);
    if (g.stream) { renderStreamEnd(app, g); return; }
    var body;
    if (g.mode === 'team') {
      var max = g.team.log.length, pctx = max ? Math.round(g.team.solved / max * 100) : 0;
      body = '<div class="rres-scroll"><h2>🎉 Riddles complete!</h2><p class="rbig">Team solved <b>' + g.team.solved + '</b> of ' + g.total + ' · <b>' + g.team.score + '</b> pts</p><p class="help">' + pctx + '% solved</p>' +
        g.team.log.map(function (l) { var Rd = BY[l.id]; return '<div class="lb-item" style="display:block"><b>' + (l.solved ? '✅' : '❌') + ' ' + esc(Rd.riddle.length > 60 ? Rd.riddle.slice(0, 57) + '…' : Rd.riddle) + '</b><div class="help">' + esc(Rd.answer) + (l.solved ? ' · +' + l.earned : '') + '</div></div>'; }).join('') + '</div>';
    } else {
      var ranked = Core.rankPlayers(g.host.players), medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
      body = '<div class="rres-scroll"><h2>🏆 Final leaderboard</h2>' + tieBanner(g) + (ranked.length ? ranked.map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + (medal[p.rank] || p.rank) + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + '</span></div>';
      }).join('') : '<p class="help">No points awarded.</p>') + '</div><div class="row" style="margin-top:.5em"><button class="btn small primary" data-act="r-copy-lb">📋 Copy top three</button><button class="btn small" data-act="r-back-last">↩ Back to last riddle</button></div>';
      if (ranked.length && ranked[0].score > 0 && !topTied(g).length) confetti();
    }
    app.innerHTML = '<div class="v-rleader v-rres">' + App.hud() + '<div class="zone"><section class="glass">' + body +
      '<div class="row rres-actions" style="margin-top:.6em"><button class="btn yellow grow" data-act="r-again">🔁 Play again</button><button class="btn" data-act="r-go-setup">Change settings</button></div></section></div></div>';
  }
  function renderStreamEnd(app, g) {
    var ranked = Core.rankPlayers(g.host.players), medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    var top = ranked.filter(function (p) { return p.rank === 1 && p.score > 0; });
    var status = !ranked.length || !ranked[0].score ? 'Thanks for playing!' : top.length > 1 ? '🤝 Tie for first: ' + esc(Core.joinNames(top.map(function (p) { return p.name; }))) : '🏆 ' + esc(top[0].name) + ' wins!';
    var box = sboxOpen('rleader', 'framed rleader') + streamHead('Final results', '🏁 ' + g.total + ' riddles', 'Riddles complete') +
      '<div class="sb-body"><div class="sb-status">' + status + '</div><div class="sb-board">' +
      (ranked.length ? ranked.slice(0, 5).map(function (p) { return '<div class="sb-row' + (p.rank === 1 && p.score > 0 ? ' first' : '') + '"><b>' + (medal[p.rank] || p.rank) + '</b><span class="n">' + esc(p.name) + '</span><span class="s">' + p.score + ' pts</span></div>'; }).join('') : '<div class="sb-row"><span class="n">No points awarded</span></div>') + '</div></div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">🏁 Riddles finished</span><span class="grow"></span></div>' +
      '<button class="btn primary big sc-again" data-act="r-again">🔁 Play again – back to game selection</button>' + tieBanner(g) +
      '<div class="row sc-tools" style="margin-top:12px"><button class="btn" data-act="r-back-last">↩ Back to last riddle</button><button class="btn" data-act="r-go-setup">Change settings</button></div><div class="sc-lb">' + vsBoard(g) + '</div></div>';
    streamLayout(app, box, ctl);
  }
  App.actions['r-again'] = function () {
    var s = App.rgame ? App.rgame.setup : App.rsetup, st = !!(App.rgame && App.rgame.stream);
    App.rsetup = Object.assign({}, App.rsetup, s); App.rgame = null; rsave();
    if (st) { App.rsetup.mode = 'stream'; rsave(); go('rsetup'); } else App.actions['r-start']();
  };

  /* ---------- tiebreaker riddle: first correct answer wins ---------- */
  function tbPick(g) {
    var tb = g.tb, ok = function (x) { return tbUsed.indexOf(x.id) === -1 && App.rused.indexOf(x.id) === -1 && g.ids.indexOf(x.id) === -1 && App.rflag.indexOf(x.id) === -1 && x.id !== tb.rid; };
    var p = BANK.filter(function (x) { return x.difficulty === 'medium' && ok(x); }); if (!p.length) p = BANK.filter(ok);
    if (!p.length) { App.toast('No tiebreaker riddles left'); return false; }
    var r = p[Math.floor(Math.random() * p.length)]; tbUsed.push(r.id); store.set('rtbused', tbUsed.slice(-400)); markUsed(r.id);
    tb.rid = r.id; tb.hints = 0; tb.winner = null; tb.revealed = false; return true;
  }
  function tbP(g, id) { return g.host.players.filter(function (x) { return x.id === id; })[0]; }
  App.actions['r-tb-start'] = function () {
    var g = App.rgame, tied = topTied(g); if (!tied.length) return;
    g.tb = { ids: tied.map(function (p) { return p.id; }), round: 1, rid: null };
    if (!tbPick(g)) { g.tb = null; return; }
    [].forEach.call(document.querySelectorAll('.confetti'), function (n) { n.remove(); });
    unrecord(g); go('rtie'); rsave();
  };
  App.actions['r-tb-hint'] = function () { var tb = App.rgame.tb; if (tb && tb.hints < 3 && !tb.revealed) { tb.hints++; rsave(); App.render(); } };
  App.actions['r-tb-new'] = function () { var g = App.rgame; if (g.tb && !g.tb.revealed && tbPick(g)) { rsave(); App.render(); } };
  App.actions['r-tb-win'] = function (el) {
    var g = App.rgame, tb = g.tb, p = tb && !tb.revealed && tbP(g, el.dataset.id); if (!p) return;
    p.tb = (p.tb || 0) + 1; tb.winner = p.id; tb.revealed = true; rsave(); App.render();
  };
  App.actions['r-tb-undo'] = function () { var g = App.rgame, tb = g.tb; if (!tb || !tb.revealed) return; var p = tbP(g, tb.winner); if (p && p.tb) p.tb--; tb.winner = null; tb.revealed = false; rsave(); App.render(); };
  App.actions['r-tb-finish'] = function () { var g = App.rgame; g.tb = null; App.view = 'rresults'; App.resetScroll = true; rsave(); App.render(); };
  App.actions['r-tb-copy-q'] = function () { var g = App.rgame; App.copy(Core.fitComment('Tiebreaker riddle: ' + BY[g.tb.rid].riddle), 'tiebreaker'); };
  App.actions['r-tb-copy-hint'] = function () { var tb = App.rgame.tb; if (!tb.hints) return; App.copy(Core.fitComment('Tiebreaker hint ' + tb.hints + ': ' + BY[tb.rid].hints[tb.hints - 1]), 'hint'); };
  App.actions['r-tb-copy-r'] = function () { var g = App.rgame, tb = g.tb, w = tb.winner && tbP(g, tb.winner); if (!w) return; App.copy(Core.fitComment('CORRECT! The answer is ' + BY[tb.rid].answer + '. ' + w.name + ' wins the tiebreaker!'), 'result'); };
  function renderRTie(app) {
    var g = App.rgame, tb = g && g.tb; if (!tb) { go('rresults'); return; }
    clearInterval(tick); App.setBackdrop('riddle');
    var Rd = BY[tb.rid], names = tb.ids.map(function (id) { return esc(tbP(g, id).name); }), winner = tb.winner && tbP(g, tb.winner), inner;
    var hh = tb.hints ? Rd.hints.slice(0, tb.hints).map(function (h, i) { return '<div class="hintbox"><span>💡 <b>Hint ' + (i + 1) + ':</b> ' + esc(h) + '</span></div>'; }).join('') : '';
    if (!tb.revealed) {
      inner = (g.hostPlay ? '<div class="answerbox"><div>🔒 <b>Answer hidden</b> – shown when someone wins</div></div>' : '<div class="answerbox"><span class="help" style="margin:0">Answer (private)</span><div class="ans">' + esc(Rd.answer) + '</div></div>') + (g.stream ? '' : hh) +
        '<p class="help">First correct answer wins. Tap who got it first:</p><div class="tb-pick">' + tb.ids.map(function (id) { return '<button class="btn primary big" data-act="r-tb-win" data-id="' + id + '">✅ ' + esc(tbP(g, id).name) + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:.5em"><button class="btn" data-act="r-tb-copy-q">📋 Copy riddle</button>' + (tb.hints < 3 ? '<button class="btn" data-act="r-tb-hint">💡 Hint ' + (tb.hints + 1) + '</button>' : '') + (tb.hints ? copyDot('r-tb-copy-hint', 'Copy hint') : '') + '<button class="btn" data-act="r-tb-new">🔄 Nobody got it – new riddle</button></div>';
    } else {
      inner = '<div class="answerbox"><span class="help" style="margin:0">Answer</span><div class="ans">' + esc(Rd.answer) + '</div></div><p class="tie-win">🏆 ' + esc(winner.name) + ' wins the tiebreaker!</p>' +
        '<div class="row" style="margin-top:.6em"><button class="btn" data-act="r-tb-copy-r">📋 Copy result</button><button class="btn" data-act="r-tb-undo">↩ Change winner</button><button class="btn primary grow" data-act="r-tb-finish">See final leaderboard →</button></div>';
    }
    if (g.stream) {
      var box = sboxOpen('riddle', 'rplay') + streamHead('Tiebreaker', '🧩 Riddle', '🤝 Tied: ' + tb.ids.length) +
        '<div class="sb-body' + (!tb.hints && !tb.revealed ? ' soloq' : '') + '" id="sb-body"><div class="sb-qwrap"><div class="sb-q" id="sb-q">' + esc(Rd.riddle) + '</div></div>' +
        (tb.hints ? '<div class="sb-hint"><b>💡 Hint' + (tb.hints > 1 ? 's' : '') + '</b>' + Rd.hints.slice(0, tb.hints).map(function (h, i) { return '<div class="sb-h">' + (i + 1) + '. ' + esc(h) + '</div>'; }).join('') + '</div>' : '') +
        (tb.revealed ? '<div class="sb-reveal"><b>✅ Answer</b> ' + esc(Rd.answer) + '<span class="sb-win">🏆 ' + esc(winner.name) + ' wins!</span></div>' : '') + '</div></div></div>';
      streamLayout(app, box, '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">🤝 Tiebreaker riddle</span><span class="grow"></span></div><div class="sc-tb">' + inner + '</div></div>');
      if (App.fitStream) App.fitStream(); return;
    }
    app.innerHTML = '<div class="v-rplay">' + App.hud() + '<div class="zone"><div class="qwrap"><div class="qcard"><div class="qhead"><span class="pill">🤝 Tiebreaker riddle</span><span class="pill">Tied: ' + names.join(' · ') + '</span></div><div class="qtext rtext" id="qtext">' + esc(Rd.riddle) + '</div>' + inner + '</div></div></div></div>';
  }

  /* ---------- riddle leaderboard page ---------- */
  function renderRLeader(app) {
    App.setBackdrop('rleader'); var body;
    if (App.rlbTab === 'alltime') {
      var list = Object.keys(App.ralltime).map(function (k) { var a = App.ralltime[k]; return { id: k, name: a.name, score: a.points, games: a.games, wins: a.wins }; });
      var ranked = Core.rankPlayers(list), by = {}; list.forEach(function (x) { by[x.id] = x; });
      body = ranked.length ? '<div class="lb-scroll">' + ranked.slice(0, 50).map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="help" style="margin:0">' + by[p.id].games + ' games · ' + by[p.id].wins + ' wins</span><span class="lb-score">' + p.score + '</span></div>';
      }).join('') + '</div><div class="row" style="margin-top:.5em"><button class="btn small primary" data-act="r-copy-alltime">📋 Copy all-time top three</button><button class="btn small danger" data-act="r-clear-lb">Clear</button></div>' : '<p class="help">No VS games finished yet. Players you award points to appear here after the riddles end.</p>';
    } else {
      body = App.rhist.length ? '<div class="lb-scroll">' + App.rhist.map(function (h, hi) {
        var d = new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var inner = h.players ? (h.players.slice(0, 3).map(function (p) { return p.rank + '. ' + esc(p.name) + ' (' + p.score + ')'; }).join(' · ') || 'No points awarded') : 'Team: ' + h.team.solved + '/' + h.total + ' solved, ' + h.team.score + ' pts';
        return '<div class="lb-item" style="display:block"><b>' + d + ' · ' + (h.mode === 'vs' ? 'VS' : 'Team') + ' · ' + h.total + ' riddles</b><div class="help">' + inner + '</div>' + (h.players && h.players.length ? '<button class="btn small primary" style="margin-top:.4em" data-act="r-copy-game" data-i="' + hi + '">📋 Copy top three</button>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="help">No finished riddle games yet - play one and it appears here.</p>';
    }
    app.innerHTML = '<div class="v-rleader">' + App.hud() + '<div class="zone"><section class="glass"><div class="tabs">' +
      '<button class="chip" data-act="r-lbtab" data-v="recent" aria-pressed="' + (App.rlbTab === 'recent') + '">Recent games</button>' +
      '<button class="chip" data-act="r-lbtab" data-v="alltime" aria-pressed="' + (App.rlbTab === 'alltime') + '">All-time (this device)</button></div>' + body + '</section></div></div>';
  }
  App.actions['r-lbtab'] = function (el) { App.rlbTab = el.dataset.v; App.render(); };
  App.actions['r-copy-alltime'] = function () {
    App.copy(Core.leaderboardCopy(Object.keys(App.ralltime).map(function (k) { return { id: k, name: App.ralltime[k].name, score: App.ralltime[k].points }; }), App.templates), 'leaderboard');
  };
  App.actions['r-copy-game'] = function (el) {
    var h = App.rhist[+el.dataset.i]; if (!h || !h.players) return;
    App.copy(Core.leaderboardCopy(h.players.map(function (p, i) { return { id: 'h' + i, name: p.name, score: p.score }; }), App.templates), 'leaderboard');
  };
  App.actions['r-clear-lb'] = function () { if (window.confirm('Clear saved riddle leaderboards on this device?')) { App.rhist = []; App.ralltime = {}; store.set('rhist', []); store.set('rall', {}); App.render(); } };

  /* ---------- riddle stats ---------- */
  App.actions['r-stats'] = function () {
    var by = { easy: 0, medium: 0, hard: 0 }, left = { easy: 0, medium: 0, hard: 0 };
    BANK.forEach(function (r) { by[r.difficulty]++; if (App.rused.indexOf(r.id) === -1) left[r.difficulty]++; });
    App.openModal('<h2>Riddle bank</h2><p><b>' + BANK.length + '</b> riddles · <b>' + App.rused.length + '</b> played · <b>' + (left.easy + left.medium + left.hard) + '</b> left</p>' +
      '<table class="stats"><tr><th>Level</th><th>Total</th><th>Left</th></tr><tr><td>Easy</td><td>' + by.easy + '</td><td>' + left.easy + '</td></tr><tr><td>Medium</td><td>' + by.medium + '</td><td>' + left.medium + '</td></tr><tr><td>Hard</td><td>' + by.hard + '</td><td>' + left.hard + '</td></tr></table>' +
      '<p class="help">Played history is saved on this device only.</p><div class="row"><button class="btn danger" data-act="r-reset-history">Reset played riddles</button><button class="btn grow" data-act="close-modal">Close</button></div>');
  };
  App.actions['r-reset-history'] = function () {
    if (!window.confirm('Reset played riddles? They can appear again.')) return;
    App.rused = []; App.rflag = []; tbUsed = []; store.set('rtbused', []); rsave(); App.closeModal(); App.toast('Riddle history reset'); App.render();
  };

  /* ---------- router hook ---------- */
  App.renderRiddle = function (v, app) {
    if (v === 'mode') renderMode(app);
    else if (v === 'rhome') renderRHome(app);
    else if (v === 'rsetup') renderRSetup(app);
    else if (v === 'rplay') renderRPlay(app);
    else if (v === 'rresults') renderRResults(app);
    else if (v === 'rtie') renderRTie(app);
    else if (v === 'rleader') renderRLeader(app);
  };
})();
