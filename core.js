/* Team Leyla Quiz Hub - core logic (pure functions, no DOM). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_POINTS = { easy: 1, medium: 2, hard: 3 };
  var DIFFICULTIES = ['easy', 'medium', 'hard'];

  /* ---------- points & hints ---------- */
  function availablePoints(difficulty, hintUsed, flat) {
    var base = flat > 0 ? flat : (BASE_POINTS[difficulty] || 1);
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
    finalQuestion: 'Question {n}: {question}',
    answer: 'CORRECT! The answer is {answer}. Onto question {next}',
    finalAnswer: 'CORRECT! The answer is {answer}. That’s the end of the quiz!',
    hint: 'Hint for question {n}: {hint}',
    leadIntro: 'In the lead!',
    winnerIntro: 'The winner is',
    jointWinnerIntro: 'We have joint winners'
  };

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : ''; });
  }

  /* TikTok live comments are limited to 150 characters: cut at a word boundary if ever longer. */
  var COMMENT_MAX = 150;
  function fitComment(text) {
    text = cleanForTTS(text);
    if (text.length <= COMMENT_MAX) return text;
    var cut = text.slice(0, COMMENT_MAX - 1), i = cut.lastIndexOf(' ');
    return (i > 60 ? cut.slice(0, i) : cut).replace(/[\s,;:.-]+$/, '') + '…';
  }
  /* question and answer wording is fixed so every comment looks the same on stream */
  function fixedTemplates(templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    t.question = DEFAULT_TEMPLATES.question; t.finalQuestion = DEFAULT_TEMPLATES.finalQuestion;
    t.answer = DEFAULT_TEMPLATES.answer; t.finalAnswer = DEFAULT_TEMPLATES.finalAnswer;
    return t;
  }
  function questionCopy(n, total, text, templates) {
    var t = fixedTemplates(templates);
    var isFinal = n === total;
    return fitComment(fill(isFinal ? t.finalQuestion : t.question, { n: n, question: cleanForTTS(text) }));
  }

  function answerCopy(n, total, answer, templates) {
    var t = fixedTemplates(templates);
    var isFinal = n === total;
    return fitComment(fill(isFinal ? t.finalAnswer : t.answer, { answer: cleanForTTS(answer), next: n + 1 }));
  }

  function hintCopy(n, hint, templates) {
    var t = Object.assign({}, DEFAULT_TEMPLATES, templates || {});
    return fitComment(fill(t.hint, { n: n, hint: cleanForTTS(hint) }));
  }

  /* multiple-choice options as one comment: "Options for question 4: A, x. B, y. C, z. D, w." */
  function optionsCopy(n, opts) {
    var body = opts.map(function (x, i) { return 'ABCD'[i] + ', ' + cleanForTTS(x); }).join('. ') + '.';
    var full = 'Options for question ' + n + ': ' + body;
    return full.length <= COMMENT_MAX ? full : fitComment('Options: ' + body);
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
    if (f.difficulty && f.difficulty !== 'mixed') {
      var ds = Array.isArray(f.difficulty) ? f.difficulty : [f.difficulty];
      if (ds.length && ds.length < 3 && ds.indexOf(q.difficulty) === -1) return false;
    }
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
    if (ctx.diversify) {
      var stem = function (q) { return String(q.question).toLowerCase().split(/\s+/).slice(0, 2).join(' '); };
      var curStem = stem(current), quizSubs = {};
      quizQs.forEach(function (p) { quizSubs[p.theme + '|' + p.subcategory] = 1; });
      var diffSub = candidates.filter(function (q) { return !(q.theme === current.theme && q.subcategory === current.subcategory) && stem(q) !== curStem; });
      var fresh = diffSub.filter(function (q) { return !quizSubs[q.theme + '|' + q.subcategory]; });
      var anyOf = function (list) { return list.length ? shuffle(list, ctx.rng)[0] : null; };
      return anyOf(fresh) || anyOf(diffSub) || anyOf(candidates.filter(function (q) { return stem(q) !== curStem; })) || anyOf(candidates);
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

  /* ---------- streamer mode: a hint must never give the answer away ---------- */
  var HINT_SKIP = { the: 1, and: 1, for: 1, of: 1, de: 1, la: 1, von: 1, van: 1 };
  function answerTokens(q) {
    var out = [];
    [q.answer].concat(q.acceptedAnswers || []).forEach(function (a) {
      normalizeText(a).split(' ').forEach(function (w) { if (w.length >= 3 && !HINT_SKIP[w] && out.indexOf(w) < 0) out.push(w); });
    });
    return out;
  }
  function hintLeaks(q) {
    if (!q.hint) return false;
    var words = ' ' + normalizeText(q.hint) + ' ';
    return answerTokens(q).some(function (w) { return words.indexOf(' ' + w + ' ') >= 0; });
  }
  /* returns the hint text that is safe to broadcast */
  function safeHint(q) {
    if (q.hint && !hintLeaks(q)) return q.hint;
    var a = String(q.answer).trim(), letters = a.replace(/[^A-Za-z0-9]/g, '').length, words = a.split(/\s+/).length;
    return 'Starts with “' + a.charAt(0).toUpperCase() + '” (' + letters + ' letters' + (words > 1 ? ', ' + words + ' words' : '') + ')';
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

  /* ---------- riddles ---------- */
  /* points: base by difficulty (or flat), minus 1 per extra hint used, never below 1 */
  function riddlePoints(difficulty, hintsUsed, flat) {
    var base = flat > 0 ? flat : (BASE_POINTS[difficulty] || 1);
    return Math.max(1, base - Math.max(0, hintsUsed || 0));
  }
  function riddleCopy(n, total, text) { return fitComment('Riddle ' + n + ': ' + cleanForTTS(text)); }
  function riddleAnswerCopy(n, total, answer) {
    return fitComment(n >= total ? 'CORRECT! The answer is ' + cleanForTTS(answer) + '. That\u2019s the end of the riddles!' : 'CORRECT! The answer is ' + cleanForTTS(answer) + '. Onto riddle ' + (n + 1));
  }
  function riddleHintCopy(n, k, hint) { return fitComment('Hint ' + k + ' for riddle ' + n + ': ' + cleanForTTS(hint)); }
  function buildRiddles(bank, difficulty, count, usedIds, rng) {
    var ds = Array.isArray(difficulty) ? difficulty : (difficulty && difficulty !== 'mixed' ? [difficulty] : DIFFICULTIES);
    var used = toSet(usedIds);
    var pool = shuffle(bank.filter(function (r) { return !used[r.id] && ds.indexOf(r.difficulty) !== -1; }), rng);
    return { riddles: pool.slice(0, count), shortfall: Math.max(0, count - pool.length), available: pool.length };
  }

  /* ---------- Hangman ---------- */
  function hmNorm(w) {
    return String(w || '').normalize ? String(w || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z' \-]/g, '').replace(/\s+/g, ' ').trim() : String(w || '').toUpperCase().trim();
  }
  function hmLetters(word) { var seen = {}, out = []; hmNorm(word).split('').forEach(function (c) { if (c >= 'A' && c <= 'Z' && !seen[c]) { seen[c] = 1; out.push(c); } }); return out; }
  function hmMask(word, guessed) {
    var g = {}; (guessed || []).forEach(function (c) { g[c] = 1; });
    return hmNorm(word).split('').map(function (c) { return (c >= 'A' && c <= 'Z') ? (g[c] ? c : '_') : c; });
  }
  /* 0 = nothing drawn yet; wrong guess 1..6 shows picture 1..6 (the 6th is the chick falling = out of lives) */
  function hmStage(wrong) { return wrong <= 0 ? 0 : Math.min(6, wrong); }
  function hmState(word, guessed, wrongWords, lives) {
    var set = {}; hmLetters(word).forEach(function (c) { set[c] = 1; });
    var wl = (guessed || []).filter(function (c) { return !set[c]; }), wrong = wl.length + (wrongWords || 0);
    var won = hmLetters(word).every(function (c) { return (guessed || []).indexOf(c) !== -1; });
    lives = 6; var lost = !won && wrong >= lives;
    return { wrongLetters: wl, wrong: wrong, won: won, lost: lost, stage: hmStage(wrong), left: Math.max(0, lives - wrong) };
  }
  function hmShow(word, guessed) {
    return hmMask(word, guessed).map(function (c) { return c === ' ' ? '/' : c; }).join(' ');
  }
  function hmCopy(n, total, word, guessed, cat, wrongLetters) {
    var len = hmLetters(word).length ? hmNorm(word).replace(/[^A-Z]/g, '').length : 0;
    var t = 'Word ' + n + ': ' + hmShow(word, guessed) + ' (' + len + ' letters' + (cat ? ', ' + cat : '') + ')' + (wrongLetters && wrongLetters.length ? ' Wrong: ' + wrongLetters.join(' ') : '');
    return fitComment(t);
  }
  function hmResultCopy(n, total, word, won) {
    var w = hmNorm(word), tail = n >= total ? 'That’s the end of Hangman!' : 'Onto word ' + (n + 1);
    return fitComment((won ? 'CORRECT! The word is ' : 'Out of lives! The word was ') + w + '. ' + tail);
  }
  function hmDifficulty(word) { var n = hmNorm(word).replace(/[^A-Z]/g, '').length; if (n >= 10) return 'hard'; if (n >= 7 && /[JQXZ]/.test(hmNorm(word))) return 'hard'; if (n >= 7) return 'medium'; return 'easy'; }

  return {
    hmNorm: hmNorm, hmLetters: hmLetters, hmMask: hmMask, hmStage: hmStage, hmState: hmState, hmShow: hmShow, hmCopy: hmCopy, hmResultCopy: hmResultCopy, hmDifficulty: hmDifficulty,
    riddlePoints: riddlePoints, riddleCopy: riddleCopy, riddleAnswerCopy: riddleAnswerCopy, riddleHintCopy: riddleHintCopy, buildRiddles: buildRiddles,
    BASE_POINTS: BASE_POINTS, DIFFICULTIES: DIFFICULTIES, DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    availablePoints: availablePoints, ordinal: ordinal,
    questionCopy: questionCopy, answerCopy: answerCopy, hintCopy: hintCopy,
    rankPlayers: rankPlayers, leaderboardCopy: leaderboardCopy, winnerCopy: winnerCopy,
    newHostState: newHostState, parseGuess: parseGuess, tiebreakRound: tiebreakRound, pickTiebreaker: pickTiebreaker, joinNames: joinNames, cleanForTTS: cleanForTTS, fitComment: fitComment, optionsCopy: optionsCopy, awardPoints: awardPoints, adjustPoints: adjustPoints, removeAward: removeAward,
    undoLast: undoLast, renamePlayer: renamePlayer, removePlayer: removePlayer,
    normalizeText: normalizeText, checkAnswer: checkAnswer,
    similarity: similarity, isNearDuplicate: isNearDuplicate, findDuplicates: findDuplicates,
    shuffle: shuffle, availableQuestions: availableQuestions, buildQuiz: buildQuiz,
    findReplacement: findReplacement, bankStats: bankStats,
    validateQuestion: validateQuestion, safeHint: safeHint, hintLeaks: hintLeaks, mcOptions: mcOptions,
    makeStore: makeStore, memoryStorage: memoryStorage
  };
});
