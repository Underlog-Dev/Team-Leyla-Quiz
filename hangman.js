/* Team Leyla Quiz Hub - Hangman: setup, play (Team + VS + Streamer), host plays along, results, leaderboard, tiebreaker. */
(function () {
  'use strict';
  var App = window.App, Core = App.Core, esc = App.esc, store = App.store;
  var BANK = window.HANGMAN_BANK || [], BY = {}; BANK.forEach(function (w) { BY[w.id] = w; });
  var HV = App.HVIEWS = { hsetup: 1, hplay: 1, hresults: 1, hleader: 1 };
  var tick = null, ALL = ['easy', 'medium', 'hard'];
  var ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  var DEF = { mode: 'team', difficulty: ALL.slice(), pointsMode: 'diff', count: 10, custom: '', timer: 0, timerCustom: false, hostPlay: 0, lives: 6, showCat: 1, src: 'random', words: '' };
  App.hsetup = Object.assign({}, DEF, store.get('hsetup', {}));
  App.hgame = store.get('hgame', null);
  App.hused = store.get('hused', []); App.hflag = store.get('hflag', []);
  App.hhist = store.get('hhist', []); App.hall = store.get('hall', {}); App.hlbTab = 'recent';
  if (App.hgame && (!App.hgame.words || !(App.hgame.tb || App.hgame.words[App.hgame.index]))) App.hgame = null;
  function hsave() { store.set('hsetup', App.hsetup); store.set('hgame', App.hgame); store.set('hused', App.hused); store.set('hflag', App.hflag); }
  function markUsed(w) { if (w && w.bid && App.hused.indexOf(w.bid) === -1) App.hused.push(w.bid); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function W() { var g = App.hgame; return g.tb ? g.tb.w : g.words[g.index]; }
  function C() { var g = App.hgame; return g.tb ? g.tb.cur : g.cur; }
  function fresh() { return { guessed: [], wrongWord: 0, hints: 0, status: 'play', timeUp: false }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function st() { var g = App.hgame; return Core.hmState(W().word, C().guessed, C().wrongWord, g.lives); }
  function pts() { var g = App.hgame; return Core.riddlePoints(W().difficulty, C().hints, g.flat || 0); }
  function setTimer() { var g = App.hgame; g.timerEnd = g.timer ? Date.now() + g.timer * 1000 : 0; }
  function timerLabel(t) { return t === 0 ? 'Off' : (t % 60 === 0 && t >= 120 ? (t / 60) + ' min' : t + 's'); }
  function diffList(s) { var d = (s.difficulty || []).filter(function (x) { return ALL.indexOf(x) !== -1; }); return d.length ? d : ALL.slice(); }
  function pool() { return BANK.filter(function (w) { return App.hflag.indexOf(w.id) === -1; }); }
  function availCount(s) { return Core.buildRiddles(pool(), diffList(s), 99999, App.hused).available; }
  function wantCount(s) { return s.count === 'custom' ? Math.max(1, parseInt(s.custom, 10) || 0) : s.count; }
  function copyDot(act, label) { return '<button class="copydot" data-act="' + act + '" aria-label="' + label + '" title="' + label + '">📋</button>'; }
  function parseCustom(text) {
    var seen = {}, out = [];
    String(text || '').split(/[\n;,]+/).forEach(function (line) {
      var parts = line.split('|'), w = Core.hmNorm(parts[0]), clue = (parts[1] || '').trim().slice(0, 40);
      if (w.replace(/[^A-Z]/g, '').length < 2 || w.length > 40 || seen[w]) return;
      seen[w] = 1; out.push({ word: w, cat: clue || 'Your word', difficulty: Core.hmDifficulty(w), bid: null, own: true });
    });
    return out.slice(0, 100);
  }
  setTimeout(function () { for (var i = 0; i < 6; i++) { var im = new Image(); im.src = App.imgUrl('hm' + i + '.jpg'); } }, 2500);

  /* ---------- navigation ---------- */
  function go(v) { clearInterval(tick); App.view = v; App.resetScroll = true; App.render(); window.scrollTo(0, 0); }
  App.actions['pick-hangman'] = function () { go('hsetup'); };
  App.actions['h-go-setup'] = function () { go('hsetup'); };
  App.actions['h-go-leader'] = function () { go('hleader'); };
  App.actions['h-resume'] = function () { go(App.hgame.finished ? 'hresults' : 'hplay'); };

  /* ---------- setup ---------- */
  function seg(name, opts, cur) {
    return '<div class="seg" role="group">' + opts.map(function (o) {
      return '<button class="chip ' + (o.cls || '') + '" data-act="hset" data-k="' + name + '" data-v="' + o.v + '" aria-pressed="' + (String(cur) === String(o.v)) + '">' + o.l + '</button>';
    }).join('') + '</div>';
  }
  function setupCols(s) {
    var dl = diffList(s), flat = s.pointsMode === 'flat', custom = s.src === 'custom', avail = availCount(s), want = wantCount(s);
    var cw = custom ? parseCustom(s.words).length : 0;
    var countOpts = [5, 10, 15, 20, 30].map(function (n) { return { v: n, l: n }; }).concat([{ v: 'custom', l: 'Custom' }]);
    var diffBtns = [['easy', 'Easy', 1], ['medium', 'Medium', 2], ['hard', 'Hard', 3]].map(function (d) {
      return '<button class="chip ' + d[0] + '" data-act="hdiff" data-v="' + d[0] + '" aria-pressed="' + (dl.indexOf(d[0]) !== -1) + '">' + d[1] + (flat ? '' : ' ' + d[2] + 'pt' + (d[2] > 1 ? 's' : '')) + '</button>';
    }).join('') + '<button class="chip mixed" data-act="hdiff" data-v="all" aria-pressed="' + (dl.length === 3) + '">Mixed (all)</button>';
    var msg = custom ? '<span class="help">You’ll type ' + (want || '?') + ' word' + (want === 1 ? '' : 's') + ', one at a time</span>'
      : avail === 0 ? '<span class="notice warn">No unused words left for these settings.</span>' : avail < want ? '<span class="notice">Only ' + avail + ' unused words match.</span>' : '<span class="help">' + avail + ' words available</span>';
    var c1 = '<div class="col">' + (App.embed ? '' : '<label class="lbl">How to play</label>' + seg('mode', [{ v: 'team', l: '🧩 Team' }, { v: 'vs', l: '⚔️ VS (first to solve)' }, { v: 'stream', l: '🎥 Streamer (TikTok LIVE)' }], s.mode)) +
      '<label class="lbl">Words</label>' + seg('src', [{ v: 'random', l: '🎲 Random words' }, { v: 'custom', l: '✍️ My own words' }], s.src) +
      (custom ? '<p class="help">The host types each word when the game starts – viewers just see “Host is typing word…”.</p>'
        : '<label class="lbl">Difficulty <span class="help">(pick one or more)</span></label><div class="seg" role="group">' + diffBtns + '</div>') +
      '<label class="lbl">Points</label>' + seg('pointsMode', [{ v: 'diff', l: 'Harder = more points' }, { v: 'flat', l: 'Same for every word (1 pt)' }], s.pointsMode) + '</div>';
    var c2 = '<div class="col">' + ('<label class="lbl">Number of words</label>' + seg('count', countOpts, s.count) +
      (s.count === 'custom' ? '<input type="number" min="1" max="200" inputmode="numeric" placeholder="How many?" value="' + esc(s.custom) + '" data-input="hcustom" style="margin-top:.4em">' : '')) +
      (custom ? '' : '<label class="lbl">Host plays along?</label>' + seg('hostPlay', [{ v: 0, l: 'No – host sees the word' }, { v: 1, l: '🙈 Yes – host can’t see it' }], s.hostPlay ? 1 : 0)) +
      (s.hostPlay && !custom ? '<p class="help">The word stays hidden from you and there’s no timer. <b>Reveal answer</b> shows it to you only; then <b>Reveal to stream</b> shows everyone. </p>' :
        '<label class="lbl">Timer per word</label>' + seg('timer', [0, 60, 90, 120, 180, 300].map(function (t) { return { v: t, l: timerLabel(t) }; }).concat([{ v: 'custom', l: 'Custom' }]), s.timerCustom ? 'custom' : s.timer) +
        (s.timerCustom ? '<input type="number" min="5" max="3600" inputmode="numeric" placeholder="Seconds" value="' + esc(s.timer || '') + '" data-input="htimer" style="margin-top:.4em">' : '')) +
      '<label class="lbl">Category clue</label>' + seg('showCat', [{ v: 1, l: 'Show' }, { v: 0, l: 'Hide' }], s.showCat ? 1 : 0) +
      '</div>';
    return { cols: c1 + c2, msg: msg, ok: custom ? !!want : avail > 0, want: want, dl: dl, cw: cw };
  }
  function renderHSetup(app) {
    App.setBackdrop('hsetup');
    var s = App.hsetup; s.difficulty = diffList(s);
    var f = setupCols(s), resume = App.hgame ? '<button class="btn yellow" data-act="h-resume">▶ Resume</button>' : '';
    var start = '<button class="btn primary" data-act="h-start"' + (f.ok ? '' : ' disabled') + '>Start Hangman 🔤</button>';
    var links = resume + '<button class="btn" data-act="h-go-leader">🏆 Leaderboard</button>';
    if (s.mode === 'stream' && !App.embed) { renderStreamLobby(app, s, f, start, links); return; }
    app.innerHTML = '<div class="v-hsetup">' + App.hud() + '<div class="zone hm-panel hm-dark"><section aria-label="Hangman game selection"><div class="setup-grid">' + f.cols + '</div></section></div>' +
      '<div class="hm-tray">' + f.msg + start + '<div class="row hm-links">' + links + '</div></div></div>';
  }
  App.actions.hset = function (el) {
    var k = el.dataset.k, v = el.dataset.v, s = App.hsetup;
    if (k === 'timer') { if (v === 'custom') s.timerCustom = true; else { s.timerCustom = false; s.timer = parseInt(v, 10); } }
    else if (k === 'hostPlay' || k === 'showCat') s[k] = parseInt(v, 10) ? 1 : 0;
    else s[k] = (k === 'count' && v !== 'custom') ? parseInt(v, 10) : v;
    hsave(); App.render();
  };
  App.actions.hdiff = function (el) {
    var v = el.dataset.v, d = diffList(App.hsetup).slice();
    if (v === 'all') d = ALL.slice(); else { var i = d.indexOf(v); if (i === -1) d.push(v); else if (d.length > 1) d.splice(i, 1); }
    App.hsetup.difficulty = ALL.filter(function (x) { return d.indexOf(x) !== -1; }); hsave(); App.render();
  };
  App.inputs.hcustom = function (el) { App.hsetup.custom = el.value; hsave(); };
  App.inputs.htimer = function (el) { var n = parseInt(el.value, 10); if (n >= 5) App.hsetup.timer = Math.min(3600, n); hsave(); };
  App.inputs.hwords = function (el) {
    App.hsetup.words = el.value; hsave(); var n = parseCustom(el.value).length;
    var m = document.querySelector('.hm-tray .help, .sc-start .help, .hm-tray .notice, .sc-start .notice'); if (m) { m.className = n ? 'help' : 'notice warn'; m.textContent = n ? n + ' of your words ready' : 'Type at least one word.'; }
    [].forEach.call(document.querySelectorAll('[data-act=h-start]'), function (b) { b.disabled = !n; });
  };

  /* ---------- start ---------- */
  App.actions['h-start'] = function () {
    var s = App.embed ? Object.assign({}, App.hsetup, { mode: 'stream' }) : App.hsetup, words = [], res = null;
    if (s.src === 'custom') {
      var n = Math.min(wantCount(s), 100); if (!n) { App.toast('Enter how many words'); return; }
      for (var i = 0; i < n; i++) words.push({ word: '', cat: 'Your word', difficulty: 'medium', bid: null, own: true, pending: true });
    } else {
      var want = wantCount(s); if (!want) { App.toast('Enter how many words'); return; }
      res = Core.buildRiddles(pool(), diffList(s), Math.min(want, 200), App.hused);
      words = res.riddles.map(function (r) { return { word: r.word, cat: r.cat, difficulty: r.difficulty, bid: r.id }; });
      if (!words.length) { App.toast('No unused words left for these settings'); return; }
    }
    App.hgame = {
      kind: 'hangman', mode: s.mode === 'team' ? 'team' : 'vs', stream: s.mode === 'stream', flat: s.pointsMode === 'flat' ? 1 : 0,
      hostPlay: s.hostPlay && s.src === 'random' ? 1 : 0, timer: s.hostPlay ? 0 : (s.timer || 0), lives: 6, showCat: s.showCat ? 1 : 0, src: s.src,
      setup: clone(s), words: words, total: words.length, index: 0, rejected: [], finished: false, done: {},
      cur: fresh(), team: { score: 0, solved: 0, log: [] }, host: Core.newHostState(), started: Date.now()
    };
    if (!words[0].pending) setTimer(); App.view = 'hplay'; hsave(); App.resetScroll = true; App.render();
    if (res && res.shortfall) App.toast('Only ' + words.length + ' unused words available');
  };

  /* ---------- play: shared pieces ---------- */
  function hearts(stt, g) { return '<span class="hm-lives">❤️ ' + stt.left + (g.lives > 7 ? '/' + g.lives : ' left') + '</span>'; }
  function wordHtml(Wd, cur, stream) {
    var norm = Core.hmNorm(Wd.word), mask = Core.hmMask(Wd.word, cur.guessed), over = cur.status !== 'play', groups = [[]], longest = 1;
    for (var i = 0; i < norm.length; i++) {
      var ch = norm.charAt(i); if (ch === ' ') { groups.push([]); continue; }
      var isL = ch >= 'A' && ch <= 'Z', shown = mask[i];
      groups[groups.length - 1].push(isL ? '<span class="hl' + (over && shown === '_' ? ' miss' : '') + '">' + (over ? ch : (shown === '_' ? '&nbsp;' : shown)) + '</span>' : '<span class="hp">' + esc(ch) + '</span>');
    }
    groups.forEach(function (gp) { if (gp.length > longest) longest = gp.length; });
    var fs = Math.max(2.8, Math.min(8, (stream ? 76 : 90) / (longest * 1.3)));
    return '<div class="hm-word" style="--hmfs:' + fs.toFixed(2) + '">' + groups.filter(function (gp) { return gp.length; }).map(function (gp) { return '<span class="hg">' + gp.join('') + '</span>'; }).join('') + '</div>';
  }
  function statusMsg(g, cur, stt) {
    if (cur.status === 'won') return '<div class="hm-msg win">🎉 Solved!</div>';
    if (cur.status === 'lost') return '<div class="hm-msg lose">' + (cur.timeUp ? '⏱ Time’s up!' : '💥 Out of lives!') + '</div>';
    if (cur.status === 'revealed') return '<div class="hm-msg lose">👁 Answer revealed</div>';
    return '<div class="hm-msg">' + (stt.wrongLetters.length ? '❌ ' + stt.wrongLetters.join(' · ') : 'No wrong guesses yet') + '</div>';
  }
  function winnersOf(g) {
    var ids = g.host.awards[String(g.index)] || [];
    return ids.map(function (id) { var p = g.host.players.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }).filter(Boolean);
  }
  function keyboard(cur, stt, word) {
    var wl = Core.hmLetters(word);
    return '<div class="hm-kb">' + ROWS.map(function (r) {
      return '<div class="hm-kr">' + r.split('').map(function (c) {
        var used = cur.guessed.indexOf(c) !== -1, ok = used && wl.indexOf(c) !== -1;
        return '<button class="key' + (used ? (ok ? ' ok' : ' bad') : '') + '" data-act="h-letter" data-c="' + c + '"' + (used || cur.status !== 'play' ? ' disabled' : '') + '>' + c + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function abcGrid(cur, word) {
    var wl = Core.hmLetters(word);
    return '<div class="hm-abc">' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (c) {
      var used = cur.guessed.indexOf(c) !== -1, ok = used && wl.indexOf(c) !== -1;
      return '<span class="' + (used ? (ok ? 'ok' : 'bad') : '') + '">' + c + '</span>';
    }).join('') + '</div>';
  }
  function textRow() { return '<div class="row hm-text"><input type="text" id="hg-input" placeholder="Type a letter or the whole word – Enter" autocomplete="off" autocapitalize="characters" data-enter="h-text" class="grow"><button class="btn small primary" data-act="h-text">Guess</button></div>'; }
  function awardRow(g) {
    if (g.mode !== 'vs' || g.tb) return '';
    return '<div class="row hm-text"><input type="text" id="award-name" placeholder="Solved it? Winner’s name (+' + pts() + ') – Enter" autocomplete="off" autocapitalize="words" data-enter="h-award" class="grow"></div>';
  }
  function toolsRow(g, cur, stt) {
    var Wd = W(), t = '';
    if (!Wd.pending) t += '<button class="btn" data-act="h-copy-q">📋 Copy word</button>';
    t += '<button class="btn" data-act="h-swap">🎲 Random word</button>';
    if (!g.hostPlay) t += '<button class="btn' + (g.ownOpen || Wd.pending ? ' on' : '') + '" data-act="h-own">✍️ My word</button>';
    if (!Wd.pending) {
      if (g.hostPlay) t += cur.peek ? '<button class="btn yellow" data-act="h-reveal">📺 Reveal answer to stream</button>' : '<button class="btn yellow" data-act="h-peek">👁 Reveal answer (only me)</button>';
      else t += '<button class="btn" data-act="h-reveal">👁 Give up</button>';
    }
    var own = (!g.hostPlay && (g.ownOpen || Wd.pending) && cur.status === 'play') ? '<div class="row hm-text"><input type="text" id="hg-own" placeholder="Type your word or phrase – Enter" autocomplete="off" autocapitalize="characters" data-enter="h-own-set" class="grow"><button class="btn small primary" data-act="h-own-set">Use it</button></div>' : '';
    return (Wd.pending ? own : '') + '<div class="row hm-tools">' + t + '</div>' + (Wd.pending ? '' : own);
  }
  function privWord(g, Wd, cur) {
    if (cur.status !== 'play') return '';
    if (Wd.pending) return '';
    if (g.hostPlay && !cur.peek) return '<div class="hm-priv locked">🔒 Word hidden – you’re playing along</div>';
    return '<div class="hm-priv">🔒 Word (only you can see): <b>' + esc(Wd.word) + '</b>' + (g.showCat ? ' <small>· ' + esc(Wd.cat) + '</small>' : '') + '</div>';
  }
  function awardChips(g) {
    var ids = g.host.awards[String(g.index)] || []; if (!ids.length) return '';
    return '<p class="help">✅ Scored (tap a name to take it back):</p><div class="seg">' + ids.map(function (id) {
      var p = g.host.players.filter(function (x) { return x.id === id; })[0];
      return p ? '<button class="chip" data-act="h-unaward" data-id="' + id + '">' + esc(p.name) + ' ✕</button>' : '';
    }).join('') + '</div>';
  }
  function nextBtn(g) { var last = g.index === g.total - 1; return '<button class="btn primary big grow" data-act="h-next">' + (last ? 'Finish 🏁' : 'Next word →') + '</button>'; }
  function afterBlock(g, cur, Wd) {
    /* shown once the word is finished */
    if (g.tb) return tbAfter(g, cur);
    var h = '';
    if (g.mode === 'vs') h += '<div class="row"><input type="text" id="award-name" placeholder="Winner’s name (+' + pts() + ') – press Enter" autocomplete="off" autocapitalize="words" data-enter="h-award" class="grow"></div>' + awardChips(g);
    h += '<div class="row hm-tools"><button class="btn primary" data-act="h-copy-a">📋 Copy result</button></div>';
    h += '<div class="row" style="margin-top:8px;flex-wrap:nowrap">' + (g.mode === 'vs' && g.index > 0 ? '<button class="btn big" style="flex:0 0 auto" data-act="h-back">← Back</button>' : '') + nextBtn(g) + '</div>';
    return h;
  }
  function tbAfter(g, cur) {
    var tb = g.tb;
    if (cur.status === 'won') {
      if (tb.winner) { var w = tbP(g, tb.winner); return '<p class="tie-win">🏆 ' + esc(w.name) + ' wins the tiebreaker!</p><div class="row"><button class="btn" data-act="h-tb-undo">↩ Change winner</button><button class="btn primary grow" data-act="h-tb-finish">See final leaderboard →</button></div>'; }
      return '<p class="help">Who solved it first? Tap their name:</p><div class="tb-pick">' + tb.ids.map(function (id) { return '<button class="btn primary big" data-act="h-tb-win" data-id="' + id + '">✅ ' + esc(tbP(g, id).name) + '</button>'; }).join('') + '</div>';
    }
    return '<p class="help">Nobody got it.</p><div class="row"><button class="btn primary big grow" data-act="h-tb-new">🔄 Try a new tiebreaker word</button></div>';
  }
  function minorRow(g) { return '<div class="minor"><button class="btn small" data-act="h-flag">🚩 Report word</button><button class="btn small" data-act="h-quit">Quit</button></div>'; }
  function headPills(g, Wd, cur, stt, stream) {
    var p = pts(), left = g.tb ? '🤝 Tiebreaker' : (g.index === g.total - 1 ? 'Final word' : 'Word ' + (g.index + 1)) + ' of ' + g.total;
    var tmr = g.timer && cur.status === 'play' ? '<span class="pill hm-timer" id="' + (stream ? 'sb-timer' : 'timer') + '">⏱</span>' : '';
    return '<div class="hm-info"><span class="pill">' + left + '</span>' + (g.showCat ? '<span class="pill cat">' + esc(Wd.cat) + '</span>' : '') + '<span class="pill pts">🎯 ' + p + ' pt' + (p === 1 ? '' : 's') + '</span><span class="pill">' + hearts(stt, g) + '</span>' + tmr + '</div>';
  }
  function boardHtml(g, Wd, cur, stt, stream) {
    if (Wd.pending) return '<div class="hm-typing"><div class="hm-big">✍️</div><div class="hm-big">Host is typing the word…</div><p>Get ready to guess!</p></div>';
    var names = stream && g.mode === 'vs' && cur.status === 'won' ? winnersOf(g) : [];
    return headPills(g, Wd, cur, stt, stream) +
      '<div class="hm-main">' + (stt.stage ? '<img class="hm-img" src="' + App.imgUrl('hm' + (stt.stage - 1) + '.jpg') + '" alt="Hangman picture ' + stt.stage + ' of 6">' : '<div class="hm-img blank" aria-hidden="true"></div>') + (stream ? abcGrid(cur, Wd.word) : '') + '</div>' +
      wordHtml(Wd, cur, stream) + statusMsg(g, cur, stt) + (names.length ? '<div class="hm-msg win">🏆 ' + esc(Core.joinNames(names)) + '</div>' : '');
  }

  /* ---------- play: normal screen ---------- */
  function drawer(g) {
    if (g.mode !== 'vs' || g.stream) return '';
    return '<aside class="drawer' + (App.lbOpen ? ' open' : '') + '" id="lb" aria-label="Leaderboard"><button class="drawer-tab" data-act="toggle-lb" aria-label="Show or hide leaderboard"><b>🏆</b><small>Leaders</small><span>◀</span></button><div class="drawer-in">' + vsBoard(g) + '</div></aside>';
  }
  function renderHPlay(app) {
    var g = App.hgame; if (!g) { go('hsetup'); return; }
    clearInterval(tick); App.setBackdrop('hangman');
    var keepA = document.getElementById('award-name'), keepG = document.getElementById('hg-input'), ta = keepA ? keepA.value : '', tg = keepG ? keepG.value : '';
    if (g.stream) { renderHStream(app, ta, tg); return; }
    var Wd = W(), cur = C(), stt = st(), play = cur.status === 'play';
    var tray = play && Wd.pending ? toolsRow(g, cur, stt) : play ? privWord(g, Wd, cur) + keyboard(cur, stt, Wd.word) + textRow() + toolsRow(g, cur, stt) + awardRow(g) : afterBlock(g, cur, Wd);
    app.innerHTML = '<div class="v-hplay">' + App.hud('<button class="icon-btn quit-btn" data-act="h-quit" aria-label="Quit">✕ Quit</button>') +
      '<div class="zone hm-panel"><div class="hm-board">' + boardHtml(g, Wd, cur, stt, false) + '</div></div>' +
      '<div class="hm-tray">' + tray + minorRow(g) + '</div>' + drawer(g) + '</div>';
    restore(ta, tg);
    if (g.timer && play && !Wd.pending) startTick();
    if (play && Wd.pending) setTimeout(function () { var i = document.getElementById('hg-own'); if (i) i.focus(); }, 60);
  }
  function restore(ta, tg) {
    var a = document.getElementById('award-name'), b = document.getElementById('hg-input');
    if (a && ta) a.value = ta; if (b && tg) b.value = tg;
  }
  function startTick() {
    var g = App.hgame;
    function upd() {
      var el = document.getElementById('timer'), el2 = document.getElementById('sb-timer'); if (!el && !el2) { clearInterval(tick); return; }
      var left = Math.max(0, Math.ceil((g.timerEnd - Date.now()) / 1000));
      [el, el2].forEach(function (e) { if (e) { e.textContent = '⏱ ' + left + 's'; e.classList.toggle('low', left <= 10); } });
      if (left <= 0) { clearInterval(tick); if (C().status === 'play') { finish('lost', true); hsave(); App.render(); App.toast('⏱ Time’s up'); } }
    }
    upd(); tick = setInterval(upd, 500);
  }

  /* ---------- guessing ---------- */
  function finish(status, timeUp) {
    var g = App.hgame, cur = C(), Wd = W(); if (cur.status !== 'play') return;
    cur.status = status; cur.timeUp = !!timeUp; clearInterval(tick);
    if (g.tb) return;
    var earned = 0; if (status === 'won' && g.mode === 'team') { earned = pts(); g.team.score += earned; g.team.solved++; }
    g.team.log.push({ word: Wd.word, cat: Wd.cat, status: status, earned: earned, wrong: st().wrong });
    markUsed(Wd); g.done[g.index] = clone(cur);
  }
  function checkEnd() { var s = st(); if (s.won) finish('won'); else if (s.lost) finish('lost'); }
  function guessLetter(c) {
    var g = App.hgame; if (!g) return; var cur = C(); if (cur.status !== 'play' || W().pending) return;
    c = String(c).toUpperCase(); if (!/^[A-Z]$/.test(c) || cur.guessed.indexOf(c) !== -1) return;
    cur.guessed.push(c); checkEnd(); hsave(); App.render();
  }
  App.actions['h-letter'] = function (el) { guessLetter(el.dataset.c); };
  App.actions['h-text'] = function () {
    var g = App.hgame, inp = document.getElementById('hg-input'), v = inp ? Core.hmNorm(inp.value) : ''; if (!v) { App.toast('Type a letter or the word first'); return; }
    var cur = C(); if (cur.status !== 'play' || W().pending) return;
    if (v.length === 1) { guessLetter(v); return; }
    if (v.replace(/[^A-Z]/g, '') === Core.hmNorm(W().word).replace(/[^A-Z]/g, '')) { Core.hmLetters(W().word).forEach(function (c) { if (cur.guessed.indexOf(c) === -1) cur.guessed.push(c); }); finish('won'); }
    else { cur.wrongWord++; App.toast('❌ ' + v + ' is not the word'); checkEnd(); }
    hsave(); App.render();
  };
  document.addEventListener('keydown', function (ev) {
    if (App.view !== 'hplay' || !App.hgame || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (document.querySelector('#modal-root .modal')) return;
    if (/^[a-zA-Z]$/.test(ev.key)) guessLetter(ev.key);
  });
  App.actions['h-hint'] = function () {};
  App.actions['h-peek'] = function () { var cur = C(); if (cur.status !== 'play') return; cur.peek = true; hsave(); App.render(); };
  App.actions['h-reveal'] = function () { var cur = C(); if (cur.status !== 'play') return; finish('revealed'); hsave(); App.render(); };
  App.actions['h-copy-q'] = function () { var g = App.hgame, Wd = W(), cur = C(); App.copy(Core.hmCopy(g.tb ? 1 : g.index + 1, g.total, Wd.word, cur.guessed, g.showCat ? Wd.cat : '', st().wrongLetters), 'word'); };
  App.actions['h-copy-a'] = function () { var g = App.hgame, cur = C(); if (cur.status === 'play') return; App.copy(Core.hmResultCopy(g.index + 1, g.total, W().word, cur.status === 'won'), 'result'); };

  function swapOut(Wd) {
    var g = App.hgame, rej = g.rejected.concat(Wd.bid ? [Wd.bid] : []), inGame = g.words.map(function (w) { return w.bid; });
    var cand = BANK.filter(function (r) { return r.difficulty === Wd.difficulty && App.hflag.indexOf(r.id) === -1 && App.hused.indexOf(r.id) === -1 && inGame.indexOf(r.id) === -1 && rej.indexOf(r.id) === -1; });
    if (!cand.length) cand = BANK.filter(function (r) { return App.hflag.indexOf(r.id) === -1 && App.hused.indexOf(r.id) === -1 && inGame.indexOf(r.id) === -1 && rej.indexOf(r.id) === -1; });
    if (!cand.length) { App.toast('No other word available'); return false; }
    var r = cand[Math.floor(Math.random() * cand.length)];
    g.rejected = rej; g.words[g.index] = { word: r.word, cat: r.cat, difficulty: r.difficulty, bid: r.id }; g.cur = fresh(); setTimer(); return true;
  }
  App.actions['h-swap'] = function () {
    var g = App.hgame; if (C().status !== 'play') return;
    if (g.tb) { if (!tbPick(g)) return; setTimer(); hsave(); App.render(); return; }
    var Wd = W(); if (Wd.pending) Wd = { difficulty: 'medium', bid: null };
    if (swapOut(Wd)) { g.ownOpen = false; hsave(); App.render(); }
  };
  App.actions['h-own'] = function () {
    var g = App.hgame; if (g.hostPlay || C().status !== 'play') return;
    if (W().pending) { var i0 = document.getElementById('hg-own'); if (i0) i0.focus(); return; }
    g.ownOpen = !g.ownOpen; App.render();
    setTimeout(function () { var i = document.getElementById('hg-own'); if (i) i.focus(); }, 30);
  };
  App.actions['h-own-set'] = function () {
    var g = App.hgame; if (g.hostPlay || C().status !== 'play') return;
    var inp = document.getElementById('hg-own'), t = inp ? inp.value : ''; if (!t.trim()) { App.toast('Type your word first'); return; }
    var w = Core.hmNorm(t); if (w.replace(/[^A-Z]/g, '').length < 2 || w.length > 40) { App.toast('Use 2-40 letters'); return; }
    var o = { word: w, cat: 'Your word', difficulty: Core.hmDifficulty(w), bid: null, own: true };
    if (g.tb) { g.tb.w = o; g.tb.cur = fresh(); } else { g.words[g.index] = o; g.cur = fresh(); }
    g.ownOpen = false; setTimer(); hsave(); App.render();
  };
  App.actions['h-flag'] = function () {
    var g = App.hgame, Wd = W(); if (!Wd.bid) { App.toast('Only built-in words can be reported'); return; }
    if (!window.confirm('Report this word as bad or too obscure? It will be hidden from your future games.')) return;
    if (App.hflag.indexOf(Wd.bid) === -1) App.hflag.push(Wd.bid);
    if (!g.tb && C().status === 'play' && !g.hostPlay && swapOut(Wd)) { /* swapped */ } else if (g.tb && C().status === 'play') tbPick(g);
    hsave(); App.render(); App.toast('Reported - thanks');
  };

  /* ---------- awards / next / back / quit ---------- */
  App.actions['h-award'] = function () {
    var g = App.hgame, inp = document.getElementById('award-name'), name = inp ? inp.value : '', cur = C();
    if (!name.trim()) { App.toast('Type a name first'); return; }
    if (cur.status === 'lost' || cur.status === 'revealed') { App.toast('Nobody solved this one'); return; }
    if (cur.status === 'play') { Core.hmLetters(W().word).forEach(function (c) { if (cur.guessed.indexOf(c) === -1) cur.guessed.push(c); }); finish('won'); }
    var r = Core.awardPoints(g.host, name, g.index, pts());
    hsave(); App.render();
    App.toast(r.ok ? '+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : '') : r.reason === 'duplicate' ? r.player.name + ' already scored this word' : 'Could not add that name');
  };
  App.actions['h-unaward'] = function (el) {
    var g = App.hgame; if (Core.removeAward(g.host, el.dataset.id, g.index)) { hsave(); App.render(); App.toast('Points taken back - type the right name'); }
  };
  function loadCur(i) { var g = App.hgame; g.index = i; g.cur = g.done[i] ? clone(g.done[i]) : fresh(); clearInterval(tick); setTimer(); }
  App.actions['h-next'] = function () {
    var g = App.hgame; if (g.tb) return;
    if (g.cur.status === 'play') { App.toast(g.hostPlay ? 'Reveal the answer first' : 'Finish the word or tap Give up first'); return; }
    var inp = document.getElementById('award-name');
    if (g.mode === 'vs' && inp && inp.value.trim() && g.cur.status === 'won') {
      var r = Core.awardPoints(g.host, inp.value, g.index, pts());
      if (r.ok) App.toast('+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : '')); else if (r.reason !== 'duplicate') { App.toast('Could not add that name'); return; }
    }
    if (g.index >= g.total - 1) { g.finished = true; App.view = 'hresults'; hsave(); App.resetScroll = true; App.render(); return; }
    loadCur(g.index + 1); hsave(); App.resetScroll = true; App.render(); window.scrollTo(0, 0);
  };
  App.actions['h-back'] = function () { var g = App.hgame; if (g.mode !== 'vs' || g.index < 1 || g.tb) return; loadCur(g.index - 1); if (g.cur.status === 'play') g.cur.status = 'revealed'; hsave(); App.resetScroll = true; App.render(); };
  App.actions['h-back-last'] = function () { var g = App.hgame; if (!g || g.mode !== 'vs') return; unrecord(g); g.finished = false; g.tb = null; App.view = 'hplay'; loadCur(g.total - 1); if (g.cur.status === 'play') g.cur.status = 'revealed'; hsave(); App.resetScroll = true; App.render(); };
  App.actions['h-quit'] = function () {
    if (!window.confirm('Quit this game? Progress will be discarded (played words stay marked as played).')) return;
    var s = !!(App.hgame && App.hgame.stream); clearInterval(tick); App.hgame = null; App.lbOpen = false;
    if (s) App.hsetup.mode = 'stream'; hsave(); go('hsetup');
  };

  /* ---------- VS leaderboard ---------- */
  function vsBoard(g) {
    var ranked = Core.rankPlayers(g.host.players);
    var rows = ranked.length ? ranked.map(function (p) {
      return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + '</span>' +
        '<button class="mini" data-act="h-adj" data-id="' + p.id + '" data-d="1" aria-label="Add a point">+</button><button class="mini" data-act="h-adj" data-id="' + p.id + '" data-d="-1" aria-label="Remove a point">−</button>' +
        '<button class="mini" data-act="h-rename" data-id="' + p.id + '" aria-label="Rename">✏️</button><button class="mini" data-act="h-remove" data-id="' + p.id + '" aria-label="Remove player">✕</button></div>';
    }).join('') : '<p class="help">No players yet. Type a name when someone solves a word.</p>';
    return '<h3>🏆 Live leaderboard</h3>' + rows + '<div class="row" style="margin-top:10px"><button class="btn small" data-act="h-undo">↩ Undo</button><button class="btn small primary" data-act="h-copy-lb">📋 Copy top three</button></div>';
  }
  App.actions['h-adj'] = function (el) { Core.adjustPoints(App.hgame.host, el.dataset.id, parseInt(el.dataset.d, 10)); hsave(); App.render(); };
  App.actions['h-undo'] = function () { var h = Core.undoLast(App.hgame.host); App.toast(h ? 'Undone' : 'Nothing to undo'); hsave(); App.render(); };
  App.actions['h-rename'] = function (el) {
    var n = window.prompt('New name:'); if (n == null) return;
    var r = Core.renamePlayer(App.hgame.host, el.dataset.id, n); if (!r.ok) App.toast(r.reason === 'exists' ? 'That name is already used' : 'Name not changed'); hsave(); App.render();
  };
  App.actions['h-remove'] = function (el) { if (window.confirm('Remove this player?')) { Core.removePlayer(App.hgame.host, el.dataset.id); hsave(); App.render(); } };
  App.actions['h-copy-lb'] = function () { App.copy(Core.leaderboardCopy(App.hgame.host.players, App.templates), 'leaderboard'); };

  /* ---------- streamer mode: the capture box uses the mobile Hangman frame ---------- */
  function sboxOpen(cls, key) { return '<div class="sbox hm ' + (cls || '') + '" id="sbox" style="background-image:url(\'' + App.tallImg(key || 'hangman') + '\')"><div class="sb-in">'; }
  function streamLayout(app, box, ctl) {
    App.streamOut(app, box, ctl);
  }
  function renderHStream(app, ta, tg) {
    var g = App.hgame, Wd = W(), cur = C(), stt = st(), play = cur.status === 'play', p = pts();
    var box = sboxOpen() + boardHtml(g, Wd, cur, stt, true) + '</div></div>';
    var priv = play && Wd.pending ? '<div class="sc-ans"><div class="help">✍️ Viewers see “Host is typing word…”</div><div class="ans">Type your word below</div></div>' : play ? (g.hostPlay && !cur.peek ? '<div class="sc-ans locked"><div class="ans">🔒 Word hidden</div><div class="help">You’re playing along – tap Reveal answer when you’re ready.</div></div>'
      : '<div class="sc-ans"><div class="help">🔒 Private word – not shown on stream</div><div class="ans">' + esc(Wd.word) + '</div>' + (g.showCat ? '<div class="help">Category: ' + esc(Wd.cat) + '</div>' : '') + '</div>') : '';
    var body = play && Wd.pending ? toolsRow(g, cur, stt) : play ? keyboard(cur, stt, Wd.word) + textRow() + toolsRow(g, cur, stt) + awardRow(g) : '<div class="sc-ans"><div class="help">Word</div><div class="ans">' + esc(Wd.word) + '</div></div>' + afterBlock(g, cur, Wd);
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">' + (g.tb ? '🤝 Tiebreaker' : (g.index === g.total - 1 ? 'Final word' : 'Word ' + (g.index + 1)) + ' of ' + g.total) + '</span><span class="pill pts">' + cap(Wd.difficulty) + ' · ' + p + ' pt' + (p === 1 ? '' : 's') + '</span><span class="grow"></span><button class="btn small" data-act="h-flag">🚩 Report</button><button class="btn small" data-act="h-quit">✕ Quit</button></div>' +
      priv + body + (g.tb ? '' : '<div class="sc-lb">' + vsBoard(g) + '</div>') + '</div>';
    streamLayout(app, box, ctl); restore(ta, tg);
    if (g.timer && play && !Wd.pending) startTick();
    if (play && Wd.pending) setTimeout(function () { var i = document.getElementById('hg-own'); if (i) i.focus(); }, 60);
  }
  function renderStreamLobby(app, s, f, start, links) {
    var flat = s.pointsMode === 'flat', custom = s.src === 'custom';
    var rows = [['🎯 Difficulty', custom ? 'Your own words' : f.dl.length === 3 ? 'Mixed' : f.dl.map(cap).join(' + ')], ['🔤 Words', String(custom ? f.cw : f.want || '')], ['🏆 Points', flat ? '1 point each' : 'Harder = more'], ['❤️ Wrong guesses', '6'], ['⏱ Timer', (s.hostPlay && !custom) ? 'Off · host plays along' : timerLabel(s.timer || 0)]];
    var box = sboxOpen('framed', 'hsetup') + '<div class="hm-lobby"><div class="hm-big">Get ready to guess! 🔤</div>' + rows.map(function (r) { return '<div class="hm-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><button class="btn small" data-act="go-mode">🎮 Game Night</button><span class="pill">🎮 Game selection</span><span class="grow"></span></div>' +
      '<div class="sc-start">' + f.msg + start + '</div><div class="row">' + links + '</div><div class="setup-grid sc-form">' + f.cols + '</div></div>';
    streamLayout(app, box, ctl);
  }

  /* ---------- results ---------- */
  function confetti() {
    if (App.settings.calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var em = ['🎉', '✨', '🐣', '🌟', '🏆', '🔤'];
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
      e.players.forEach(function (p) { var k = Core.normalizeText(p.name), a = App.hall[k] = App.hall[k] || { name: p.name, points: 0, games: 0, wins: 0 }; a.points += p.score; a.games++; if (p.rank === 1 && p.score > 0) a.wins++; });
    } else e.team = { score: g.team.score, solved: g.team.solved };
    g.recEntry = e; App.hhist.unshift(e); App.hhist = App.hhist.slice(0, 30); store.set('hhist', App.hhist); store.set('hall', App.hall);
  }
  function unrecord(g) {
    if (!g.recorded) return; var e = g.recEntry; g.recorded = false; if (!e) return;
    App.hhist = App.hhist.filter(function (x) { return x.t !== e.t; });
    (e.players || []).forEach(function (p) { var k = Core.normalizeText(p.name), a = App.hall[k]; if (!a) return; a.points -= p.score; a.games--; if (p.rank === 1 && p.score > 0) a.wins--; if (a.games <= 0) delete App.hall[k]; });
    g.recEntry = null; store.set('hhist', App.hhist); store.set('hall', App.hall);
  }
  function topTied(g) { var r = Core.rankPlayers(g.host.players).filter(function (p) { return p.rank === 1; }); return r.length > 1 && r[0].score > 0 ? r : []; }
  function tieBanner(g) {
    var t = topTied(g); if (!t.length) return '';
    return '<div class="tie-banner"><b>🤝 It’s a tie for first!</b><span>' + esc(Core.joinNames(t.map(function (p) { return p.name; }))) + ' on ' + t[0].score + ' pts</span><button class="btn yellow" data-act="h-tb-start">⚡ Play tiebreaker word</button></div>';
  }
  function renderHResults(app) {
    var g = App.hgame; if (!g) { go('hsetup'); return; }
    clearInterval(tick); App.setBackdrop('hleader'); record(g);
    if (g.stream) { renderStreamEnd(app, g); return; }
    var body, medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    if (g.mode === 'team') {
      var max = g.team.log.length, pc = max ? Math.round(g.team.solved / max * 100) : 0;
      body = '<div class="rres-scroll"><h2>🎉 Hangman complete!</h2><p class="rbig">Team solved <b>' + g.team.solved + '</b> of ' + g.total + ' · <b>' + g.team.score + '</b> pts</p><p class="help">' + pc + '% solved</p>' +
        g.team.log.map(function (l) { return '<div class="lb-item" style="display:block"><b>' + (l.status === 'won' ? '✅' : '❌') + ' ' + esc(l.word) + '</b><div class="help">' + esc(l.cat) + (l.status === 'won' ? ' · +' + l.earned : '') + '</div></div>'; }).join('') + '</div>';
    } else {
      var ranked = Core.rankPlayers(g.host.players);
      body = '<div class="rres-scroll"><h2>🏆 Final leaderboard</h2>' + tieBanner(g) + (ranked.length ? ranked.map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + (medal[p.rank] || p.rank) + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + '</span></div>';
      }).join('') : '<p class="help">No points awarded.</p>') + '</div>';
      if (ranked.length && ranked[0].score > 0 && !topTied(g).length) confetti();
    }
    var extra = g.mode === 'vs' ? '<button class="btn small primary" data-act="h-copy-lb">📋 Copy top three</button><button class="btn small" data-act="h-back-last">↩ Back to last word</button>' : '';
    app.innerHTML = '<div class="v-hres">' + App.hud() + '<div class="zone hm-panel hm-dark">' + body + '</div><div class="hm-tray"><div class="row">' + extra + '</div>' +
      '<div class="row rres-actions"><button class="btn yellow grow" data-act="h-again">🔁 Play again</button><button class="btn" data-act="h-go-setup">Change settings</button></div></div></div>';
  }
  function renderStreamEnd(app, g) {
    var ranked = Core.rankPlayers(g.host.players), medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    var top = ranked.filter(function (p) { return p.rank === 1 && p.score > 0; });
    var status = !ranked.length || !ranked[0].score ? 'Thanks for playing!' : top.length > 1 ? '🤝 Tie for first: ' + esc(Core.joinNames(top.map(function (p) { return p.name; }))) : '🏆 ' + esc(top[0].name) + ' wins!';
    var box = sboxOpen('framed', 'hleader') + '<div class="hm-lobby"><div class="hm-big">' + status + '</div>' +
      (ranked.length ? ranked.slice(0, 5).map(function (p) { return '<div class="hm-row' + (p.rank === 1 && p.score > 0 ? ' first' : '') + '"><span>' + (medal[p.rank] || p.rank) + ' ' + esc(p.name) + '</span><b>' + p.score + ' pts</b></div>'; }).join('') : '<div class="hm-row"><span>No points awarded</span></div>') + '</div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">🏁 Hangman finished</span><span class="grow"></span></div>' +
      '<button class="btn primary big sc-again" data-act="h-again">🔁 Play again – back to game selection</button>' + tieBanner(g) +
      '<div class="row sc-tools" style="margin-top:12px"><button class="btn" data-act="h-back-last">↩ Back to last word</button><button class="btn" data-act="h-go-setup">Change settings</button></div><div class="sc-lb">' + vsBoard(g) + '</div></div>';
    streamLayout(app, box, ctl);
  }
  App.actions['h-again'] = function () {
    var s = App.hgame ? App.hgame.setup : App.hsetup, stm = !!(App.hgame && App.hgame.stream);
    App.hsetup = Object.assign({}, App.hsetup, s); App.hgame = null; hsave();
    if (stm) { App.hsetup.mode = 'stream'; hsave(); go('hsetup'); } else App.actions['h-start']();
  };

  /* ---------- tiebreaker word: first to solve wins ---------- */
  function tbP(g, id) { return g.host.players.filter(function (x) { return x.id === id; })[0]; }
  function tbPick(g) {
    var tb = g.tb, ok = function (x) { return App.hused.indexOf(x.id) === -1 && g.words.every(function (w) { return w.bid !== x.id; }) && App.hflag.indexOf(x.id) === -1 && x.id !== tb.bid; };
    var p = BANK.filter(function (x) { return x.difficulty === 'medium' && ok(x); }); if (!p.length) p = BANK.filter(ok);
    if (!p.length) { App.toast('No tiebreaker words left'); return false; }
    var r = p[Math.floor(Math.random() * p.length)]; if (App.hused.indexOf(r.id) === -1) App.hused.push(r.id);
    tb.bid = r.id; tb.w = { word: r.word, cat: r.cat, difficulty: r.difficulty, bid: r.id }; tb.cur = fresh(); tb.winner = null; return true;
  }
  App.actions['h-tb-start'] = function () {
    var g = App.hgame, tied = topTied(g); if (!tied.length) return;
    g.tb = { ids: tied.map(function (p) { return p.id; }), w: null, cur: null, winner: null, bid: null };
    if (!tbPick(g)) { g.tb = null; return; }
    [].forEach.call(document.querySelectorAll('.confetti'), function (n) { n.remove(); });
    unrecord(g); g.timerEnd = 0; go('hplay'); hsave();
  };
  App.actions['h-tb-new'] = function () { var g = App.hgame; if (g.tb && g.tb.cur.status !== 'won' && tbPick(g)) { hsave(); App.render(); } };
  App.actions['h-tb-win'] = function (el) {
    var g = App.hgame, tb = g.tb, p = tb && tb.cur.status === 'won' && !tb.winner && tbP(g, el.dataset.id); if (!p) return;
    p.tb = (p.tb || 0) + 1; tb.winner = p.id; hsave(); App.render();
  };
  App.actions['h-tb-undo'] = function () { var g = App.hgame, tb = g.tb; if (!tb || !tb.winner) return; var p = tbP(g, tb.winner); if (p && p.tb) p.tb--; tb.winner = null; hsave(); App.render(); };
  App.actions['h-tb-finish'] = function () { var g = App.hgame; g.tb = null; App.view = 'hresults'; App.resetScroll = true; hsave(); App.render(); };

  /* ---------- leaderboard page ---------- */
  function renderHLeader(app) {
    App.setBackdrop('hleader'); var body, foot = '';
    if (App.hlbTab === 'alltime') {
      var list = Object.keys(App.hall).map(function (k) { var a = App.hall[k]; return { id: k, name: a.name, score: a.points, games: a.games, wins: a.wins }; });
      var ranked = Core.rankPlayers(list), by = {}; list.forEach(function (x) { by[x.id] = x; });
      body = ranked.length ? '<div class="lb-scroll">' + ranked.slice(0, 50).map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="help" style="margin:0">' + by[p.id].games + ' games · ' + by[p.id].wins + ' wins</span><span class="lb-score">' + p.score + '</span></div>';
      }).join('') + '</div>' : '<p class="help">No VS games finished yet. Players you award points to appear here after the game ends.</p>';
      if (ranked.length) foot = '<button class="btn small primary" data-act="h-copy-alltime">📋 Copy all-time top three</button><button class="btn small danger" data-act="h-clear-lb">Clear</button>';
    } else {
      body = App.hhist.length ? '<div class="lb-scroll">' + App.hhist.map(function (h, hi) {
        var d = new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        var inner = h.players ? (h.players.slice(0, 3).map(function (p) { return p.rank + '. ' + esc(p.name) + ' (' + p.score + ')'; }).join(' · ') || 'No points awarded') : 'Team: ' + h.team.solved + '/' + h.total + ' solved, ' + h.team.score + ' pts';
        return '<div class="lb-item" style="display:block"><b>' + d + ' · ' + (h.mode === 'vs' ? 'VS' : 'Team') + ' · ' + h.total + ' words</b><div class="help">' + inner + '</div>' + (h.players && h.players.length ? '<button class="btn small primary" style="margin-top:.4em" data-act="h-copy-game" data-i="' + hi + '">📋 Copy top three</button>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="help">No finished Hangman games yet - play one and it appears here.</p>';
    }
    app.innerHTML = '<div class="v-hleader">' + App.hud() + '<div class="zone hm-panel hm-dark"><div class="tabs">' +
      '<button class="chip" data-act="h-lbtab" data-v="recent" aria-pressed="' + (App.hlbTab === 'recent') + '">Recent games</button>' +
      '<button class="chip" data-act="h-lbtab" data-v="alltime" aria-pressed="' + (App.hlbTab === 'alltime') + '">All-time (this device)</button></div>' + body + '</div>' +
      '<div class="hm-tray"><div class="row">' + foot + '<button class="btn small" data-act="h-go-setup">← Back to game selection</button></div></div></div>';
  }
  App.actions['h-lbtab'] = function (el) { App.hlbTab = el.dataset.v; App.render(); };
  App.actions['h-copy-alltime'] = function () {
    App.copy(Core.leaderboardCopy(Object.keys(App.hall).map(function (k) { return { id: k, name: App.hall[k].name, score: App.hall[k].points }; }), App.templates), 'leaderboard');
  };
  App.actions['h-copy-game'] = function (el) {
    var h = App.hhist[+el.dataset.i]; if (!h || !h.players) return;
    App.copy(Core.leaderboardCopy(h.players.map(function (p, i) { return { id: 'h' + i, name: p.name, score: p.score }; }), App.templates), 'leaderboard');
  };
  App.actions['h-clear-lb'] = function () { if (window.confirm('Clear saved Hangman leaderboards on this device?')) { App.hhist = []; App.hall = {}; store.set('hhist', []); store.set('hall', {}); App.render(); } };

  /* ---------- stats ---------- */
  App.actions['h-stats'] = function () {
    var by = { easy: 0, medium: 0, hard: 0 }, left = { easy: 0, medium: 0, hard: 0 };
    BANK.forEach(function (r) { by[r.difficulty]++; if (App.hused.indexOf(r.id) === -1) left[r.difficulty]++; });
    App.openModal('<h2>Hangman word bank</h2><p><b>' + BANK.length + '</b> words · <b>' + App.hused.length + '</b> played · <b>' + (left.easy + left.medium + left.hard) + '</b> left</p>' +
      '<table class="stats"><tr><th>Level</th><th>Total</th><th>Left</th></tr><tr><td>Easy</td><td>' + by.easy + '</td><td>' + left.easy + '</td></tr><tr><td>Medium</td><td>' + by.medium + '</td><td>' + left.medium + '</td></tr><tr><td>Hard</td><td>' + by.hard + '</td><td>' + left.hard + '</td></tr></table>' +
      '<p class="help">Played history is saved on this device only.</p><div class="row"><button class="btn danger" data-act="h-reset-history">Reset played words</button><button class="btn grow" data-act="close-modal">Close</button></div>');
  };
  App.actions['h-reset-history'] = function () {
    if (!window.confirm('Reset played words? They can appear again.')) return;
    App.hused = []; App.hflag = []; hsave(); App.closeModal(); App.toast('Word history reset'); App.render();
  };

  /* ---------- router hook ---------- */
  var prev = App.renderRiddle;
  App.renderRiddle = function (v, app) {
    if (!HV[v]) { prev(v, app); return; }
    if (v === 'hsetup') renderHSetup(app);
    else if (v === 'hplay') renderHPlay(app);
    else if (v === 'hresults') renderHResults(app);
    else if (v === 'hleader') renderHLeader(app);
  };
})();
