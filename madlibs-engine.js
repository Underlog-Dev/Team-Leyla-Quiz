/* Team Leyla Game Night - Mad Libs Theatre: pure script engine (no DOM, fully testable).
   Scripts and word banks are plain data; nothing here is specific to any one script. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MadLibs = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LEVELS = { family: 1, funny: 2, chaos: 3 };
  var LEVEL_CODE = { f: 'family', y: 'funny', c: 'chaos' };
  var LEN = { s: 'short', m: 'standard', l: 'extended' };
  var MAXLEN = 80, MAXUSER = 30;
  /* explicit words are never silently changed; the host is only warned */
  var FLAG = /\b(f+u+c+k\w*|sh[i1]t\w*|c+u+n+t\w*|n[i1]gg\w*|fagg?\w*|retard\w*|wh[o0]re\w*|slut\w*|rape\w*|porn\w*|dick\w*|cock\b|pussy|twat|wank\w*|bastard)\b/i;

  function rand(rng) { return (rng || Math.random)(); }
  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand(rng) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a.length ? a[Math.floor(rand(rng) * a.length)] : null; }

  function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || MAXLEN); }
  function flagged(s) { return FLAG.test(String(s || '')); }

  /* a / an for the +a modifier */
  function article(w) {
    var s = String(w).trim(); if (!s) return '';
    if (/^(a|an|the|my|your|his|her|our|their|some|\d)/i.test(s) && /^(a|an|the|my|your|his|her|our|their|some)\s/i.test(s)) return '';
    if (/^[0-9]/.test(s)) return /^(8|11|18|80|8\d)/.test(s) ? 'an' : 'a';
    if (/^(hour|honest|honou?r|heir)/i.test(s)) return 'an';
    if (/^(uni|use|usu|uti|eu|one|once|ubi)/i.test(s)) return 'a';
    return /^[aeiou]/i.test(s) ? 'an' : 'a';
  }
  function applyMod(word, mod) {
    if (!mod) return word;
    if (mod === 'a') { var ar = article(word); return ar ? ar + ' ' + word : word; }
    if (mod === 'U') return word.toUpperCase();
    if (mod === 'u') return word.charAt(0).toUpperCase() + word.slice(1);
    if (mod === 'l') return word.toLowerCase();
    return word;
  }

  var TOKEN = /\{([a-z0-9_]+)(?:\+([aUul]))?\}/g;
  /* split a template into [{t:'text',v}|{t:'w',k,v,raw}] */
  function segments(tpl, answers, strict) {
    var out = [], last = 0, m; TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(tpl))) {
      if (m.index > last) out.push({ t: 'text', v: tpl.slice(last, m.index) });
      var ans = answers[m[1]];
      if (ans == null || ans === '') { if (strict) throw new Error('no answer for ' + m[1]); ans = '___'; }
      var shown = ans, prev = tpl.slice(0, m.index);   /* the script already says "you": don't say it twice ("You you buffoon") */
      if (/\byou\s+$/i.test(prev)) { var cut = shown.replace(/^you(?:'re|\s+are)?[\s,]+(?:(?:a|an|the)\s+)?/i, ''); if (cut) shown = cut; }
      out.push({ t: 'w', k: m[1], v: applyMod(shown, m[2]), raw: ans });
      last = m.index + m[0].length;
    }
    if (last < tpl.length) out.push({ t: 'text', v: tpl.slice(last) });
    return out;
  }
  function placeholders(tpl) { var r = [], m; TOKEN.lastIndex = 0; while ((m = TOKEN.exec(tpl))) r.push(m[1]); return r; }
  function plain(segs) { return segs.map(function (s) { return s.v; }).join(''); }

  /* ---------- library filtering ---------- */
  function eligible(scripts, f, done, noRepeat) {
    var rank = LEVELS[f.level] || 3, seen = {}; (done || []).forEach(function (id) { seen[id] = 1; });
    return scripts.filter(function (s) {
      if (f.actors && s.roles.length !== +f.actors) return false;
      if (f.cat && f.cat !== 'any' && s.cat !== f.cat) return false;
      if (f.len && f.len !== 'any' && s.len !== f.len) return false;
      if ((LEVELS[s.lvl] || 3) > rank) return false;
      if (noRepeat && seen[s.id]) return false;
      return true;
    });
  }
  function pickScript(list, rng, lastId) {
    var l = list.filter(function (s) { return s.id !== lastId; });
    return pick(l.length ? l : list, rng);
  }

  /* ---------- word banks ---------- */
  function randomAnswer(banks, type, level, rng, avoid) {
    var b = banks[type]; if (!b) return '';
    var pool = (b.a || []).slice(), extra = b.c || [];
    if (level !== 'family') pool = pool.concat(extra, level === 'chaos' ? extra : []);
    var cand = pool.filter(function (x) { return !avoid || avoid.indexOf(x) === -1; });
    return pick(cand.length ? cand : pool, rng) || '';
  }

  /* ---------- acting instructions ---------- */
  var ACTING = ['Maintain intense eye contact with the other actor.', 'Slowly turn towards the camera in disgust.', 'Deliver this line whilst trying not to cry.', 'Whisper as though revealing a national secret.', 'Say this in an unnecessarily romantic voice.', 'Read this with increasing anger.', 'Pause dramatically before the final word.', 'Pretend you are genuinely offended.', 'Suddenly begin speaking in a Shakespearean voice.', 'Deliver the line like an angry football manager.', 'Look suspiciously at the other actor.', 'Sing the next sentence.', 'Deliver an emotional apology whilst refusing to admit fault.', 'Say this with the confidence of someone who is completely wrong.', 'Stare directly into the camera in silence for three seconds.', 'Begin laughing, then suddenly become extremely serious.', 'Say this as though you are announcing the end of the world.', 'Pretend you are struggling to hold back tears of happiness.', 'Read this like an emotional reality TV confession.', 'Slowly shake your head in disappointment.', 'Deliver this as if your entire career depends on it.', 'Say this like a posh newsreader.', 'Gasp, then clutch your chest.', 'Say it like a nature documentary narrator.', 'Whisper-shout this line.', 'Say this as though you have just been slapped by a fish.', 'Wink at the camera, very slowly.', 'Deliver this line like a medieval town crier.', 'Speak as if you are underwater.', 'Say it like you are the world’s proudest parent.'];

  /* ---------- building a game ---------- */
  function newGame(script, o, banks, rng) {
    o = o || {}; var n = script.roles.length;
    var names = []; for (var i = 0; i < n; i++) names.push(clean((o.names || [])[i], 24) || 'Player ' + (i + 1));
    var order = shuffle(script.w.map(function (w) { return w.k; }), rng);
    var reqs = order.map(function (k) {
      var w = script.w.filter(function (x) { return x.k === k; })[0];
      var b = banks[w.type];
      return { k: k, type: w.type, prompt: b ? b.p : w.type, hint: (b && b.e) || '', ans: '', user: '', done: false };
    });
    var assign = shuffle(names.map(function (_, i) { return i; }), rng);       // role index -> player index
    var extra = {};
    if (o.randActing !== 0) {
      var free = []; script.lines.forEach(function (l, i) { if (l.r != null && !l.a && i > 0 && i < script.lines.length - 1) free.push(i); });
      var want = Math.max(1, Math.round(free.length / 4)), chosen = [], pool = shuffle(ACTING, rng), tries = 0;
      shuffle(free, rng).forEach(function (i) {
        if (chosen.length >= want) return;
        if (chosen.some(function (c) { return Math.abs(c - i) < 2; })) return;
        chosen.push(i); extra[i] = pool[chosen.length % pool.length];
      });
    }
    return { sid: script.id, names: names, assign: assign, reqs: reqs, i: 0, stage: 'collect', extra: extra, size: 3, view: 'full', line: 0, level: o.level || 'chaos', started: Date.now() };
  }
  function answersOf(game) { var a = {}; game.reqs.forEach(function (r) { a[r.k] = r.ans; }); return a; }
  function allDone(game) { return game.reqs.every(function (r) { return r.done && r.ans; }); }
  function actorName(game, script, roleIdx) { return game.names[game.assign[roleIdx]]; }
  /* the finished script: [{kind:'dir'|'say', who, roleIdx, acting, extra, segs}] */
  function build(script, game, strict) {
    var ans = answersOf(game);
    return script.lines.map(function (l, i) {
      if (l.r == null) return { kind: 'dir', segs: segments(l.t, ans, strict), i: i };
      return { kind: 'say', roleIdx: l.r, role: script.roles[l.r], who: actorName(game, script, l.r), acting: l.a ? plain(segments(l.a, ans, strict)) : '', actingSegs: l.a ? segments(l.a, ans, strict) : null, extra: l.a ? '' : (game.extra[i] || ''), segs: segments(l.t, ans, strict), i: i };
    });
  }
  function lineText(item) {
    var t = plain(item.segs);
    if (item.kind === 'dir') return '(' + t.replace(/^\(|\)$/g, '') + ')';
    var ac = item.acting || item.extra; return item.who + ': ' + (ac ? '(' + ac.replace(/^\(|\)$/g, '') + ') ' : '') + t;
  }
  function scriptText(script, game) {
    var items = build(script, game, true), head = '🎭 ' + script.t + '\n' + script.desc + '\n\nCast: ' + script.roles.map(function (r, i) { return actorName(game, script, i) + ' as ' + r; }).join(', ') + '\n';
    return head + '\n' + items.map(lineText).join('\n') + '\n\n🎭 Team Leyla Mad Libs Theatre';
  }


  /* ---------- word-type check: blocks an answer only when it is confidently the wrong kind of word ---------- */
  var POSMAP = null;
  function posMap(P) { if (POSMAP) return POSMAP; POSMAP = {}; Object.keys(P || {}).forEach(function (k) { P[k].split(' ').forEach(function (w) { if (w) POSMAP[w] = (POSMAP[w] | 0) | (+k); }); }); return POSMAP; }
  var NUMW = '(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|dozen|score|once|twice|half|couple|few|several|infinity|googol|\\w*teen|\\w*ty)';
  var NUMRE = new RegExp('\\d|\\b' + NUMW + '\\b', 'i'), MONEYRE = /£|\$|€|quid|pound|pence|penny|pennies|fiver|tenner|grand|shilling|cent|dollar|euro|\bbob\b|nickel|farthing|crown|guinea|coin|note|wallet|bag|purse|fortune|bill/i;
  var IRREG = /(fish|sheep)$|^(men|women|children|people|mice|geese|teeth|feet|sheep|fish|deer|lice|oxen|cacti|fungi|data|series|species|moose|bison|swine|aircraft|trout|salmon|squid|knives|wives|lives|leaves|loaves|thieves|wolves|shelves|halves|calves|elves|selves|dice|criteria|phenomena|alumni|media|police|cattle|clothes|scissors|trousers|pants|jeans|shorts|glasses|pliers|tongs|goods|belongings|savings|brethren)$/i;
  var AN = function (w) { return /^[aeiou]/i.test(w) ? 'an ' + w : 'a ' + w; };
  function checkWord(type, text, banks, P) {
    var b = banks[type]; if (!b) return '';
    var t = String(text || '').trim(), toks = t.toLowerCase().match(/[a-z0-9£$€'-]+/g) || [], one = toks.length === 1 ? toks[0].replace(/^'+|'+$/g, '') : '';
    var m = P ? posMap(P) : {}, g = b.g, mask = one ? (m[one] | 0) : 0;
    function no(what) { return 'This is not ' + what + '.'; }
    if (type === 'colour') return '';
    if (g === 'adj') return mask & 2 ? no('an adjective') : '';
    if (g === 'verb') return mask & 4 ? no('a verb') : '';
    if (g === 'adv') return one && !/ly$/.test(one) && (mask & 8) ? no('an adverb') : '';
    if (g === 'ing') return toks.length > 1 || toks.some(function (x) { return x.length >= 5 && /ing$/.test(x); }) ? '' : no('a verb ending in -ing');
    if (g === 'pl') { var last = toks[toks.length - 1] || ''; return /s$/.test(last) || IRREG.test(last) ? '' : no('a plural noun'); }
    if (g === 'num') return NUMRE.test(t) ? '' : no('a number');
    if (g === 'money') return NUMRE.test(t) || MONEYRE.test(t) ? '' : no('an amount of money');
    if (g === 'n') return mask & 1 ? no('a noun') : '';
    return '';
  }

  /* ---------- validation of a script (used by the build step and tests) ---------- */
  function validate(s, banks) {
    var e = [], keys = {}; if (!s.id) e.push('missing id');
    if (!s.roles || s.roles.length < 1 || s.roles.length > 4) e.push('roles must be 1-4');
    if (!LEVELS[s.lvl]) e.push('bad level'); if (!LEN[s.len] && ['short', 'standard', 'extended'].indexOf(s.len) === -1) e.push('bad length');
    (s.w || []).forEach(function (w) { if (keys[w.k]) e.push('dup key ' + w.k); keys[w.k] = 0; if (!banks[w.type]) e.push('unknown type ' + w.type + ' for ' + w.k); });
    var used = {};
    (s.lines || []).forEach(function (l, i) {
      if (l.r != null && (l.r < 0 || l.r >= s.roles.length)) e.push('line ' + (i + 1) + ' bad role');
      if (!l.t || !l.t.trim()) e.push('line ' + (i + 1) + ' empty');
      placeholders((l.t || '') + ' ' + (l.a || '')).forEach(function (k) { if (!(k in keys)) e.push('line ' + (i + 1) + ' unknown placeholder {' + k + '}'); else { keys[k]++; used[k] = (used[k] || 0) + 1; } });
      if (/\{[^}]*\}/.test((l.t || '').replace(TOKEN, ''))) e.push('line ' + (i + 1) + ' malformed placeholder');
    });
    Object.keys(keys).forEach(function (k) { if (!keys[k]) e.push('unused word ' + k); });
    var spoken = {}; (s.lines || []).forEach(function (l) { if (l.r != null) spoken[l.r] = 1; });
    (s.roles || []).forEach(function (r, i) { if (!spoken[i]) e.push('role never speaks: ' + r); });
    return e;
  }
  function callbacks(s) { var c = {}; s.lines.forEach(function (l) { placeholders(l.t + ' ' + (l.a || '')).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); }); return Object.keys(c).filter(function (k) { return c[k] > 1; }); }

  return { checkWord: checkWord, LEVELS: LEVELS, LEVEL_CODE: LEVEL_CODE, LEN: LEN, MAXLEN: MAXLEN, MAXUSER: MAXUSER, ACTING: ACTING, clean: clean, flagged: flagged, article: article, applyMod: applyMod, segments: segments, placeholders: placeholders, plain: plain,
    eligible: eligible, pickScript: pickScript, randomAnswer: randomAnswer, newGame: newGame, answersOf: answersOf, allDone: allDone, build: build, lineText: lineText, scriptText: scriptText, validate: validate, callbacks: callbacks, shuffle: shuffle, pick: pick, actorName: actorName };
}));
