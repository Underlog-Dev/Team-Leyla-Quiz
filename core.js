/* Team Leyla Quiz Hub - core logic (pure functions, no DOM). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_POINTS = { easy: 1, medium: 2, hard: 3 };
  var DIFFICULTIES = ['easy', 'medium', 'hard'];

  /* ---------- points & hints ---------- */
  function availablePoints(difficulty, hintUsed) {
    var base = BASE_POINTS[difficulty] || 1;
    return hintUsed ? Math.max(1, base - 1) : base;
  }

  /* ---------- ordinals & copy text ---------- */
  function ordinal(n) {
    var j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return n + 'st';
    if (j === 2 && k !== 12) return n + 'nd';
    if (j === 3 && k !== 13) return n + 'rd';
    return n + 'th';
  }

  function cleanForTTS(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim();
  }

  var DEFAULT_TEMPLATES = {
    question: 'Question {n}: {question}',
    finalQuestion: 'Final question: {question}',
    answer: 'CORRECT! The answer is {answer}, onto question {next}!',
    finalAnswer: 'CORRECT! The answer is {answer}! That’s the end of the quiz!',
    hint: 'Hint for question {n}: {hint}',
    leadIntro: 'In the lead!',
    winnerIntro: 'The winner is',
    jointWinnerIntro: 'We have joint winners'
  };

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : ''; });
  }

  function questionCopy(n, total, text, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    var isFinal = n === total;
    return cleanForTTS(fill(isFinal ? t.finalQuestion : t.question, { n: n, question: cleanForTTS(text) }));
  }

  function answerCopy(n, total, answer, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    var isFinal = n === total;
    return cleanForTTS(fill(isFinal ? t.finalAnswer : t.answer, { answer: cleanForTTS(answer), next: n + 1 }));
  }

  function hintCopy(n, hint, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    return cleanForTTS(fill(t.hint, { n: n, hint: cleanForTTS(hint) }));
  }

  /* ---------- ranking (standard competition ranking: 1,1,3) ---------- */
  function rankPlayers(players) {
    var sorted = players.slice().sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.tb || 0) !== (a.tb || 0)) return (b.tb || 0) - (a.tb || 0);
      return String(a.name).localeCompare(String(b.name));
    });
    var out = [], prevScore = null, prevRank = 0, prevTb = 0;
    sorted.forEach(function (p, i) {
      var same = prevScore !== null && p.score === prevScore && (p.tb || 0) === prevTb;
      var rank = same ? prevRank : i + 1;
      prevScore = p.score; prevRank = rank; prevTb = p.tb || 0;
      out.push({ id: p.id, name: p.name, score: p.score, rank: rank, tb: p.tb || 0 });
    });
    return out;
  }

  function joinNames(names) {
    if (names.length <= 1) return names.join('');
    if (names.length === 2) return names[0] + ' and ' + names[1];
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  function groupByRank(ranked) {
    var groups = [];
    ranked.forEach(function (p) {
      var g = groups[groups.length - 1];
      if (g && g.rank === p.rank) g.names.push(p.name);
      else groups.push({ rank: p.rank, names: [p.name], score: p.score });
    });
    return groups;
  }

  /* Top-three announcement. Includes everyone tied inside the top three positions. */
  function leaderboardCopy(players, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    var ranked = rankPlayers(players).filter(function (p) { return p.rank <= 3; });
    if (!ranked.length) return '';
    var parts = groupByRank(ranked).map(function (g) {
      var label = g.names.length > 1 ? 'Joint ' + ordinal(g.rank) : ordinal(g.rank);
      return label + ' place ' + joinNames(g.names) + '.';
    });
    return cleanForTTS(t.leadIntro + ' ' + parts.join(' '));
  }

  function winnerCopy(players, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    var ranked = rankPlayers(players);
    if (!ranked.length) return '';
    var winners = ranked.filter(function (p) { return p.rank === 1; });
    var names = winners.map(function (p) { return p.name; });
    var pts = winners[0].score;
    var ptsWord = pts === 1 ? 'point' : 'points';
    if (names.length === 1) return cleanForTTS(t.winnerIntro + ' ' + names[0] + ' with ' + pts + ' ' + ptsWord + (winners[0].tb ? ', after winning the tiebreaker' : '') + '!');
    return cleanForTTS(t.jointWinnerIntro + '! ' + joinNames(names) + ' share first place with ' + pts + ' ' + ptsWord + ' each!');
  }

  /* ---------- tiebreakers: closest number wins ---------- */
  function parseGuess(str) {
    var t = String(str == null ? '' : str).replace(/[\s,\u00A3$%]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    return parseFloat(t);
  }
  /* entries: [{id, name, guess}] -> {rows (closest first), winners (ids), tie} */
  function tiebreakRound(entries, answer) {
    var rows = entries.map(function (e) {
      var v = parseGuess(e.guess);
      return { id: e.id, name: e.name, guess: e.guess, value: v, diff: v === null ? null : Math.abs(v - answer) };
    });
    rows.sort(function (a, b) { return (a.diff === null ? Infinity : a.diff) - (b.diff === null ? Infinity : b.diff); });
    var best = rows.length && rows[0].diff !== null ? rows[0].diff : null;
    var winners = best === null ? [] : rows.filter(function (r) { return r.diff === best; }).map(function (r) { return r.id; });
    return { rows: rows, winners: winners, tie: winners.length !== 1, noGuesses: best === null };
  }
  function pickTiebreaker(list, usedIds, themes) {
    var free = list.filter(function (q) { return usedIds.indexOf(q.id) === -1; });
    if (!free.length) free = list.slice();
    var pref = themes && themes.length ? free.filter(function (q) { return themes.indexOf(q.theme) !== -1; }) : [];
    var pool = pref.length ? pref : free;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  /* ---------- host scoring ---------- */
  function newHostState() { return { players: [], awards: {}, history: [], nextId: 1 }; }

  function findPlayerByName(players, name) {
    var key = normalizeText(name);
    for (var i = 0; i < players.length; i++) if (normalizeText(players[i].name) === key) return players[i];
    return null;
  }

  /* Award points for a question. Returns {ok, reason, player, points}. Never double-awards. */
  function awardPoints(state, name, qIndex, points) {
    var clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    var player = findPlayerByName(state.players, clean);
    if (!player) {
      player = { id: 'p' + state.nextId++, name: clean, score: 0 };
      state.players.push(player);
      player._new = true;
    }
    var key = String(qIndex);
    state.awards[key] = state.awards[key] || [];
    if (state.awards[key].indexOf(player.id) !== -1) {
      return { ok: false, reason: 'duplicate', player: player };
    }
    state.awards[key].push(player.id);
    player.score += points;
    var isNew = !!player._new; delete player._new;
    state.history.push({ type: 'award', playerId: player.id, qIndex: qIndex, points: points, created: isNew });
    return { ok: true, player: player, points: points, created: isNew };
  }

  function adjustPoints(state, playerId, delta) {
    var p = state.players.filter(function (x) { return x.id === playerId; })[0];
    if (!p) return false;
    p.score += delta;
    state.history.push({ type: 'adjust', playerId: playerId, points: delta });
    return true;
  }

  /* Take back one player's award for a question (fixing a wrong name). Returns true if something was removed. */
  function removeAward(state, playerId, qIndex) {
    var hi = -1;
    for (var i = state.history.length - 1; i >= 0; i--) {
      var h = state.history[i]; if (h.type === 'award' && h.playerId === playerId && h.qIndex === qIndex) { hi = i; break; }
    }
    var list = state.awards[String(qIndex)] || [], at = list.indexOf(playerId);
    if (hi === -1 || at === -1) return false;
    var h = state.history.splice(hi, 1)[0], pi = -1;
    state.players.forEach(function (p, i) { if (p.id === playerId) pi = i; });
    if (pi === -1) return false;
    var p = state.players[pi]; p.score -= h.points; list.splice(at, 1);
    if (h.created && p.score === 0 && !state.history.some(function (x) { return x.playerId === p.id; })) state.players.splice(pi, 1);
    return true;
  }

  function undoLast(state) {
    var h = state.history.pop();
    if (!h) return null;
    var idx = -1;
    state.players.forEach(function (p, i) { if (p.id === h.playerId) idx = i; });
    if (idx === -1) return h;
    var p = state.players[idx];
    p.score -= h.points;
    if (h.type === 'award') {
      var list = state.awards[String(h.qIndex)] || [];
      var at = list.indexOf(p.id);
      if (at !== -1) list.splice(at, 1);
      if (h.created && p.score === 0 && !state.history.some(function (x) { return x.playerId === p.id; })) {
        state.players.splice(idx, 1);
      }
    }
    return h;
  }

  function renamePlayer(state, playerId, newName) {
    var clean = String(newName || '').replace(/\s+/g, ' ').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    var other = findPlayerByName(state.players, clean);
    if (other && other.id !== playerId) return { ok: false, reason: 'exists' };
    var p = state.players.filter(function (x) { return x.id === playerId; })[0];
    if (!p) return { ok: false, reason: 'missing' };
    p.name = clean;
    return { ok: true };
  }

  function removePlayer(state, playerId) {
    state.players = state.players.filter(function (p) { return p.id !== playerId; });
    Object.keys(state.awards).forEach(function (k) {
      state.awards[k] = state.awards[k].filter(function (id) { return id !== playerId; });
    });
    state.history = state.history.filter(function (h) { return h.playerId !== playerId; });
  }

  /* ---------- answer matching ---------- */
  function stripAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function normalizeText(s) {
    return stripAccents(s == null ? '' : s).toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function stripArticle(s) { return s.replace(/^(the|a|an)\s+/, ''); }

  /* Strict matching: exact after normalisation (articles optional), against the answer or listed variations. */
  function checkAnswer(input, q) {
    var guess = stripArticle(normalizeText(input));
    if (!guess) return { correct: false, close: false };
    var accepted = [q.answer].concat(q.acceptedAnswers || []);
    for (var i = 0; i < accepted.length; i++) {
      if (stripArticle(normalizeText(accepted[i])) === guess) return { correct: true, close: false };
    }
    // "close" = single typo on a long-enough answer -> host/player can review manually, never auto-accepted
    for (var j = 0; j < accepted.length; j++) {
      var a = stripArticle(normalizeText(accepted[j]));
      if (a.length >= 6 && editDistance(a, guess) === 1) return { correct: false, close: true };
    }
    return { correct: false, close: false };
  }

  function editDistance(a, b) {
    var m = a.length, n = b.length, dp = [], i, j;
    for (i = 0; i <= m; i++) { dp[i] = [i]; }
    for (j = 1; j <= n; j++) dp[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[m][n];
  }

  /* ---------- duplicate detection ---------- */
  var STOP = { the: 1, a: 1, an: 1, of: 1, in: 1, on: 1, is: 1, was: 1, which: 1, what: 1, who: 1, did: 1, does: 1, do: 1, to: 1, by: 1, for: 1, and: 1, as: 1, are: 1, has: 1, have: 1, name: 1, called: 1 };
  function tokens(s) {
    return normalizeText(s).split(' ').filter(function (w) { return w && !STOP[w]; })
      .map(function (w) { return w.length > 3 ? w.replace(/s$/, '') : w; });
  }
  function similarity(a, b) {
    var A = tokens(a), B = tokens(b);
    if (!A.length || !B.length) return 0;
    var sa = {}, sb = {}, inter = 0, union = 0;
    A.forEach(function (w) { sa[w] = 1; }); B.forEach(function (w) { sb[w] = 1; });
    Object.keys(sa).forEach(function (w) { if (sb[w]) inter++; });
    union = Object.keys(sa).length + Object.keys(sb).length - inter;
    return inter / union;
  }
  /* Two questions are near-duplicates if their text is very similar AND they ask about the same answer.
     Same answer with different wording of a different fact (e.g. Brazil/most World Cups vs Brazil/Brasilia) is allowed. */
  function isNearDuplicate(q1, q2, threshold) {
    threshold = threshold || 0.6;
    if (normalizeText(q1.question) === normalizeText(q2.question)) return true;
    return similarity(q1.question, q2.question) >= threshold &&
      normalizeText(q1.answer) === normalizeText(q2.answer);
  }
  function findDuplicates(bank, threshold) {
    var dups = [], byAns = {}, byText = {};
    bank.forEach(function (q) {
      var a = normalizeText(q.answer), t = normalizeText(q.question);
      (byAns[a] = byAns[a] || []).push(q);
      if (byText[t]) dups.push([byText[t].id, q.id]); else byText[t] = q;
    });
    Object.keys(byAns).forEach(function (a) {
      var g = byAns[a];
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
        if (normalizeText(g[i].question) !== normalizeText(g[j].question) && isNearDuplicate(g[i], g[j], threshold)) dups.push([g[i].id, g[j].id]);
      }
    });
    return dups;
  }

  /* ---------- question selection (no repeats per player) ---------- */
  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function matchesFilters(q, f) {
    if (f.themes && f.themes.length && f.themes.indexOf(q.theme) === -1) return false;
    if (f.difficulty && f.difficulty !== 'mixed' && q.difficulty !== f.difficulty) return false;
    return true;
  }

  function availableQuestions(bank, filters, usedIds) {
    var used = toSet(usedIds);
    return bank.filter(function (q) { return !used[q.id] && matchesFilters(q, filters); });
  }

  function toSet(list) { var s = {}; (list || []).forEach(function (x) { s[x] = true; }); return s; }

  /* Build a quiz of up to `count` questions, never using any id in usedIds, and never two near-duplicates in one quiz.
     Returns {questions, shortfall, perTheme}. */
  function buildQuiz(bank, filters, count, usedIds, rng) {
    var pool = shuffle(availableQuestions(bank, filters, usedIds), rng);
    var picked = [];
    for (var i = 0; i < pool.length && picked.length < count; i++) {
      var q = pool[i];
      if (picked.some(function (p) { return isNearDuplicate(p, q); })) continue;
      picked.push(q);
    }
    return { questions: picked, shortfall: Math.max(0, count - picked.length), available: pool.length };
  }

  /* Find a replacement. Preserves exact difficulty; prefers same theme+subcategory, then same theme.
     Skips used, rejected, already-in-quiz and near-duplicates of questions in the quiz. Prefers short questions. */
  function findReplacement(bank, current, ctx) {
    var used = toSet(ctx.usedIds), rej = toSet(ctx.rejectedIds), inQuiz = toSet(ctx.quizIds);
    var quizQs = bank.filter(function (q) { return inQuiz[q.id]; });
    function ok(q) {
      if (used[q.id] || rej[q.id] || inQuiz[q.id] || q.id === current.id) return false;
      if (q.difficulty !== (ctx.difficulty || current.difficulty)) return false;
      if (ctx.themes && ctx.themes.length && ctx.themes.indexOf(q.theme) === -1) return false;
      return !quizQs.some(function (p) { return isNearDuplicate(p, q); });
    }
    var candidates = bank.filter(ok);
    function pickShortest(list) {
      if (!list.length) return null;
      var shuffled = shuffle(list, ctx.rng);
      shuffled.sort(function (a, b) { return a.question.length - b.question.length; });
      var top = shuffled.slice(0, Math.max(1, Math.ceil(shuffled.length / 3)));
      return top[Math.floor((ctx.rng || Math.random)() * top.length)];
    }
    var sameSub = candidates.filter(function (q) { return q.theme === current.theme && q.subcategory === current.subcategory; });
    var sameTheme = candidates.filter(function (q) { return q.theme === current.theme; });
    return pickShortest(sameSub) || pickShortest(sameTheme) || null;
  }

  /* ---------- stats ---------- */
  function bankStats(bank, usedIds) {
    var used = toSet(usedIds);
    var s = { total: bank.length, played: 0, remaining: 0, byTheme: {}, byDifficulty: { easy: 0, medium: 0, hard: 0 } };
    bank.forEach(function (q) {
      var isUsed = !!used[q.id];
      if (isUsed) s.played++; else s.remaining++;
      var t = s.byTheme[q.theme] = s.byTheme[q.theme] || { total: 0, remaining: 0 };
      t.total++; if (!isUsed) t.remaining++;
      s.byDifficulty[q.difficulty] = (s.byDifficulty[q.difficulty] || 0) + 1;
    });
    return s;
  }

  /* ---------- validation ---------- */
  var REQUIRED = ['id', 'question', 'answer', 'acceptedAnswers', 'wrongOptions', 'theme', 'subcategory', 'difficulty', 'hint', 'source', 'status'];
  function validateQuestion(q) {
    var errs = [];
    REQUIRED.forEach(function (k) { if (q[k] === undefined || q[k] === null || q[k] === '') errs.push('missing ' + k); });
    if (q.difficulty && DIFFICULTIES.indexOf(q.difficulty) === -1) errs.push('bad difficulty');
    if (!Array.isArray(q.wrongOptions) || q.wrongOptions.length !== 3) errs.push('need exactly 3 wrongOptions');
    else {
      var seen = {}; seen[normalizeText(q.answer)] = 1;
      q.wrongOptions.forEach(function (w) {
        var k = normalizeText(w);
        if (seen[k]) errs.push('wrong option repeats answer/option: ' + w);
        seen[k] = 1;
      });
    }
    if (!Array.isArray(q.acceptedAnswers)) errs.push('acceptedAnswers must be array');
    if (q.hint && q.answer && normalizeText(q.hint).indexOf(normalizeText(q.answer)) !== -1 && normalizeText(q.answer).length > 2) errs.push('hint contains the answer');
    if (q.question && q.question.length > 140) errs.push('question too long for TTS (>140)');
    if (q.status === 'verified' && !(q.source && q.source.verifiedBy)) errs.push('verified status needs source.verifiedBy');
    return errs;
  }

  /* ---------- multiple choice ---------- */
  function mcOptions(q, rng) { return shuffle([q.answer].concat(q.wrongOptions), rng); }

  /* ---------- persistence (namespaced, defensive) ---------- */
  function makeStore(storage, prefix) {
    prefix = prefix || 'tlqh:';
    function get(k, dflt) {
      try { var v = storage.getItem(prefix + k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
    }
    function set(k, v) {
      try { storage.setItem(prefix + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
    function del(k) { try { storage.removeItem(prefix + k); } catch (e) {} }
    return { get: get, set: set, del: del };
  }

  function memoryStorage() {
    var d = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); },
      removeItem: function (k) { delete d[k]; }
    };
  }

  return {
    BASE_POINTS: BASE_POINTS, DIFFICULTIES: DIFFICULTIES, DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    availablePoints: availablePoints, ordinal: ordinal,
    questionCopy: questionCopy, answerCopy: answerCopy, hintCopy: hintCopy,
    rankPlayers: rankPlayers, leaderboardCopy: leaderboardCopy, winnerCopy: winnerCopy,
    newHostState: newHostState, parseGuess: parseGuess, tiebreakRound: tiebreakRound, pickTiebreaker: pickTiebreaker, joinNames: joinNames, cleanForTTS: cleanForTTS, awardPoints: awardPoints, adjustPoints: adjustPoints, removeAward: removeAward,
    undoLast: undoLast, renamePlayer: renamePlayer, removePlayer: removePlayer,
    normalizeText: normalizeText, checkAnswer: checkAnswer,
    similarity: similarity, isNearDuplicate: isNearDuplicate, findDuplicates: findDuplicates,
    shuffle: shuffle, availableQuestions: availableQuestions, buildQuiz: buildQuiz,
    findReplacement: findReplacement, bankStats: bankStats,
    validateQuestion: validateQuestion, mcOptions: mcOptions,
    makeStore: makeStore, memoryStorage: memoryStorage
  };
});
