/* Team Leyla Quiz Hub - gameplay: start, question screen (solo + host), refresh, scoring, results. */
(function () {
  'use strict';
  var App = window.App, Core = App.Core, THEMES = App.THEMES, esc = App.esc, BY_ID = App.BY_ID;
  var tick = null;

  function q() { return BY_ID[App.game.ids[App.game.index]]; }
  function fresh() { return { revealed: false, hint: false, answered: false, correct: null, pick: null, guess: '', close: false, options: null }; }
  function points() { var c = App.game.cur; return Core.availablePoints(q().difficulty, c.hint); }

  /* ---------- start ---------- */
  App.actions.start = function () {
    var s = App.setup, pool = App.poolBank(s);
    var want = s.count === 'custom' ? Math.max(1, parseInt(s.custom, 10) || 0) : s.count;
    if (!want) { App.toast('Enter how many questions'); return; }
    var res = Core.buildQuiz(pool, { themes: [], difficulty: s.difficulty }, Math.min(want, 500), App.used);
    if (!res.questions.length) { App.toast('No unused questions left for these settings'); return; }
    App.game = {
      mode: s.mode, format: s.format, difficulty: s.difficulty, timer: s.mode === 'solo' ? s.timer : 0,
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
    var isHost = g.mode === 'host', pts = points(), last = g.index === g.total - 1;
    if (g.format === 'mc' && !cur.options) cur.options = Core.mcOptions(Q);
    var head = '<div class="qhead"><span class="pill">' + (last ? 'Final question' : 'Question ' + (g.index + 1)) + ' of ' + g.total + '</span>' +
      '<span class="pill">' + th.icon + ' ' + esc(th.label) + '</span><span class="pill pts">' + esc(cap(Q.difficulty)) + ' \u00B7 ' + pts + ' pt' + (pts === 1 ? '' : 's') + '</span></div>';
    var body = isHost ? hostBody(Q, cur, last) : soloBody(Q, cur, last);
    var main = '<section class="zone"><div class="qwrap">' + head + '<div class="qcard" id="qcard">' +
      (g.timer && !cur.answered ? '<div class="timer" id="timer"></div>' : '') +
      '<div class="qtext" id="qtext">' + esc(Q.question) + '</div>' + body + '</div>' +
      '<div class="minor"><button class="btn small" data-act="flag">\uD83D\uDEA9 Report wrong</button><button class="btn small" data-act="quit">Quit quiz</button></div></div></section>';
    var extra = '<button class="icon-btn" data-act="fullscreen" aria-label="Fullscreen host mode">\u26F6</button>';
    var drawer = isHost ? '<aside class="drawer' + (App.lbOpen ? ' open' : '') + '" id="lb" aria-label="Leaderboard"><button class="drawer-tab" data-act="toggle-lb" aria-label="Show or hide leaderboard"><b>\uD83C\uDFC6</b><small>Leaders</small><span>\u25C0</span></button><div class="drawer-in">' + leaderboard() + '</div></aside>' : '';
    app.innerHTML = '<div class="v-play">' + App.hud(extra) + main + drawer + '</div>';
    if (g.timer && !cur.answered) startTick();
  };
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Answers & hints only appear in the DOM after the user chooses to reveal them. */
  function hintBlock(Q, cur, host) {
    if (!cur.hint) return '';
    return '<div class="hintbox">💡 <b>Hint:</b> ' + esc(Q.hint) + '</div>';
  }
  function answerBlock(Q) {
    return '<div class="answerbox revealed"><div class="help">Answer</div><div class="ans">' + esc(Q.answer) + '</div>' + (Q.explanation ? '<div class="help">' + esc(Q.explanation) + '</div>' : '') + '</div>';
  }

  function hostBody(Q, cur, last) {
    var g = App.game;
    var opts = '';
    if (g.format === 'mc') {
      opts = '<div class="mc">' + cur.options.map(function (o, i) {
        var cls = cur.revealed && Core.normalizeText(o) === Core.normalizeText(Q.answer) ? ' class="right"' : '';
        return '<button' + cls + ' disabled>' + 'ABCD'[i] + '. ' + esc(o) + '</button>';
      }).join('') + '</div><button class="btn small" style="margin-top:8px" data-act="copy-options">Copy options</button>';
    }
    var tools = '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="copy-q">📋 Copy question</button>' +
      '<button class="btn" data-act="refresh">🔄 Refresh</button>' +
      '<button class="btn" data-act="hint">💡 ' + (cur.hint ? 'Hint shown' : 'Hint (-1 pt)') + '</button>' +
      (cur.hint ? '<button class="btn" data-act="copy-hint">📋 Copy hint</button>' : '') + '</div>';
    var ans;
    if (!cur.revealed) ans = '<div class="answerbox"><div>🔒 <b>Answer hidden</b></div><button class="btn yellow big" style="margin-top:8px" data-act="reveal">👁 Reveal answer</button></div>';
    else ans = answerBlock(Q) + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-act="copy-a">📋 Copy answer</button></div>';
    var award = '<div class="row" style="margin-top:12px"><input type="text" id="award-name" placeholder="Winner\u2019s name (+' + points() + ' when you press Next)" autocomplete="off" autocapitalize="words" data-enter="award" class="grow"></div>' + awardedChips();
    var nextLabel = last ? 'Finish quiz 🏁' : 'Next question →';
    return opts + hintBlock(Q, cur) + tools + ans + award + '<button class="btn primary big" style="margin-top:12px" data-act="next">' + nextLabel + '</button>';
  }
  function awardedChips() {
    var g = App.game, ids = g.host.awards[String(g.index)] || [];
    if (!ids.length) return '';
    var names = ids.map(function (id) { var p = g.host.players.filter(function (x) { return x.id === id; })[0]; return p ? esc(p.name) : ''; }).filter(Boolean);
    return '<p class="help">✅ Scored this question: ' + names.join(', ') + '</p>';
  }

  function soloBody(Q, cur, last) {
    var g = App.game, html = '';
    html += hintBlock(Q, cur);
    if (!cur.answered) {
      if (g.format === 'mc') {
        html += '<div class="mc">' + cur.options.map(function (o, i) { return '<button data-act="pick" data-i="' + i + '">' + 'ABCD'[i] + '. ' + esc(o) + '</button>'; }).join('') + '</div>';
      } else {
        html += '<div class="row" style="margin-top:10px"><input type="text" id="guess" class="grow" placeholder="Type your answer" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(cur.guess) + '" data-input="guess" data-enter="submit"><button class="btn primary" data-act="submit">Submit</button></div>';
        if (cur.close) html += '<div class="notice" style="margin-top:8px">So close! Does your answer match? <div class="row" style="margin-top:6px"><button class="btn small" data-act="accept-close">Yes, count it</button><button class="btn small" data-act="reject-close">No</button></div></div>';
      }
      html += '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="hint">💡 ' + (cur.hint ? 'Hint shown' : 'Hint (-1 pt)') + '</button><button class="btn" data-act="refresh">🔄 Refresh</button><button class="btn" data-act="giveup">Give up</button></div>';
    } else {
      if (g.format === 'mc') {
        html = hintBlock(Q, cur) + '<div class="mc">' + cur.options.map(function (o, i) {
          var right = Core.normalizeText(o) === Core.normalizeText(Q.answer), cls = right ? 'right' : (cur.pick === i ? 'wrong' : '');
          return '<button disabled class="' + cls + '">' + 'ABCD'[i] + '. ' + esc(o) + '</button>';
        }).join('') + '</div>';
      }
      html += '<div class="feedback ' + (cur.correct ? 'ok sparkle' : 'bad') + '">' + (cur.correct ? '✨ Correct! +' + cur.earned + ' pt' + (cur.earned === 1 ? '' : 's') : (cur.timeout ? '⏱ Time’s up' : '❌ Not quite')) + '</div>';
      if (g.format !== 'mc' || cur.correct === false) html += answerBlock(Q); else if (Q.explanation) html += '<div class="help">' + esc(Q.explanation) + '</div>';
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
    var c = App.game.cur; if (!c.hint) { c.hint = true; App.save(); }
    App.render();
  };
  App.actions.reveal = function () {
    var c = App.game.cur; c.revealed = true; App.markUsed(q().id); App.save(); App.render();
    var b = document.querySelector('.answerbox'); if (b) b.classList.add('sparkle');
  };
  App.actions['copy-q'] = function () { var g = App.game; App.copy(Core.questionCopy(g.index + 1, g.total, q().question, App.templates), 'question'); };
  App.actions['copy-a'] = function () { var g = App.game; if (!g.cur.revealed) return; App.copy(Core.answerCopy(g.index + 1, g.total, q().answer, App.templates), 'answer'); };
  App.actions['copy-hint'] = function () { var g = App.game; if (!g.cur.hint) return; App.copy(Core.hintCopy(g.index + 1, q().hint, App.templates), 'hint'); };
  App.actions['copy-options'] = function () {
    var o = App.game.cur.options; App.copy('Options: ' + o.map(function (x, i) { return 'ABCD'[i] + ', ' + x; }).join('. ') + '.', 'options');
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
  App.actions.quit = function () {
    if (!window.confirm('Quit this quiz? Your progress will be discarded (played questions stay marked as played).')) return;
    clearInterval(tick); App.game = null; App.lbOpen = false; App.view = 'home'; App.save(); App.render();
  };

  /* ---------- host: scoring & leaderboard ---------- */
  App.actions.award = function () {
    var g = App.game, inp = document.getElementById('award-name'), name = inp ? inp.value : '';
    var r = Core.awardPoints(g.host, name, g.index, points());
    if (!r.ok) { App.toast(r.reason === 'duplicate' ? r.player.name + ' already scored this question' : 'Type a name first'); return; }
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
  App.actions.fullscreen = function () {
    document.body.classList.toggle('fullscreen-host');
    var d = document, de = d.documentElement;
    try { if (!d.fullscreenElement && de.requestFullscreen) de.requestFullscreen(); else if (d.fullscreenElement && d.exitFullscreen) d.exitFullscreen(); } catch (e) {}
  };

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
  App.renderResults = function (app) {
    var g = App.game; clearInterval(tick);
    App.setBackdrop((BY_ID[g.ids[g.total - 1]] || {}).theme || 'general', g.total - 1);
    App.recordGame(g);
    var body;
    if (g.mode === 'host') {
      var ranked = Core.rankPlayers(g.host.players), medal = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' };
      body = '<h2>\uD83C\uDFC6 Final leaderboard</h2>' + (ranked.length ? ranked.slice(0, 10).map(function (p) {
        return '<div class="lb-item"><span class="lb-rank">' + (medal[p.rank] || p.rank) + '</span><span class="lb-name">' + esc(p.name) + '</span><span class="lb-score">' + p.score + ' pts</span></div>';
      }).join('') : '<p>No points were awarded.</p>') +
        '<div class="row" style="margin-top:.8em;justify-content:center"><button class="btn primary" data-act="copy-lb">\uD83D\uDCCB Copy top three</button><button class="btn yellow" data-act="copy-winner">\uD83D\uDCCB Copy winner</button></div>';
    } else {
      var max = g.solo.log.reduce(function (a, l) { return a + Core.BASE_POINTS[BY_ID[l.id].difficulty]; }, 0);
      body = '<h2>\uD83C\uDF89 Quiz complete!</h2><div class="big-score">' + g.solo.score + ' pt' + (g.solo.score === 1 ? '' : 's') + '</div><p>' + g.solo.correct + ' of ' + g.total + ' correct \u00B7 best possible ' + max + '</p>' +
        '<div style="max-height:30vh;overflow:auto;text-align:left">' + g.solo.log.map(function (l) { var Q = BY_ID[l.id]; return '<div class="lb-item"><span>' + (l.correct ? '\u2705' : '\u274C') + '</span><span class="lb-name">' + esc(Q.question) + '</span><span class="lb-score">' + l.earned + '</span></div>'; }).join('') + '</div>';
    }
    app.innerHTML = '<div class="v-results">' + App.hud() + '<div class="pop-back"><div class="pop">' + window.CHICK_SVG.replace('class="chick-svg"', 'class="chick-svg" style="width:70px;height:70px"') + body +
      '<div class="row" style="margin-top:.8em;justify-content:center"><button class="btn" data-act="again">Play again</button><button class="btn" data-act="home">New setup</button><button class="btn" data-act="go-leader">\uD83C\uDFC6 Leaderboards</button></div></div></div></div>';
    confetti();
  };
  App.actions['copy-winner'] = function () { App.copy(Core.winnerCopy(App.game.host.players, App.templates), 'winner'); };
  function startFresh() { App.game = null; App.lbOpen = false; App.view = 'setup'; App.save(); }
  App.actions.home = function () { startFresh(); App.render(); };
  App.actions.again = function () { var s = App.game ? App.game.setup : App.setup; App.setup = Object.assign({}, App.setup, s); startFresh(); App.actions.start(); };
})();
