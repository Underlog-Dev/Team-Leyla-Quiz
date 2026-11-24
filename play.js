/* Team Leyla Quiz Hub - gameplay: start, question screen (solo + host), refresh, scoring, results. */
(function () {
  'use strict';
  var App = window.App, Core = App.Core, THEMES = App.THEMES, esc = App.esc, BY_ID = App.BY_ID;
  var tick = null;

  function q() { return BY_ID[App.game.ids[App.game.index]]; }
  function fresh() { return { revealed: false, hint: false, answered: false, correct: null, pick: null, guess: '', close: false, options: null }; }
  function isMc(g, c) { return g.format === 'mc' || !!c.mc; }
  /* "Show multiple choice" on a medium/hard question drops it to 1 point */
  function points() { var g = App.game, c = g.cur; return Core.availablePoints(q().difficulty, c.hint, c.mc ? 1 : (g.flat || 0)); }
  function mcBtn(g, Q, cur) {
    if (g.format === 'mc' || cur.mc || cur.answered || (Q.difficulty !== 'hard' && Q.difficulty !== 'medium')) return '';
    return '<button class="btn" data-act="showmc">\uD83D\uDD20 Show multiple choice' + (g.flat ? '' : ' (1 pt)') + '</button>';
  }

  /* ---------- start ---------- */
  App.actions.start = function () {
    var s = App.setup, pool = App.poolBank(s);
    var want = s.count === 'custom' ? Math.max(1, parseInt(s.custom, 10) || 0) : s.count;
    if (!want) { App.toast('Enter how many questions'); return; }
    var res = Core.buildQuiz(pool, { themes: [], difficulty: App.diffList(s) }, Math.min(want, 500), App.used);
    if (!res.questions.length) { App.toast('No unused questions left for these settings'); return; }
    App.game = {
      mode: s.mode === 'stream' ? 'host' : s.mode, stream: s.mode === 'stream', format: s.format, difficulty: App.diffList(s), flat: s.pointsMode === 'flat' ? 1 : 0, timer: s.mode === 'solo' ? s.timer : 0,
      setup: JSON.parse(JSON.stringify(s)),
      ids: res.questions.map(function (x) { return x.id; }), total: res.questions.length, index: 0,
      rejected: [], finished: false, cur: fresh(), solo: { score: 0, correct: 0, log: [] }, host: Core.newHostState(), started: Date.now()
    };
    App.game.shortfall = res.shortfall;
    setTimer(); App.view = 'play'; App.save(); App.render();
    if (res.shortfall) App.toast('Only ' + res.questions.length + ' unused questions available');
  };
  function setTimer() { var g = App.game; g.timerEnd = g.timer ? Date.now() + g.timer * 1000 : 0; }

  /* ---------- play screen ---------- */
  App.lbOpen = false;
  App.renderPlay = function (app) {
    var g = App.game, cur = g.cur, Q = q(), th = THEMES[Q.theme] || THEMES.general;
    clearInterval(tick);
    App.setBackdrop(Q.theme, g.index);
    var nq = BY_ID[g.ids[g.index + 1]]; if (nq) App.preload(nq.theme, g.index + 1);
    if (g.stream) { renderStream(app, Q, th); return; }
    var isHost = g.mode === 'host', pts = points(), last = g.index === g.total - 1;
    if (isMc(g, cur) && !cur.options) cur.options = Core.mcOptions(Q);
    var head = '<div class="qhead"><span class="pill">' + (last ? 'Final question' : 'Question ' + (g.index + 1)) + ' of ' + g.total + '</span>' +
      '<span class="pill">' + th.icon + ' ' + esc(th.label) + '</span><span class="pill pts">' + esc(cap(Q.difficulty)) + ' \u00B7 ' + pts + ' pt' + (pts === 1 ? '' : 's') + '</span></div>';
    var body = isHost ? hostBody(Q, cur, last) : soloBody(Q, cur, last);
    var main = '<section class="zone"><div class="qwrap">' + head + '<div class="qcard" id="qcard">' +
      (g.timer && !cur.answered ? '<div class="timer" id="timer"></div>' : '') +
      '<div class="qtext" id="qtext">' + esc(Q.question) + '</div>' + body + '</div>' +
      '<div class="minor"><button class="btn small" data-act="flag">\uD83D\uDEA9 Report wrong</button><button class="btn small" data-act="quit">Quit quiz</button></div></div></section>';
    var extra = '<button class="icon-btn quit-btn" data-act="quit" aria-label="Quit quiz">\u2715 Quit</button>';
    var drawer = isHost ? '<aside class="drawer' + (App.lbOpen ? ' open' : '') + '" id="lb" aria-label="Leaderboard"><button class="drawer-tab" data-act="toggle-lb" aria-label="Show or hide leaderboard"><b>\uD83C\uDFC6</b><small>Leaders</small><span>\u25C0</span></button><div class="drawer-in">' + leaderboard() + '</div></aside>' : '';
    app.innerHTML = '<div class="v-play">' + App.hud(extra) + main + drawer + '</div>';
    if (g.timer && !cur.answered) startTick();
  };

  /* the answer, shown to viewers ONLY after Leyla presses Enter on a winner (or Reveal answer) */
  function revealBlock(g, Q) {
    var ids = g.host.awards[String(g.index)] || [], names = ids.map(function (id) { var p = g.host.players.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }).filter(Boolean);
    return '<div class="sb-reveal"><b>\u2705 Answer</b> ' + esc(Q.answer) + (names.length ? '<span class="sb-win">\uD83C\uDFC6 ' + esc(Core.joinNames(names)) + '</span>' : '') + '</div>';
  }
  App.actions.unreveal = function () { App.game.cur.revealed = false; App.save(); App.render(); };
  /* ---------- Streamer Mode: fixed capture box (public) + private controls ---------- */
  function renderStream(app, Q, th) {
    var g = App.game, cur = g.cur, pts = points(), last = g.index === g.total - 1;
    var keep = document.getElementById('award-name'), typed = keep ? keep.value : '';
    var mcOn = isMc(g, cur);
    if (mcOn && !cur.options) cur.options = Core.mcOptions(Q);
    /* ---- PUBLIC: nothing but question, hint and options is ever rendered in here ---- */
    var box = sboxOpen(Q.theme) + '<div class="sb-head"><span>🐣 Team Leyla Quiz</span><span>Question ' + (g.index + 1) + ' of ' + g.total + '</span></div>' +
      '<div class="sb-sub"><span>' + th.icon + ' ' + esc(th.label) + '</span><span>' + esc(cap(Q.difficulty)) + ' · ' + pts + ' pt' + (pts === 1 ? '' : 's') + '</span></div>' +
      '<div class="sb-body' + (!cur.hint && !mcOn && !cur.revealed ? ' soloq' : '') + '" id="sb-body"><div class="sb-qwrap"><div class="sb-q" id="sb-q">' + esc(Q.question) + '</div></div>' +
      (cur.hint ? '<div class="sb-hint"><b>💡 Hint</b> ' + esc(Core.safeHint(Q)) + '</div>' : '') +
      (cur.revealed ? revealBlock(g, Q) : '') +
      (mcOn ? '<div class="sb-opts">' + cur.options.map(function (o, i) { return '<div class="sb-opt"><b>' + 'ABCD'[i] + '</b><span>' + esc(o) + '</span></div>'; }).join('') + '</div>' : '') +
      '</div></div></div>';
    /* ---- PRIVATE ---- */
    var answers = (Q.acceptedAnswers || []).filter(function (a) { return Core.normalizeText(a) !== Core.normalizeText(Q.answer); }).slice(0, 4);
    var ctl = '<div class="sctl" id="sctl">' +
      '<div class="sc-top"><span class="pill">' + (last ? 'Final question' : 'Question ' + (g.index + 1)) + ' of ' + g.total + '</span><span class="pill pts">' + esc(cap(Q.difficulty)) + ' · ' + pts + ' pt' + (pts === 1 ? '' : 's') + '</span>' +
      '<span class="grow"></span><button class="btn small" data-act="flag">🚩 Report wrong</button><button class="btn small" data-act="quit">✕ Quit</button></div>' +
      '<div class="sc-ans"><div class="help">🔒 Private answer – not shown on stream</div><div class="ans">' + esc(Q.answer) + '</div>' +
      (answers.length ? '<div class="help">Also accepted: ' + esc(answers.join(' · ')) + '</div>' : '') + (Q.explanation ? '<div class="help">' + esc(Q.explanation) + '</div>' : '') + '</div>' +
      '<div class="row sc-tools"><button class="btn' + (cur.hint ? ' on' : '') + '" data-act="hint">💡 ' + (cur.hint ? 'Hint shown' : 'Show hint (-1 pt)') + '</button>' +
      (mcOn ? '<button class="btn on" disabled>🔠 Choices shown</button>' : (cur.answered ? '' : '<button class="btn" data-act="showmc">\uD83D\uDD20 Show multiple choice' + (g.flat ? '' : ' (1 pt)') + '</button>')) +
      '<button class="btn" data-act="refresh">🔄 Refresh</button>' + easierBtn(Q, cur) + '</div>' +
      '<div class="row" style="margin-top:10px"><input type="text" id="award-name" placeholder="Winner’s name – press Enter to show the answer (+' + pts + ')" autocomplete="off" autocapitalize="words" data-enter="award" class="grow"></div>' + awardedChips() +
      '<div class="row" style="margin-top:8px">' + (cur.revealed ? '<button class="btn" data-act="unreveal">🙈 Hide answer from stream</button>' : '<button class="btn yellow" data-act="award">✅ Show answer (uses name above)</button>') + '</div>' +
      '<div class="row sc-nav"><button class="btn big" style="flex:0 0 auto"' + (g.index > 0 ? ' data-act="back"' : ' disabled') + '>← Back</button>' +
      '<button class="btn primary big grow" data-act="next">' + (last ? 'Finish quiz 🏁' : 'Next question →') + '</button></div>' +
      '<div class="sc-lb">' + leaderboard() + '</div></div>';
    document.body.classList.add('streamer');
    app.innerHTML = '<div class="v-stream"><div class="sb-wrap">' + box + '<div class="sb-note">📺 Capture this box only. Everything else is private.</div></div>' + ctl + '</div>';
    var inp = document.getElementById('award-name'); if (inp && typed) inp.value = typed;
    fitStream();
  }
  /* opens the capture box with the same portrait artwork the mobile layout uses */
  function sboxOpen(key) { return '<div class="sbox' + (key === 'setup' || key === 'leader' ? ' framed' : '') + '" id="sbox" style="background-image:url(\'' + App.tallImg(key) + '\')"><div class="sb-in">'; }
  function streamLayout(app, box, ctl) {
    document.body.classList.add('streamer');
    app.innerHTML = '<div class="v-stream"><div class="sb-wrap">' + box + '<div class="sb-note">\uD83D\uDCFA Capture this box only. Everything else is private.</div></div>' + ctl + '</div>';
  }
  function streamHead(left, sub1, sub2) {
    return '<div class="sb-head"><span>\uD83D\uDC23 Team Leyla Quiz</span><span>' + left + '</span></div><div class="sb-sub"><span>' + sub1 + '</span><span>' + sub2 + '</span></div>';
  }

  /* Streamer Mode game selection: viewers see the themes inside the box, Leyla picks with the private form below/beside it */
  App.renderStreamLobby = function (app, s, cols, msg, startBtn, dl, want) {
    var ORD = window.THEME_ORDER, all = !s.themes.length;
    var chips = ORD.map(function (k) {
      var on = all || s.themes.indexOf(k) !== -1, T = THEMES[k];
      return '<div class="sb-theme' + (on ? ' on' : '') + '"><span>' + T.icon + '</span><span class="t">' + esc(T.label) + '</span></div>';
    }).join('');
    var flat = s.pointsMode === 'flat';
    var sum = '<div class="sb-sumrow"><span>' + (dl.length === 3 ? 'Mixed' : dl.map(cap).join(' + ')) + ' \u00B7 ' + esc(String(want || '')) + ' questions</span><b>' + (s.format === 'mc' ? 'Multiple choice' : 'Open answer') + '</b></div>';
    var box = sboxOpen('setup') + streamHead('Game selection', '🎮 Next game', all ? 'All themes' : s.themes.length + ' theme' + (s.themes.length === 1 ? '' : 's')) +
      '<div class="sb-body"><div class="sb-status">Pick a theme! 🎯</div><div class="sb-themes">' + chips + '</div><div class="sb-sum">' + sum + '</div></div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><button class="btn small" data-act="go-home">🏠 Home</button><span class="pill">🎮 Game selection</span><span class="grow"></span></div>' +
      '<div class="sc-start">' + msg + startBtn + '</div><div class="setup-grid sc-form">' + cols.replace(/<\/div>$/, '') + '</div></div>';
    streamLayout(app, box, ctl);
  };
  /* End of quiz: the final leaderboard appears inside the capture box */
  function renderStreamEnd(app, g) {
    var ranked = Core.rankPlayers(g.host.players), medal = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' };
    var top = ranked.filter(function (p) { return p.rank === 1 && p.score > 0; });
    var status = !ranked.length || !ranked[0].score ? 'Thanks for playing!' : top.length > 1 ? '\uD83E\uDD1D Tie for first: ' + esc(Core.joinNames(top.map(function (p) { return p.name; }))) : '\uD83C\uDFC6 ' + esc(top[0].name) + ' wins!';
    var box = sboxOpen('leader') + streamHead('Final results', '\uD83C\uDFC1 ' + g.total + ' questions', 'Quiz complete') +
      '<div class="sb-body"><div class="sb-status">' + status + '</div><div class="sb-board">' +
      (ranked.length ? ranked.slice(0, 5).map(function (p) { return '<div class="sb-row' + (p.rank === 1 && p.score > 0 ? ' first' : '') + '"><b>' + (medal[p.rank] || p.rank) + '</b><span class="n">' + esc(p.name) + '</span><span class="s">' + p.score + ' pts</span></div>'; }).join('') : '<div class="sb-row"><span class="n">No points awarded</span></div>') +
      '</div></div></div></div>';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">\uD83C\uDFC1 Quiz finished</span><span class="grow"></span></div>' +
      '<button class="btn primary big sc-again" data-act="again">\uD83D\uDD01 Play again \u2013 back to game selection</button>' + tieBanner(g) +
      '<div class="row sc-tools" style="margin-top:12px"><button class="btn" data-act="back-last">\u21A9 Back to last question</button><button class="btn" data-act="home">Change settings</button></div>' +
      '<div class="sc-lb">' + leaderboard() + '</div></div>';
    streamLayout(app, box, ctl);
  }
  /* Tiebreaker inside the box. Answers/winners appear only after Leyla taps the winner (or reveals). */
  function renderStreamTie(app, g, tb, Q, th, inner) {
    var names = tb.ids.map(function (id) { return esc(tbPlayer(g, id).name); }).join(' · '), r = tb.revealed && tb.kind === 'number' ? tb.result : null;
    var winner = tb.winner && tbPlayer(g, tb.winner), extra, qhtml;
    if (!tb.kind) { qhtml = 'Tiebreaker time! 🤝'; extra = '<div class="sb-hint"><b>Tied for first</b> ' + names + '</div>'; }
    else {
      qhtml = esc(Q.question);
      if (tb.kind === 'normal') extra = winner ? '<div class="sb-reveal"><b>✅ Answer</b> ' + esc(Q.answer) + '<span class="sb-win">🏆 ' + esc(winner.name) + ' wins!</span></div>' : '<div class="sb-hint"><b>First correct answer wins</b> ' + names + '</div>';
      else extra = r ? '<div class="sb-hint"><b>Answer</b> ' + esc(fmtAns(Q)) + '</div><div class="sb-board">' + r.rows.map(function (x) {
          var win = r.winners.indexOf(x.id) !== -1;
          return '<div class="sb-row' + (win ? ' first' : '') + '"><b>' + (win ? '👑' : '') + '</b><span class="n">' + esc(x.name) + '</span><span class="s">' + (x.diff === null ? '–' : esc(String(x.guess))) + '</span></div>'; }).join('') + '</div>' +
          '<div class="sb-status">' + (r.winners.length === 1 ? '🏆 ' + esc(tbPlayer(g, r.winners[0]).name) + ' wins!' : '🤝 Still tied!') + '</div>' : '<div class="sb-hint"><b>Closest number wins</b> ' + names + '</div>';
    }
    var box = sboxOpen(Q && tb.kind ? Q.theme : 'leader') + streamHead('Tiebreaker' + (tb.round > 1 ? ' ' + tb.round : ''), th && tb.kind ? th.icon + ' ' + esc(th.label) : '🏁 Final', '🤝 Tied: ' + tb.ids.length) +
      '<div class="sb-body"><div class="sb-qwrap"><div class="sb-q" id="sb-q">' + qhtml + '</div></div>' + extra + '</div></div></div>';
    var priv = tb.kind === 'number' && !r ? '<div class="sc-ans"><div class="help">🔒 Private answer – not shown on stream until you reveal</div><div class="ans">' + esc(fmtAns(Q)) + '</div></div>' : '';
    var ctl = '<div class="sctl" id="sctl"><div class="sc-top"><span class="pill">🤝 Tiebreaker' + (tb.round > 1 ? ' ' + tb.round : '') + '</span><span class="grow"></span></div>' + priv + '<div class="sc-tb">' + inner + '</div></div>';
    var keepVals = {}; [].forEach.call(document.querySelectorAll('.tb-in'), function (e) { keepVals[e.dataset.id] = e.value; });
    streamLayout(app, box, ctl);
    [].forEach.call(document.querySelectorAll('.tb-in'), function (e) { if (keepVals[e.dataset.id] && !e.value) e.value = keepVals[e.dataset.id]; });
    fitStream();
  }
  /* Shrinks the question (and the hint/options that scale with it) until everything fits inside the fixed box. */
  function fitStream() {
    var box = document.getElementById('sbox'), qw = document.querySelector('.sb-qwrap'), body = document.getElementById('sb-body');
    if (!box || !qw || !body) return;
    var fs = 9.4;
    for (; fs >= 2.6; fs -= 0.2) {
      box.style.setProperty('--qfs', fs.toFixed(1) + 'cqw');
      var q = document.getElementById('sb-q');
      if (qw.scrollHeight <= qw.clientHeight + 1 && q.scrollHeight <= qw.clientHeight + 1 && body.scrollHeight <= body.clientHeight + 1) break;
    }
  }
  App.fitStream = fitStream;
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Answers & hints only appear in the DOM after the user chooses to reveal them. */
  /* small round copy button */
  function copyDot(act, label) { return '<button class="copydot" data-act="' + act + '" aria-label="' + label + '" title="' + label + '">\uD83D\uDCCB</button>'; }
  function optionsHead() { return '<div class="optshead"><span class="help">Options</span>' + copyDot('copy-options', 'Copy options') + '</div>'; }
  function hintBlock(Q, cur, host) {
    if (!cur.hint) return '';
    return '<div class="hintbox">💡 <b>Hint:</b> ' + esc(Q.hint) + copyDot('copy-hint', 'Copy hint') + '</div>';
  }
  function answerBlock(Q) {
    return '<div class="answerbox revealed"><div class="help">Answer</div><div class="ans">' + esc(Q.answer) + '</div>' + (Q.explanation ? '<div class="help">' + esc(Q.explanation) + '</div>' : '') + '</div>';
  }

  function easierBtn(Q, cur) {
    if (cur.answered || (Q.difficulty !== 'hard' && Q.difficulty !== 'medium')) return '';
    return '<button class="btn" data-act="easier">\u2B07 Easier question</button>';
  }
  function hostBody(Q, cur, last) {
    var g = App.game;
    var opts = '';
    if (isMc(g, cur)) {
      opts = optionsHead() + '<div class="mc">' + cur.options.map(function (o, i) {
        var cls = cur.revealed && Core.normalizeText(o) === Core.normalizeText(Q.answer) ? ' class="right"' : '';
        return '<button' + cls + ' disabled>' + 'ABCD'[i] + '. ' + esc(o) + '</button>';
      }).join('') + '</div>';
    }
    var tools = '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="copy-q">📋 Copy question</button>' +
      '<button class="btn" data-act="refresh">🔄 Refresh</button>' + easierBtn(Q, cur) + mcBtn(g, Q, cur) +
      '<button class="btn" data-act="hint">💡 ' + (cur.hint ? 'Hint shown' : 'Hint (-1 pt)') + '</button>' +
      '</div>';
    var ans;
    if (!cur.revealed) ans = '<div class="answerbox"><div>🔒 <b>Answer hidden</b></div><button class="btn yellow big" style="margin-top:8px" data-act="reveal">👁 Reveal answer</button></div>';
    else ans = answerBlock(Q) + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-act="copy-a">📋 Copy answer</button></div>';
    var award = '<div class="row" style="margin-top:12px"><input type="text" id="award-name" placeholder="Winner\u2019s name (+' + points() + ' when you press Next)" autocomplete="off" autocapitalize="words" data-enter="award" class="grow"></div>' + awardedChips();
    var nextLabel = last ? 'Finish quiz 🏁' : 'Next question →';
    return opts + hintBlock(Q, cur) + tools + ans + award + '<div class="row" style="margin-top:12px;flex-wrap:nowrap">' + (g.index > 0 ? '<button class="btn big" style="width:auto;flex:0 0 auto" data-act="back">\u2190 Back</button>' : '') + '<button class="btn primary big grow" data-act="next">' + nextLabel + '</button></div>';
  }
  function awardedChips() {
    var g = App.game, ids = g.host.awards[String(g.index)] || [];
    if (!ids.length) return '';
    var chips = ids.map(function (id) { var p = g.host.players.filter(function (x) { return x.id === id; })[0]; return p ? '<button class="chip" data-act="unaward" data-id="' + id + '" aria-label="Take away points from ' + esc(p.name) + '">' + esc(p.name) + ' \u2715</button>' : ''; }).join('');
    return '<p class="help">\u2705 Scored this question (tap a name to take it back):</p><div class="seg">' + chips + '</div>';
  }

  function soloBody(Q, cur, last) {
    var g = App.game, html = '';
    html += hintBlock(Q, cur);
    if (!cur.answered) {
      if (isMc(g, cur)) {
        html += optionsHead() + '<div class="mc">' + cur.options.map(function (o, i) { return '<button data-act="pick" data-i="' + i + '">' + 'ABCD'[i] + '. ' + esc(o) + '</button>'; }).join('') + '</div>';
      } else {
        html += '<div class="row" style="margin-top:10px"><input type="text" id="guess" class="grow" placeholder="Type your answer" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(cur.guess) + '" data-input="guess" data-enter="submit"><button class="btn primary" data-act="submit">Submit</button></div>';
        if (cur.close) html += '<div class="notice" style="margin-top:8px">So close! Does your answer match? <div class="row" style="margin-top:6px"><button class="btn small" data-act="accept-close">Yes, count it</button><button class="btn small" data-act="reject-close">No</button></div></div>';
      }
      html += '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="copy-q">📋 Copy question</button><button class="btn" data-act="hint">💡 ' + (cur.hint ? 'Hint shown' : 'Hint (-1 pt)') + '</button><button class="btn" data-act="refresh">🔄 Refresh</button>' + easierBtn(Q, cur) + mcBtn(g, Q, cur) + '<button class="btn" data-act="giveup">Give up</button></div>';
    } else {
      if (isMc(g, cur)) {
        html = hintBlock(Q, cur) + optionsHead() + '<div class="mc">' + cur.options.map(function (o, i) {
          var right = Core.normalizeText(o) === Core.normalizeText(Q.answer), cls = right ? 'right' : (cur.pick === i ? 'wrong' : '');
          return '<button disabled class="' + cls + '">' + 'ABCD'[i] + '. ' + esc(o) + '</button>';
        }).join('') + '</div>';
      }
      html += '<div class="feedback ' + (cur.correct ? 'ok sparkle' : 'bad') + '">' + (cur.correct ? '✨ Correct! +' + cur.earned + ' pt' + (cur.earned === 1 ? '' : 's') : (cur.timeout ? '⏱ Time’s up' : '❌ Not quite')) + '</div>';
      if (!isMc(g, cur) || cur.correct === false) html += answerBlock(Q); else if (Q.explanation) html += '<div class="help">' + esc(Q.explanation) + '</div>';
      html += '<div class="help">Score: <b>' + g.solo.score + '</b></div><button class="btn primary big" style="margin-top:10px" data-act="next">' + (last ? 'See results 🏁' : 'Next question →') + '</button>';
    }
    return html;
  }

  /* ---------- timer ---------- */
  function startTick() {
    var g = App.game;
    function upd() {
      var el = document.getElementById('timer'); if (!el) { clearInterval(tick); return; }
      var left = Math.max(0, Math.ceil((g.timerEnd - Date.now()) / 1000));
      el.textContent = '⏱ ' + left + 's';
      if (left <= 0) { clearInterval(tick); if (!g.cur.answered) finishSolo(false, true); }
    }
    upd(); tick = setInterval(upd, 500);
  }

  /* ---------- solo actions ---------- */
  function finishSolo(correct, timeout) {
    var g = App.game, c = g.cur, Q = q();
    c.answered = true; c.correct = correct; c.timeout = !!timeout; c.close = false;
    c.earned = correct ? points() : 0;
    if (correct) { g.solo.score += c.earned; g.solo.correct++; }
    g.solo.log.push({ id: Q.id, correct: correct, earned: c.earned, hint: c.hint });
    App.markUsed(Q.id); App.save(); App.render();
  }
  App.inputs.guess = function (el) { App.game.cur.guess = el.value; };
  App.actions.submit = function () {
    var c = App.game.cur, inp = document.getElementById('guess'); if (inp) c.guess = inp.value;
    if (!c.guess.trim()) { App.toast('Type an answer first'); return; }
    var r = Core.checkAnswer(c.guess, q());
    if (r.correct) finishSolo(true);
    else if (r.close) { c.close = true; App.save(); App.render(); }
    else finishSolo(false);
  };
  App.actions['accept-close'] = function () { finishSolo(true); };
  App.actions['reject-close'] = function () { finishSolo(false); };
  App.actions.giveup = function () { finishSolo(false); };
  App.actions.pick = function (el) {
    var c = App.game.cur, i = parseInt(el.dataset.i, 10); c.pick = i;
    finishSolo(Core.normalizeText(c.options[i]) === Core.normalizeText(q().answer));
  };

  /* ---------- shared actions ---------- */
  App.actions.hint = function () {
    var g = App.game, c = g.cur; if (!c.hint) { c.hint = true; (g.hints = g.hints || {})[g.index] = 1; App.save(); }
    App.render();
  };
  App.actions.showmc = function () {
    var g = App.game, c = g.cur, Q = q();
    if (g.format === 'mc' || c.mc || c.answered) return;
    if (g.mode === 'host' && (g.host.awards[String(g.index)] || []).length) { App.toast('This question is already scored'); return; }
    c.mc = true; c.options = Core.mcOptions(Q); (g.mcs = g.mcs || {})[g.index] = 1;
    App.save(); App.render(); App.toast(g.flat ? 'Multiple choice shown' : 'Multiple choice shown - worth 1 point now');
  };
  App.actions.reveal = function () {
    var c = App.game.cur; c.revealed = true; App.markUsed(q().id); App.save(); App.render();
    var b = document.querySelector('.answerbox'); if (b) b.classList.add('sparkle');
  };
  App.actions['copy-q'] = function () { var g = App.game; App.copy(Core.questionCopy(g.index + 1, g.total, q().question, App.templates), 'question'); };
  App.actions['copy-a'] = function () { var g = App.game; if (!g.cur.revealed) return; App.copy(Core.answerCopy(g.index + 1, g.total, q().answer, App.templates), 'answer'); };
  App.actions['copy-hint'] = function () { var g = App.game; if (!g.cur.hint) return; App.copy(Core.hintCopy(g.index + 1, q().hint, App.templates), 'hint'); };
  App.actions['copy-options'] = function () {
    var o = App.game.cur.options; App.copy(Core.optionsCopy(App.game.index + 1, o), 'options');
  };

  App.actions.refresh = function () {
    var g = App.game, c = g.cur, Q = q();
    if (c.answered || (g.mode === 'host' && (g.host.awards[String(g.index)] || []).length)) { App.toast('This question is already scored'); return; }
    var rej = g.rejected.concat([Q.id]);
    var rep = Core.findReplacement(App.poolBank(g.setup), Q, { usedIds: App.used, rejectedIds: rej, quizIds: g.ids, themes: [] });
    if (!rep) { App.toast('No other ' + Q.difficulty + ' question available for these themes'); return; }
    g.rejected = rej; g.ids[g.index] = rep.id; g.cur = fresh(); setTimer();
    App.save(); App.render();
    var card = document.getElementById('qcard'); if (card) card.classList.add('refreshing');
  };
  /* "Easier question": swap for a question one difficulty level lower (hard -> medium -> easy). */
  App.actions.easier = function () {
    var g = App.game, c = g.cur, Q = q(), lower = { hard: 'medium', medium: 'easy' }[Q.difficulty];
    if (!lower) { App.toast('Already the easiest level'); return; }
    if (c.answered || (g.mode === 'host' && (g.host.awards[String(g.index)] || []).length)) { App.toast('This question is already scored'); return; }
    var rej = g.rejected.concat([Q.id]);
    var rep = Core.findReplacement(App.poolBank(g.setup), Q, { usedIds: App.used, rejectedIds: rej, quizIds: g.ids, themes: [], difficulty: lower });
    if (!rep) { App.toast('No ' + lower + ' question left for these themes'); return; }
    g.rejected = rej; g.ids[g.index] = rep.id; g.cur = fresh(); setTimer();
    App.save(); App.render(); App.toast('Swapped for ' + (lower === 'easy' ? 'an easy' : 'a medium') + ' question');
  };
  App.actions.flag = function () {
    var Q = q(); if (!window.confirm('Report this question as wrong or unclear? It will be hidden from your future quizzes.')) return;
    if (App.flagged.indexOf(Q.id) === -1) App.flagged.push(Q.id);
    App.save(); App.toast('Reported - thanks'); if (!App.game.cur.answered) App.actions.refresh();
  };
  App.actions.next = function () {
    var g = App.game;
    if (!g.cur.answered && g.mode === 'solo') { /* cannot skip without answering */ App.toast('Answer or give up first'); return; }
    if (g.mode === 'host') { /* Next question scores whoever's name is typed in */
      var inp = document.getElementById('award-name');
      if (inp && inp.value.trim()) {
        var r = Core.awardPoints(g.host, inp.value, g.index, points());
        if (r.ok) App.toast('+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : ''));
        else if (r.reason !== 'duplicate') { App.toast('Could not add that name'); return; }
      }
    }
    App.markUsed(q().id);
    if (g.index >= g.total - 1) { g.finished = true; App.view = 'results'; App.save(); App.render(); return; }
    g.index++; g.cur = fresh(); setTimer(); App.save(); App.resetScroll = true; App.render(); window.scrollTo(0, 0);
  };
  /* Host: go back a question to fix a wrongly typed name. Its scores stay; tap a scored name to take it back. */
  function showQuestion(i) {
    var g = App.game; g.index = i; g.cur = fresh(); g.cur.revealed = !g.stream; g.cur.hint = !!(g.hints && g.hints[i]); g.cur.mc = !!(g.mcs && g.mcs[i]);
    clearInterval(tick); App.resetScroll = true; App.save(); App.render();
  }
  App.actions.back = function () {
    var g = App.game; if (g.mode !== 'host' || g.index < 1) return;
    showQuestion(g.index - 1);
  };
  App.actions.unaward = function (el) {
    var g = App.game;
    if (Core.removeAward(g.host, el.dataset.id, g.index)) { App.save(); App.render(); App.toast('Points taken back - type the right name'); }
  };
  App.actions['back-last'] = function () {
    var g = App.game; if (!g || g.mode !== 'host') return;
    App.unrecordGame(g); g.finished = false; App.view = 'play'; showQuestion(g.total - 1);
  };
  App.actions.quit = function () {
    if (!window.confirm('Quit this quiz? Your progress will be discarded (played questions stay marked as played).')) return;
    var wasStream = !!(App.game && App.game.stream);
    clearInterval(tick); App.game = null; App.lbOpen = false; App.view = wasStream ? 'setup' : 'home'; if (wasStream) App.setup.mode = 'stream'; App.save(); App.render();
  };

  /* ---------- host: scoring & leaderboard ---------- */
  App.actions.award = function () {
    var g = App.game, inp = document.getElementById('award-name'), name = inp ? inp.value : '';
    if (g.stream && !name.trim()) { g.cur.revealed = true; App.markUsed(q().id); App.save(); App.render(); App.toast('Answer shown on stream'); return; }
    var r = Core.awardPoints(g.host, name, g.index, points());
    if (!r.ok) { if (g.stream && r.reason === 'duplicate') { g.cur.revealed = true; App.save(); App.render(); } App.toast(r.reason === 'duplicate' ? r.player.name + ' already scored this question' : 'Type a name first'); return; }
    if (g.stream) { g.cur.revealed = true; App.markUsed(q().id); }
    App.save(); App.render();
    App.toast('+' + r.points + ' ' + r.player.name + (r.created ? ' (new player)' : ''));
  };
  function leaderboard() {
    var g = App.game, ranked = Core.rankPlayers(g.host.players);
    var rows = ranked.length ? ranked.map(function (p) {
      return '<div class="lb-item"><span class="lb-rank">' + p.rank + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + '</span>' +
        '<button class="mini" data-act="adj" data-id="' + p.id + '" data-d="1" aria-label="Add a point">+</button><button class="mini" data-act="adj" data-id="' + p.id + '" data-d="-1" aria-label="Remove a point">−</button>' +
        '<button class="mini" data-act="rename" data-id="' + p.id + '" aria-label="Rename">✏️</button><button class="mini" data-act="remove" data-id="' + p.id + '" aria-label="Remove player">✕</button></div>';
    }).join('') : '<p class="help">No players yet. Type a name when someone answers correctly.</p>';
    return '<h3>🏆 Live leaderboard</h3>' + rows +
      '<div class="row" style="margin-top:10px"><button class="btn small" data-act="undo">↩ Undo</button><button class="btn small primary" data-act="copy-lb">📋 Copy top three</button></div>';
  }
  App.actions.adj = function (el) { Core.adjustPoints(App.game.host, el.dataset.id, parseInt(el.dataset.d, 10)); App.save(); App.render(); };
  App.actions.undo = function () { var h = Core.undoLast(App.game.host); App.toast(h ? 'Undone' : 'Nothing to undo'); App.save(); App.render(); };
  App.actions.rename = function (el) {
    var n = window.prompt('New name:'); if (n == null) return;
    var r = Core.renamePlayer(App.game.host, el.dataset.id, n); if (!r.ok) App.toast(r.reason === 'exists' ? 'That name is already used' : 'Name not changed');
    App.save(); App.render();
  };
  App.actions.remove = function (el) { if (window.confirm('Remove this player?')) { Core.removePlayer(App.game.host, el.dataset.id); App.save(); App.render(); } };
  App.actions['copy-lb'] = function () { App.copy(Core.leaderboardCopy(App.game.host.players, App.templates), 'leaderboard'); };
  App.actions['toggle-lb'] = function () { var el = document.getElementById('lb'); if (!el) return; App.lbOpen = !el.classList.contains('open'); el.classList.toggle('open', App.lbOpen); };

  /* ---------- results ---------- */
  function confetti() {
    if (App.settings.calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var em = ['🎉', '✨', '🐣', '🌟', '🏆'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('span'); s.className = 'confetti'; s.textContent = em[i % em.length];
      s.style.left = (Math.random() * 100) + '%'; s.style.animationDelay = (Math.random() * 1.2) + 's';
      document.body.appendChild(s); setTimeout(function (n) { return function () { n.remove(); }; }(s), 4500);
    }
  }
  /* ---------- tiebreaker: closest number wins ---------- */
  function topTied(g) {
    var r = Core.rankPlayers(g.host.players).filter(function (p) { return p.rank === 1; });
    return r.length > 1 && r[0].score > 0 ? r : [];
  }
  function tieBanner(g) {
    var t = topTied(g); if (!t.length) return '';
    return '<div class="tie-banner"><b>\uD83E\uDD1D It\u2019s a tie for first!</b><span>' + esc(Core.joinNames(t.map(function (p) { return p.name; }))) + ' on ' + t[0].score + ' pts</span><button class="btn yellow" data-act="tb-start">\u26A1 Play tiebreaker</button></div>';
  }
  var tbUsed = App.store.get('tbused', []);
  /* Two kinds of tiebreaker, chosen by the host: 'normal' = a random normal question from any theme (first correct answer wins),
     'number' = a closest-number question (closest wins). */
  function tbPick(g) {
    var tb = g.tb;
    if (tb.kind === 'number') {
      var qn = Core.pickTiebreaker(window.TIEBREAKERS || [], tbUsed, (g.setup && g.setup.themes) || []);
      if (!qn) { App.toast('No tiebreaker questions loaded'); return false; }
      tbUsed.push(qn.id); App.store.set('tbused', tbUsed.slice(-400)); tb.qid = qn.id;
    } else {
      var used = App.used || [], bank = window.QUESTION_BANK || [];
      var ok = function (x) { return tbUsed.indexOf(x.id) === -1 && used.indexOf(x.id) === -1 && x.id !== tb.qid; };
      var pool = bank.filter(function (x) { return x.difficulty === 'medium' && ok(x); });
      if (!pool.length) pool = bank.filter(ok);
      if (!pool.length) { App.toast('No tiebreaker questions left'); return false; }
      var qx = pool[Math.floor(Math.random() * pool.length)];
      tbUsed.push(qx.id); App.store.set('tbused', tbUsed.slice(-400)); App.markUsed(qx.id); tb.qid = qx.id;
    }
    tb.revealed = false; tb.result = null; tb.guesses = {}; tb.winner = null;
    return true;
  }
  function fmtAns(Q) { return Q.unit === 'year' ? String(Q.answer) : Q.answer.toLocaleString('en-GB') + (Q.unit ? ' ' + Q.unit : ''); }
  function tbQ(g) {
    if (!g.tb || !g.tb.kind || !g.tb.qid) return null;
    return g.tb.kind === 'number' ? (window.TIEBREAKERS || []).filter(function (x) { return x.id === g.tb.qid; })[0] : BY_ID[g.tb.qid];
  }
  function tbAnswer(g, Q) { return g.tb.kind === 'number' ? fmtAns(Q) : Q.answer; }
  function tbPlayer(g, id) { return g.host.players.filter(function (x) { return x.id === id; })[0]; }
  App.actions['tb-start'] = function () {
    var g = App.game, tied = topTied(g); if (!tied.length) return;
    g.tb = { ids: tied.map(function (p) { return p.id; }), round: 1, kind: null };
    [].forEach.call(document.querySelectorAll('.confetti'), function (n) { n.remove(); });
    App.unrecordGame(g); App.view = 'tiebreak'; App.resetScroll = true; App.save(); App.render();
  };
  /* choose the kind of tiebreaker question */
  App.actions['tb-kind'] = function (el) {
    var g = App.game, tb = g.tb; if (!tb) return;
    tb.kind = el.dataset.v === 'number' ? 'number' : 'normal'; tb.qid = null;
    if (!tbPick(g)) { tb.kind = null; return; }
    App.save(); App.render();
  };
  App.actions['tb-change'] = function () { var g = App.game; if (g.tb && !g.tb.revealed) { g.tb.kind = null; g.tb.qid = null; App.save(); App.render(); } };
  App.actions['tb-new'] = function () { var g = App.game; if (g.tb && g.tb.kind && !g.tb.revealed && tbPick(g)) { App.save(); App.render(); } };
  /* normal question: tap the player who answered correctly first */
  App.actions['tb-win'] = function (el) {
    var g = App.game, tb = g.tb, p = tb && tb.kind === 'normal' && !tb.revealed && tbPlayer(g, el.dataset.id); if (!p) return;
    p.tb = (p.tb || 0) + 1; tb.winner = p.id; tb.revealed = true; App.save(); App.render();
  };
  App.actions['tb-undo'] = function () {
    var g = App.game, tb = g.tb; if (!tb || !tb.revealed || tb.kind !== 'normal') return;
    var p = tbPlayer(g, tb.winner); if (p && p.tb) p.tb--;
    tb.winner = null; tb.revealed = false; App.save(); App.render();
  };
  /* number question: closest wins */
  App.actions['tb-reveal'] = function () {
    var g = App.game, tb = g.tb, Q = tbQ(g); if (!tb || tb.revealed || tb.kind !== 'number') return;
    var entries = tb.ids.map(function (id) {
      var p = tbPlayer(g, id), inp = document.querySelector('.tb-in[data-id="' + id + '"]');
      tb.guesses[id] = inp ? inp.value : (tb.guesses[id] || '');
      return { id: id, name: p.name, guess: tb.guesses[id] };
    });
    var res = Core.tiebreakRound(entries, Q.answer);
    if (res.noGuesses) { App.toast('Type at least one number first'); return; }
    tb.result = res; tb.revealed = true;
    if (res.winners.length < tb.ids.length) res.winners.forEach(function (id) { var p = tbPlayer(g, id); p.tb = (p.tb || 0) + 1; });
    App.save(); App.render();
  };
  App.actions['tb-again'] = function () {
    var g = App.game, tb = g.tb; if (!tb || !tb.revealed || tb.kind !== 'number') return;
    tb.ids = tb.result.winners.length ? tb.result.winners.slice() : tb.ids; tb.round++;
    if (tbPick(g)) { App.save(); App.render(); }
  };
  App.actions['tb-finish'] = function () { var g = App.game; g.tb = null; App.view = 'results'; App.resetScroll = true; App.save(); App.render(); };
  App.actions['tb-copy-q'] = function () {
    var g = App.game, Q = tbQ(g);
    App.copy(Core.fitComment('Tiebreaker: ' + (g.tb.kind === 'number' ? 'closest number wins! ' : '') + Q.question), 'tiebreaker');
  };
  App.actions['tb-copy-r'] = function () {
    var g = App.game, tb = g.tb, Q = tbQ(g), txt;
    if (tb.kind === 'normal') { var w1 = tb.winner && tbPlayer(g, tb.winner); if (!w1) return; txt = 'CORRECT! The answer is ' + Q.answer + '. ' + w1.name + ' wins the tiebreaker!'; }
    else {
      var r = tb.result, ans = fmtAns(Q), w = r.winners.map(function (id) { return r.rows.filter(function (x) { return x.id === id; })[0]; });
      txt = r.winners.length === 1
        ? 'The answer is ' + ans + '! Closest was ' + w[0].name + ' with ' + w[0].guess + '. ' + w[0].name + ' wins the tiebreaker!'
        : 'The answer is ' + ans + '! ' + Core.joinNames(w.map(function (x) { return x.name; })) + ' were equally close. Still a tie!';
    }
    App.copy(Core.fitComment(txt), 'tiebreaker result');
  };
  App.renderTiebreak = function (app) {
    var g = App.game, tb = g.tb;
    if (!tb) { App.view = 'results'; return App.render(); }
    var Q = tbQ(g), th = Q ? (window.THEMES[Q.theme] || window.THEMES.general) : window.THEMES.general;
    App.setBackdrop(Q ? Q.theme : 'general', 0);
    var names = tb.ids.map(function (id) { return esc(tbPlayer(g, id).name); });
    var inner, winner = tb.winner && tbPlayer(g, tb.winner);
    if (!tb.kind) {
      inner = '<p class="help">' + names.join(' · ') + ' are tied. Pick the tiebreaker question type:</p>' +
        '<div class="tb-pick"><button class="btn primary big" data-act="tb-kind" data-v="normal">🧠 Normal question<br><small>First correct answer wins</small></button>' +
        '<button class="btn yellow big" data-act="tb-kind" data-v="number">🔢 Number question<br><small>Closest number wins</small></button></div>' +
        '<div class="row" style="margin-top:.6em"><button class="btn" data-act="tb-finish">Keep joint win</button></div>';
    } else if (tb.kind === 'normal' && !tb.revealed) {
      inner = '<div class="answerbox"><span class="help" style="margin:0">Answer (private)</span><div class="ans">' + esc(Q.answer) + '</div></div>' +
        '<p class="help">First correct answer wins. Tap who got it first:</p>' +
        '<div class="tb-pick">' + tb.ids.map(function (id) { return '<button class="btn primary big" data-act="tb-win" data-id="' + id + '">✅ ' + esc(tbPlayer(g, id).name) + '</button>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:.5em"><button class="btn" data-act="tb-copy-q">📋 Copy question</button><button class="btn" data-act="tb-new">🔄 Nobody got it – new question</button><button class="btn" data-act="tb-change">Change type</button></div>';
    } else if (tb.kind === 'normal') {
      inner = '<div class="answerbox"><span class="help" style="margin:0">Answer</span><div class="ans">' + esc(Q.answer) + '</div></div>' +
        '<p class="tie-win">🏆 ' + esc(winner.name) + ' wins the tiebreaker!</p>' +
        '<div class="row" style="margin-top:.6em"><button class="btn" data-act="tb-copy-r">📋 Copy result</button><button class="btn" data-act="tb-undo">↩ Change winner</button><button class="btn primary grow" data-act="tb-finish">See final leaderboard →</button></div>';
    } else if (!tb.revealed) {
      inner = '<p class="help">Everyone types a number. Closest wins.</p>' +
        tb.ids.map(function (id) { return '<div class="tb-row"><span class="lb-name">' + esc(tbPlayer(g, id).name) + '</span><input class="tb-in" data-id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="Number" value="' + esc(tb.guesses[id] || '') + '"></div>'; }).join('') +
        '<div class="row" style="margin-top:.7em"><button class="btn primary big grow" data-act="tb-reveal">🔍 Reveal answer</button></div>' +
        '<div class="row" style="margin-top:.4em"><button class="btn" data-act="tb-copy-q">📋 Copy question</button><button class="btn" data-act="tb-new">🔄 Different question</button><button class="btn" data-act="tb-change">Change type</button></div>';
    } else {
      var r = tb.result, ans = fmtAns(Q);
      inner = '<div class="answerbox"><span class="help" style="margin:0">Answer</span><div class="ans">' + esc(ans) + '</div></div>' +
        r.rows.map(function (x) {
          var win = r.winners.indexOf(x.id) !== -1;
          return '<div class="tb-row' + (win ? ' win' : '') + '"><span class="lb-name">' + (win ? '👑 ' : '') + esc(x.name) + '</span><span>' + (x.diff === null ? 'no number' : esc(String(x.guess)) + ' (off by ' + x.diff.toLocaleString('en-GB') + ')') + '</span></div>';
        }).join('') +
        (r.winners.length === 1 ? '<p class="tie-win">🏆 ' + esc(tbPlayer(g, r.winners[0]).name) + ' wins the tiebreaker!</p>' : '<p class="tie-win">🤝 Still tied!</p>') +
        '<div class="row" style="margin-top:.6em"><button class="btn" data-act="tb-copy-r">📋 Copy result</button>' +
        (r.winners.length === 1 ? '<button class="btn primary grow" data-act="tb-finish">See final leaderboard →</button>' : '<button class="btn primary grow" data-act="tb-again">⚡ Another tiebreaker</button><button class="btn" data-act="tb-finish">Keep joint win</button>') + '</div>';
    }
    if (g.stream) { renderStreamTie(app, g, tb, Q, th, inner); return; }
    app.innerHTML = '<div class="v-play">' + App.hud() + '<div class="zone"><div class="qwrap"><div class="qcard"><div class="qhead"><span class="pill">🤝 Tiebreaker' + (tb.round > 1 ? ' ' + tb.round : '') + '</span>' + (Q ? '<span class="pill">' + th.icon + ' ' + esc(th.label) + '</span>' : '') + '</div>' +
      (Q ? '<h2 class="qtext" id="qtext">' + esc(Q.question) + '</h2>' : '<h2 class="qtext" id="qtext">It’s a tie for first!</h2>') + inner + '</div></div></div></div>';
  };
  App.renderResults = function (app) {
    var g = App.game; clearInterval(tick);
    App.setBackdrop((BY_ID[g.ids[g.total - 1]] || {}).theme || 'general', g.total - 1);
    App.recordGame(g);
    if (g.stream) { renderStreamEnd(app, g); return; }
    var body;
    if (g.mode === 'host') {
      var ranked = Core.rankPlayers(g.host.players), medal = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' };
      body = '<h2>\uD83C\uDFC6 Final leaderboard</h2>' + (ranked.length ? ranked.slice(0, 10).map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + (medal[p.rank] || p.rank) + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + ' pts</span></div>';
      }).join('') : '<p>No points were awarded.</p>') +
        tieBanner(g) +
        '<div class="row" style="margin-top:.8em;justify-content:center"><button class="btn primary" data-act="copy-lb">\uD83D\uDCCB Copy top three</button><button class="btn yellow" data-act="copy-winner">\uD83D\uDCCB Copy winner</button></div>';
    } else {
      var max = g.solo.log.reduce(function (a, l) { return a + (g.flat || Core.BASE_POINTS[BY_ID[l.id].difficulty]); }, 0);
      body = '<h2>\uD83C\uDF89 Quiz complete!</h2><div class="big-score">' + g.solo.score + ' pt' + (g.solo.score === 1 ? '' : 's') + '</div><p>' + g.solo.correct + ' of ' + g.total + ' correct \u00B7 best possible ' + max + '</p>' +
        '<div style="max-height:30vh;overflow:auto;text-align:left">' + g.solo.log.map(function (l) { var Q = BY_ID[l.id]; return '<div class="lb-item"><span>' + (l.correct ? '\u2705' : '\u274C') + '</span><span class="lb-name">' + esc(Q.question) + '</span><span class="lb-score">' + l.earned + '</span></div>'; }).join('') + '</div>';
    }
    app.innerHTML = '<div class="v-results">' + App.hud() + '<div class="pop-back"><div class="pop">' + window.CHICK_SVG.replace('class="chick-svg"', 'class="chick-svg" style="width:70px;height:70px"') + body +
      '<div class="row" style="margin-top:.8em;justify-content:center">' + (g.mode === 'host' ? '<button class="btn" data-act="back-last">\u21A9 Back to last question</button>' : '') + '<button class="btn" data-act="again">Play again</button><button class="btn" data-act="home">New setup</button><button class="btn" data-act="go-leader">\uD83C\uDFC6 Leaderboards</button></div></div></div></div>';
    confetti();
  };
  App.actions['copy-winner'] = function () { App.copy(Core.winnerCopy(App.game.host.players, App.templates), 'winner'); };
  function startFresh() { App.game = null; App.lbOpen = false; App.view = 'setup'; App.save(); }
  App.actions.home = function () { startFresh(); App.render(); };
  App.actions.again = function () {
    var s = App.game ? App.game.setup : App.setup; App.setup = Object.assign({}, App.setup, s); var stream = !!(App.game && App.game.stream); startFresh();
    if (stream) { App.setup.mode = 'stream'; App.save(); App.resetScroll = true; App.render(); } else App.actions.start();
  };
})();
